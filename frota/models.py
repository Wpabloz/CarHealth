from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from contas.models import Empresa, Situacao
from contas.validators import validar_cpf, validar_placa


class Motorista(models.Model):
    """Motoristas da frota. Fazem rodízio: não ficam presos a um veículo (RN17)."""

    cpf = models.CharField("CPF", max_length=11, primary_key=True, validators=[validar_cpf])
    nome = models.CharField(max_length=120)
    telefone = models.CharField(max_length=15)
    num_cnh = models.CharField("nº da CNH", max_length=11)
    validade_cnh = models.DateField("validade da CNH")
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.ATIVO
    )
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="motoristas"
    )

    class Meta:
        db_table = "motorista"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Veiculo(models.Model):
    placa = models.CharField(max_length=8, primary_key=True, validators=[validar_placa])
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=60)
    ano = models.IntegerField(validators=[MinValueValidator(1950), MaxValueValidator(2100)])
    # Texto livre (ex.: GUINCHO, CAMINHAO); precisa ser igual ao tipo_veiculo do plano
    tipo = models.CharField(max_length=30)
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.ATIVO
    )
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="veiculos"
    )

    class Meta:
        db_table = "veiculo"
        ordering = ["placa"]
        verbose_name = "veículo"

    def __str__(self):
        return f"{self.placa} - {self.marca} {self.modelo}"

    def save(self, *args, **kwargs):
        self.placa = self.placa.upper().replace("-", "")
        self.tipo = self.tipo.strip().upper()
        super().save(*args, **kwargs)

    @property
    def ultima_leitura(self):
        """A mais recente na ordem de registro (RN02), mesmo que seja um ajuste para menos."""
        return self.leituras.order_by("-codigo").first()

    @property
    def km_atual(self):
        ultima = self.ultima_leitura
        return ultima.quilometragem if ultima else None  # None = "sem registro" (RN19)


class PlanoManutencao(models.Model):
    id_plano = models.AutoField(primary_key=True)
    descricao = models.CharField("descrição", max_length=120)
    tipo_veiculo = models.CharField("tipo de veículo", max_length=30)
    intervalo_km = models.IntegerField(
        "intervalo (km)", null=True, blank=True, validators=[MinValueValidator(1)]
    )
    intervalo_meses = models.IntegerField(
        "intervalo (meses)", null=True, blank=True, validators=[MinValueValidator(1)]
    )
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.ATIVO
    )
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="planos"
    )

    class Meta:
        db_table = "plano_manutencao"
        ordering = ["descricao"]
        verbose_name = "plano de manutenção"

    def __str__(self):
        return self.descricao

    def save(self, *args, **kwargs):
        self.tipo_veiculo = self.tipo_veiculo.strip().upper()
        super().save(*args, **kwargs)


class LeituraOdometro(models.Model):
    class Origem(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        ORDEM_SERVICO = "ORDEM_SERVICO", "Ordem de serviço"
        AJUSTE_ODOMETRO = "AJUSTE_ODOMETRO", "Ajuste de odômetro"

    codigo = models.AutoField(primary_key=True)
    data_leitura = models.DateField("data da leitura")
    origem = models.CharField(max_length=20, choices=Origem.choices, default=Origem.MANUAL)
    veiculo = models.ForeignKey(
        Veiculo,
        verbose_name="veículo", on_delete=models.PROTECT, db_column="placa_veiculo", related_name="leituras"
    )
    quilometragem = models.IntegerField(validators=[MinValueValidator(0)])
    # Quem lançou a leitura, gestor ou motorista (RNF09)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="usuário", on_delete=models.PROTECT, db_column="email_usuario", related_name="leituras"
    )

    class Meta:
        db_table = "leitura_odometro"
        ordering = ["-codigo"]
        verbose_name = "leitura de odômetro"

    def __str__(self):
        return f"{self.veiculo_id} - {self.quilometragem} km em {self.data_leitura:%d/%m/%Y}"


class OrdemServico(models.Model):
    class Status(models.TextChoices):
        ABERTA = "ABERTA", "Aberta"
        APROVADA = "APROVADA", "Aprovada"  # reservado: a aprovação fica fora do MVP (RN12)
        CONCLUIDA = "CONCLUIDA", "Concluída"
        CANCELADA = "CANCELADA", "Cancelada"

    id_ordem = models.AutoField(primary_key=True)  # identificador interno
    numero = models.IntegerField("número")  # sequencial dentro da empresa, gerado na abertura (RF23)
    descricao = models.CharField("descrição", max_length=255)
    data_abertura = models.DateField("data de abertura")
    data_conclusao = models.DateField("data de conclusão", null=True, blank=True)
    quilometragem = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(0)])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ABERTA)
    oficina = models.CharField(max_length=120, blank=True, null=True)
    valor = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    veiculo = models.ForeignKey(
        Veiculo,
        verbose_name="veículo", on_delete=models.PROTECT, db_column="placa_veiculo", related_name="ordens"
    )
    plano = models.ForeignKey(
        PlanoManutencao,
        verbose_name="plano de manutenção",
        on_delete=models.PROTECT,
        db_column="id_plano",
        null=True,
        blank=True,
        related_name="ordens",
    )
    emitente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="email_emitente",
        related_name="ordens_emitidas",
    )
    aprovador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="email_aprovador",
        null=True,
        blank=True,
        related_name="ordens_aprovadas",
    )

    class Meta:
        db_table = "ordem_servico"
        ordering = ["-data_abertura", "-numero"]
        verbose_name = "ordem de serviço"
        verbose_name_plural = "ordens de serviço"

    def __str__(self):
        return f"OS {self.numero} - {self.veiculo_id}"
