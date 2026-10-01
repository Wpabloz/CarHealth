from django.conf import settings
from django.db import models
from django.db.models import F, Q

from contas.models import Empresa
from contas.validators import validar_cpf, validar_placa


class TipoVeiculo(models.TextChoices):
    CARRO = "CARRO", "Carro"
    MOTO = "MOTO", "Moto"
    UTILITARIO = "UTILITARIO", "Utilitário"
    VAN = "VAN", "Van"
    CAMINHAO = "CAMINHAO", "Caminhão"
    ONIBUS = "ONIBUS", "Ônibus"


class Motorista(models.Model):
    cpf = models.CharField("CPF", max_length=11, primary_key=True, validators=[validar_cpf])
    nome = models.CharField(max_length=120)
    telefone = models.CharField(max_length=15)
    num_cnh = models.CharField("nº da CNH", max_length=11, unique=True)
    validade_cnh = models.DateField("validade da CNH")
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="motoristas"
    )

    class Meta:
        db_table = "motorista"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Veiculo(models.Model):
    class Situacao(models.TextChoices):
        ATIVO = "ATIVO", "Ativo"
        MANUTENCAO = "MANUTENCAO", "Em manutenção"
        INATIVO = "INATIVO", "Inativo"

    placa = models.CharField(max_length=8, primary_key=True, validators=[validar_placa])
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=60)
    ano = models.IntegerField()
    tipo = models.CharField(max_length=30, choices=TipoVeiculo.choices)
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.ATIVO
    )
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="veiculos"
    )
    motorista = models.ForeignKey(
        Motorista,
        on_delete=models.SET_NULL,
        db_column="cpf_motorista",
        null=True,
        blank=True,
        related_name="veiculos",
    )

    class Meta:
        db_table = "veiculo"
        ordering = ["placa"]
        constraints = [
            models.CheckConstraint(condition=Q(ano__gte=1950, ano__lte=2100), name="ck_veiculo_ano"),
            models.CheckConstraint(
                condition=Q(situacao__in=["ATIVO", "MANUTENCAO", "INATIVO"]),
                name="ck_veiculo_situacao",
            ),
        ]

    def __str__(self):
        return f"{self.placa} - {self.marca} {self.modelo}"

    def save(self, *args, **kwargs):
        self.placa = self.placa.upper().replace("-", "")
        super().save(*args, **kwargs)

    @property
    def km_atual(self):
        ultima = self.leituras.order_by("-quilometragem").first()
        return ultima.quilometragem if ultima else None


class PlanoManutencao(models.Model):
    id_plano = models.AutoField(primary_key=True)
    descricao = models.CharField("descrição", max_length=120)
    tipo_veiculo = models.CharField("tipo de veículo", max_length=30, choices=TipoVeiculo.choices)
    intervalo_km = models.IntegerField("intervalo (km)", null=True, blank=True)
    intervalo_meses = models.IntegerField("intervalo (meses)", null=True, blank=True)
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="planos"
    )

    class Meta:
        db_table = "plano_manutencao"
        ordering = ["descricao"]
        verbose_name = "plano de manutenção"
        constraints = [
            # pelo menos um dos intervalos precisa ser informado
            models.CheckConstraint(
                condition=Q(intervalo_km__isnull=False) | Q(intervalo_meses__isnull=False),
                name="ck_plano_algum_intervalo",
            ),
            models.CheckConstraint(
                condition=Q(intervalo_km__isnull=True) | Q(intervalo_km__gt=0),
                name="ck_plano_intervalo_km",
            ),
            models.CheckConstraint(
                condition=Q(intervalo_meses__isnull=True) | Q(intervalo_meses__gt=0),
                name="ck_plano_intervalo_meses",
            ),
        ]

    def __str__(self):
        return self.descricao


class LeituraOdometro(models.Model):
    class Origem(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        MOTORISTA = "MOTORISTA", "Motorista"
        ORDEM_SERVICO = "ORDEM_SERVICO", "Ordem de serviço"

    codigo = models.AutoField(primary_key=True)
    data_leitura = models.DateField("data da leitura")
    origem = models.CharField(max_length=20, choices=Origem.choices, default=Origem.MANUAL)
    veiculo = models.ForeignKey(
        Veiculo,
        verbose_name="veículo", on_delete=models.PROTECT, db_column="placa_veiculo", related_name="leituras"
    )
    quilometragem = models.IntegerField()

    class Meta:
        db_table = "leitura_odometro"
        ordering = ["-data_leitura", "-quilometragem"]
        verbose_name = "leitura de odômetro"
        constraints = [
            models.CheckConstraint(condition=Q(quilometragem__gte=0), name="ck_leitura_km"),
        ]

    def __str__(self):
        return f"{self.veiculo_id} - {self.quilometragem} km em {self.data_leitura:%d/%m/%Y}"


class OrdemServico(models.Model):
    class Status(models.TextChoices):
        ABERTA = "ABERTA", "Aberta"
        APROVADA = "APROVADA", "Aprovada"
        EM_EXECUCAO = "EM_EXECUCAO", "Em execução"
        CONCLUIDA = "CONCLUIDA", "Concluída"
        CANCELADA = "CANCELADA", "Cancelada"

    numero = models.AutoField("número", primary_key=True)
    descricao = models.CharField("descrição", max_length=255)
    data_abertura = models.DateField("data de abertura")
    data_conclusao = models.DateField("data de conclusão", null=True, blank=True)
    quilometragem = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ABERTA)
    oficina = models.CharField(max_length=120, blank=True, null=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
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
        ordering = ["-numero"]
        verbose_name = "ordem de serviço"
        verbose_name_plural = "ordens de serviço"
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    status__in=["ABERTA", "APROVADA", "EM_EXECUCAO", "CONCLUIDA", "CANCELADA"]
                ),
                name="ck_os_status",
            ),
            models.CheckConstraint(
                condition=Q(valor__isnull=True) | Q(valor__gte=0), name="ck_os_valor"
            ),
            models.CheckConstraint(
                condition=Q(quilometragem__isnull=True) | Q(quilometragem__gte=0),
                name="ck_os_quilometragem",
            ),
            models.CheckConstraint(
                condition=Q(data_conclusao__isnull=True) | Q(data_conclusao__gte=F("data_abertura")),
                name="ck_os_datas",
            ),
        ]

    def __str__(self):
        return f"OS {self.numero} - {self.veiculo_id}"
