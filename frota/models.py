from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F

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


# Veículos aparecem pelo nome da equipe ("Guincho 01", "Guincho 02"...); sem nome, pela placa
ORDEM_DOS_VEICULOS = (F("identificacao").asc(nulls_last=True), "placa")


class Veiculo(models.Model):
    placa = models.CharField(max_length=8, primary_key=True, validators=[validar_placa])
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=60)
    ano = models.IntegerField(validators=[MinValueValidator(1950), MaxValueValidator(2100)])
    # Texto livre (ex.: GUINCHO, CAMINHAO); precisa ser igual ao tipo_veiculo do plano
    tipo = models.CharField(max_length=30)
    # Nome usado pela equipe (ex.: "Guincho 01") e equipamentos instalados. Opcionais.
    identificacao = models.CharField("identificação", max_length=30, null=True, blank=True)
    observacoes = models.CharField("observações", max_length=255, null=True, blank=True)
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
        CHECKIN = "CHECKIN", "Check-in"  # gerada junto com o check-in do motorista (Sprint 5)

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


class Checkin(models.Model):
    """
    Check-in do motorista por QR code (Sprint 5, Cap. 5): obrigatório antes das demais
    ações do dia. Gera, na mesma transação, a leitura de odômetro informada (RN03).
    """

    class EstadoGeral(models.TextChoices):
        BOM = "BOM", "Bom"
        REGULAR = "REGULAR", "Regular"
        RUIM = "RUIM", "Ruim"

    id_checkin = models.AutoField(primary_key=True)
    veiculo = models.ForeignKey(
        Veiculo, verbose_name="veículo", on_delete=models.PROTECT,
        db_column="placa_veiculo", related_name="checkins"
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="usuário", on_delete=models.PROTECT,
        db_column="email_usuario", related_name="checkins"
    )
    data_checkin = models.DateField("data do check-in")
    estado_geral = models.CharField(max_length=20, choices=EstadoGeral.choices)
    # Obrigatória quando o estado não é BOM (regra aplicada no serializer)
    observacao = models.CharField(max_length=255, null=True, blank=True)
    leitura = models.OneToOneField(
        LeituraOdometro, verbose_name="leitura de odômetro", on_delete=models.PROTECT,
        db_column="codigo_leitura", related_name="checkin"
    )

    class Meta:
        db_table = "checkin"
        ordering = ["-data_checkin", "-id_checkin"]
        verbose_name = "check-in"
        # Um check-in por motorista, veículo e dia
        constraints = [
            models.UniqueConstraint(fields=["usuario", "veiculo", "data_checkin"],
                                    name="uq_checkin_usuario_veiculo_dia")
        ]

    def __str__(self):
        return f"Check-in {self.veiculo_id} - {self.usuario_id} em {self.data_checkin:%d/%m/%Y}"


class Problema(models.Model):
    """
    Aviso de problema feito pelo motorista (Sprint 5, tela "Avisar problema" do protótipo):
    onde está o problema, se o caminhão pode continuar rodando e, se quiser, uma explicação.
    Só o gestor muda a situação.
    """

    class Componente(models.TextChoices):
        FREIO = "FREIO", "Freio"
        MOTOR = "MOTOR", "Motor"
        PNEU = "PNEU", "Pneu"
        LUZES = "LUZES", "Luzes"
        GUINCHO = "GUINCHO", "Guincho"
        OUTRO = "OUTRO", "Outro"

    class Situacao(models.TextChoices):
        ABERTO = "ABERTO", "Aberto"              # motorista vê: "O responsável já recebeu"
        EM_ANALISE = "EM_ANALISE", "Em análise"  # motorista vê: "O responsável está vendo"
        RESOLVIDO = "RESOLVIDO", "Resolvido"

    id_problema = models.AutoField(primary_key=True)
    veiculo = models.ForeignKey(
        Veiculo, verbose_name="veículo", on_delete=models.PROTECT,
        db_column="placa_veiculo", related_name="problemas"
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="usuário", on_delete=models.PROTECT,
        db_column="email_usuario", related_name="problemas"
    )
    data_hora = models.DateTimeField("data e hora", auto_now_add=True)
    componente = models.CharField("onde está o problema", max_length=20, choices=Componente.choices)
    pode_rodar = models.BooleanField("o caminhão pode continuar rodando?")
    descricao = models.CharField("explicação", max_length=500, blank=True, default="")
    situacao = models.CharField(max_length=20, choices=Situacao.choices, default=Situacao.ABERTO)

    class Meta:
        db_table = "problema"
        ordering = ["-data_hora", "-id_problema"]
        verbose_name = "problema relatado"
        verbose_name_plural = "problemas relatados"

    def __str__(self):
        return f"{self.get_componente_display()} em {self.veiculo_id} - {self.get_situacao_display()}"


class CienciaAviso(models.Model):
    """
    "Entendi" do motorista num aviso de manutenção (tela "Avisos" do protótipo), para o
    gestor saber que ele viu. O aviso é identificado pelo plano e pela previsão (data e km):
    depois que a manutenção é feita, a próxima previsão é um aviso novo.
    """

    id_ciencia = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="usuário", on_delete=models.PROTECT,
        db_column="email_usuario", related_name="ciencias"
    )
    veiculo = models.ForeignKey(
        Veiculo, verbose_name="veículo", on_delete=models.PROTECT,
        db_column="placa_veiculo", related_name="ciencias"
    )
    plano = models.ForeignKey(
        PlanoManutencao, verbose_name="plano", on_delete=models.PROTECT,
        db_column="id_plano", related_name="ciencias"
    )
    referencia = models.CharField("previsão do aviso (data|km)", max_length=40)
    data_hora = models.DateTimeField("data e hora", auto_now_add=True)

    class Meta:
        db_table = "ciencia_aviso"
        verbose_name = "ciência de aviso"
        verbose_name_plural = "ciências de avisos"
        constraints = [
            models.UniqueConstraint(fields=["usuario", "veiculo", "plano", "referencia"],
                                    name="uq_ciencia_usuario_aviso")
        ]

    def __str__(self):
        return f"{self.usuario_id} viu {self.plano_id} em {self.veiculo_id}"
