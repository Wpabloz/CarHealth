"""
Serializers da frota: convertem os models em JSON (e o JSON de volta em models).

As chaves do JSON usam os nomes das colunas do banco:
cnpj_empresa, placa_veiculo, id_plano, email_usuario, email_emitente, email_aprovador.
"""
from decimal import Decimal

from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from contas.models import Situacao, Usuario
from contas.serializers import DaEmpresaField, chave_nao_muda

from .manutencao import SituacaoManutencao
from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo


def formatar_km(valor):
    """91200 -> "91.200 km", como o usuário lê no painel do veículo."""
    return f"{valor:,} km".replace(",", ".")


class OcultaDoMotorista:
    """Tira da resposta os campos que o perfil MOTORISTA não pode ver (RN16)."""

    ocultos_do_motorista = ()

    def to_representation(self, instancia):
        dados = super().to_representation(instancia)
        request = self.context.get("request")
        if request and getattr(request.user, "is_motorista", False):
            for campo in self.ocultos_do_motorista:
                dados.pop(campo, None)
        return dados


class MotoristaSerializer(serializers.ModelSerializer):
    """
    Cadastro do motorista. Para liberar o acesso dele ao sistema já no cadastro (RF33),
    envie também email_acesso e senha_inicial: a conta de perfil MOTORISTA é criada junto.
    """

    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)
    num_cnh = serializers.CharField(
        max_length=11,
        validators=[UniqueValidator(Motorista.objects.all(), "Já existe um motorista com esta CNH.")],
    )
    cnh_vencida = serializers.SerializerMethodField()  # só sinaliza, não impede a operação (RF11)
    email_acesso = serializers.EmailField(max_length=120, required=False, write_only=True)
    senha_inicial = serializers.CharField(required=False, write_only=True, validators=[validate_password])

    class Meta:
        model = Motorista
        fields = ["cpf", "nome", "telefone", "num_cnh", "validade_cnh", "situacao", "cnh_vencida",
                  "email_acesso", "senha_inicial", "cnpj_empresa"]

    def get_cnh_vencida(self, motorista) -> bool:
        return motorista.validade_cnh < timezone.localdate()

    def validate_cpf(self, valor):
        return chave_nao_muda(self, "cpf", valor)

    def validate(self, dados):
        email, senha = dados.pop("email_acesso", None), dados.pop("senha_inicial", None)
        self.acesso = None
        if email or senha:
            if not (email and senha):
                raise serializers.ValidationError(
                    "Para liberar o acesso, informe email_acesso e senha_inicial juntos.")
            if self.instance is not None and hasattr(self.instance, "usuario"):
                raise serializers.ValidationError(
                    {"email_acesso": "Este motorista já tem conta de acesso. Altere-a em /api/usuarios."})
            email = email.lower()
            if Usuario.objects.filter(email=email).exists():
                raise serializers.ValidationError({"email_acesso": "Já existe um usuário com este e-mail."})
            self.acesso = (email, senha)
        return dados

    def save(self, **kwargs):
        motorista = super().save(**kwargs)
        if self.acesso:
            email, senha = self.acesso
            Usuario.objects.create_user(email, senha, perfil=Usuario.Perfil.MOTORISTA,
                                        empresa=motorista.empresa, motorista=motorista)
        return motorista

    def to_representation(self, motorista):
        dados = super().to_representation(motorista)
        conta = getattr(motorista, "usuario", None)
        dados["email_acesso"] = conta.email if conta else None
        return dados


class VeiculoSerializer(serializers.ModelSerializer):
    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)
    km_atual = serializers.IntegerField(read_only=True, allow_null=True)  # null = "sem registro"
    # Só no cadastro: vira a primeira leitura de odômetro, em nome de quem cadastrou
    quilometragem_inicial = serializers.IntegerField(write_only=True, required=False, min_value=0)

    class Meta:
        model = Veiculo
        fields = ["placa", "identificacao", "marca", "modelo", "ano", "tipo", "situacao", "observacoes",
                  "cnpj_empresa", "km_atual", "quilometragem_inicial"]

    def create(self, dados):
        km = dados.pop("quilometragem_inicial", None)
        veiculo = super().create(dados)
        if km is not None:
            LeituraOdometro.objects.create(veiculo=veiculo, quilometragem=km, data_leitura=timezone.localdate(),
                                           usuario=self.context["request"].user)
        return veiculo

    def update(self, veiculo, dados):
        dados.pop("quilometragem_inicial", None)  # depois do cadastro, a km muda só por leitura
        return super().update(veiculo, dados)

    def validate_placa(self, valor):
        valor = valor.upper().replace("-", "")
        return chave_nao_muda(self, "placa", valor)

    def validate_tipo(self, valor):
        return valor.strip().upper()

    def validate_identificacao(self, valor):
        return (valor or "").strip() or None


class PlanoManutencaoSerializer(serializers.ModelSerializer):
    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)

    class Meta:
        model = PlanoManutencao
        fields = ["id_plano", "descricao", "tipo_veiculo", "intervalo_km",
                  "intervalo_meses", "situacao", "cnpj_empresa"]

    def validate_tipo_veiculo(self, valor):
        return valor.strip().upper()

    def validate(self, dados):
        km = dados.get("intervalo_km", getattr(self.instance, "intervalo_km", None))
        meses = dados.get("intervalo_meses", getattr(self.instance, "intervalo_meses", None))
        if km is None and meses is None:
            raise serializers.ValidationError("Informe intervalo_km, intervalo_meses ou ambos.")
        return dados


class LeituraOdometroSerializer(OcultaDoMotorista, serializers.ModelSerializer):
    """
    Basta informar placa_veiculo e quilometragem: a data é a de hoje e o usuário
    é quem está logado (RF12). A origem ORDEM_SERVICO só é gerada pelo sistema.
    """

    Origem = LeituraOdometro.Origem

    placa_veiculo = DaEmpresaField(source="veiculo", queryset=Veiculo.objects.all())
    origem = serializers.ChoiceField(
        choices=[Origem.MANUAL, Origem.AJUSTE_ODOMETRO], default=Origem.MANUAL,
        help_text="MANUAL ou AJUSTE_ODOMETRO (troca/zeragem do odômetro, só GESTOR).",
    )
    email_usuario = serializers.CharField(source="usuario_id", read_only=True)
    ocultos_do_motorista = ["email_usuario"]  # o motorista não vê quem lançou cada leitura (RF36)

    class Meta:
        model = LeituraOdometro
        fields = ["codigo", "placa_veiculo", "data_leitura", "quilometragem", "origem", "email_usuario"]
        read_only_fields = ["data_leitura"]

    def validate(self, dados):
        usuario = self.context["request"].user
        veiculo = dados.get("veiculo", getattr(self.instance, "veiculo", None))
        km = dados.get("quilometragem", getattr(self.instance, "quilometragem", None))
        origem = dados.get("origem", getattr(self.instance, "origem", self.Origem.MANUAL))

        if usuario.is_motorista:
            if origem == self.Origem.AJUSTE_ODOMETRO:
                raise serializers.ValidationError(
                    {"origem": "O ajuste de odômetro só pode ser lançado pelo GESTOR."})
            if veiculo.situacao != Situacao.ATIVO:
                raise serializers.ValidationError({"placa_veiculo": "Este veículo está inativo."})

        # O odômetro só avança (RN03): compara com a última leitura, na ordem de registro
        anteriores = veiculo.leituras.order_by("-codigo")
        if self.instance is not None:
            anteriores = anteriores.filter(codigo__lt=self.instance.codigo)
        anterior = anteriores.first()
        if anterior and km < anterior.quilometragem and origem != self.Origem.AJUSTE_ODOMETRO:
            dica = (" Confira o valor ou avise o gestor." if usuario.is_motorista
                    else " Em troca ou zeragem do odômetro, use a origem AJUSTE_ODOMETRO.")
            raise serializers.ValidationError({"quilometragem":
                f"Menor que a última leitura registrada ({formatar_km(anterior.quilometragem)}).{dica}"})
        return dados


class OrdemServicoSerializer(OcultaDoMotorista, serializers.ModelSerializer):
    """
    Abertura e edição da ordem. O número é gerado na abertura (sequencial por empresa)
    e o status só muda pelas ações concluir e cancelar (RN11).
    """

    placa_veiculo = DaEmpresaField(source="veiculo", queryset=Veiculo.objects.all())
    id_plano = DaEmpresaField(
        source="plano", queryset=PlanoManutencao.objects.all(), allow_null=True, required=False,
        help_text="Plano executado (ordem preventiva). Deixe vazio em ordem corretiva (RN10).",
    )
    email_emitente = serializers.CharField(source="emitente_id", read_only=True)
    email_aprovador = serializers.CharField(source="aprovador_id", read_only=True)
    ocultos_do_motorista = ["valor"]  # o motorista não vê os valores pagos (RN16)

    class Meta:
        model = OrdemServico
        fields = ["numero", "placa_veiculo", "id_plano", "descricao", "data_abertura",
                  "data_conclusao", "quilometragem", "status", "oficina", "valor",
                  "email_emitente", "email_aprovador"]
        read_only_fields = ["numero", "data_conclusao", "quilometragem", "status", "valor"]
        extra_kwargs = {"data_abertura": {"required": False}}  # sem data, vale a de hoje

    def validate(self, dados):
        if self.instance is not None and self.instance.status != OrdemServico.Status.ABERTA:
            raise serializers.ValidationError("Só é possível editar uma ordem ABERTA.")
        if self.instance is None:
            dados.setdefault("data_abertura", timezone.localdate())

        veiculo = dados.get("veiculo", getattr(self.instance, "veiculo", None))
        plano = dados["plano"] if "plano" in dados else getattr(self.instance, "plano", None)
        if plano is not None:
            if "plano" in dados and plano.situacao != Situacao.ATIVO:
                raise serializers.ValidationError({"id_plano": "Este plano está inativo."})
            if plano.tipo_veiculo != veiculo.tipo:
                raise serializers.ValidationError({"id_plano":
                    f"O plano é para veículos do tipo {plano.tipo_veiculo}, "
                    f"e o veículo {veiculo.placa} é do tipo {veiculo.tipo}."})
        return dados


class ConclusaoSerializer(serializers.Serializer):
    """POST /concluir: data, quilometragem e valor são obrigatórios (RN11, RF26)."""

    data_conclusao = serializers.DateField()
    quilometragem = serializers.IntegerField(min_value=0)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    oficina = serializers.CharField(max_length=120, required=False, allow_blank=True, allow_null=True)

    def validate(self, dados):
        ordem = self.context["ordem"]
        if ordem is None:  # a abertura já foi recusada; só os campos são conferidos
            return dados
        if dados["data_conclusao"] < ordem.data_abertura:
            raise serializers.ValidationError(
                {"data_conclusao": "A conclusão não pode ser antes da abertura."})
        ultima = ordem.veiculo.ultima_leitura
        if ultima and dados["quilometragem"] < ultima.quilometragem:
            raise serializers.ValidationError({"quilometragem":
                f"Menor que a última leitura registrada ({formatar_km(ultima.quilometragem)})."})
        return dados


class RealizadaSerializer(serializers.Serializer):
    """Corpo de POST /ordens-servico/realizada (documentação): dados da ordem e da conclusão juntos."""

    placa_veiculo = serializers.CharField()
    id_plano = serializers.IntegerField(required=False, allow_null=True)
    descricao = serializers.CharField(max_length=255)
    oficina = serializers.CharField(max_length=120, required=False, allow_blank=True, allow_null=True)
    data_conclusao = serializers.DateField()
    quilometragem = serializers.IntegerField(min_value=0)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))


# ---------------------------------------------------------------------------
# Situação de manutenção (somente leitura): descrevem as respostas calculadas
# em frota/manutencao.py, para a documentação do Swagger.
# ---------------------------------------------------------------------------
class ExecucaoSerializer(serializers.Serializer):
    numero = serializers.IntegerField(help_text="Número da ordem concluída que serve de base.")
    data = serializers.DateField()
    quilometragem = serializers.IntegerField(allow_null=True)


class SituacaoPlanoSerializer(serializers.Serializer):
    id_plano = serializers.IntegerField()
    descricao = serializers.CharField()
    intervalo_km = serializers.IntegerField(allow_null=True)
    intervalo_meses = serializers.IntegerField(allow_null=True)
    ultima_execucao = ExecucaoSerializer(allow_null=True)
    km_previsto = serializers.IntegerField(allow_null=True)
    km_restante = serializers.IntegerField(allow_null=True, help_text="Negativo = passou da km prevista.")
    data_prevista = serializers.DateField(allow_null=True)
    dias_restantes = serializers.IntegerField(allow_null=True, help_text="Negativo = passou da data prevista.")
    situacao = serializers.ChoiceField(choices=SituacaoManutencao.choices)


class SituacaoVeiculoSerializer(serializers.Serializer):
    placa = serializers.CharField()
    identificacao = serializers.CharField(allow_null=True)
    marca = serializers.CharField()
    modelo = serializers.CharField()
    tipo = serializers.CharField()
    observacoes = serializers.CharField(allow_null=True)
    km_atual = serializers.IntegerField(allow_null=True)
    situacao = serializers.ChoiceField(choices=SituacaoManutencao.choices, help_text="A pior entre os planos.")
    planos = SituacaoPlanoSerializer(many=True)


class PendenciaSerializer(SituacaoPlanoSerializer):
    placa = serializers.CharField()
    identificacao = serializers.CharField(allow_null=True)
    marca = serializers.CharField()
    modelo = serializers.CharField()
    km_atual = serializers.IntegerField(allow_null=True)


class PainelSerializer(serializers.Serializer):
    contagem = serializers.DictField(child=serializers.IntegerField(),
                                     help_text="Veículos ativos por situação; cada veículo conta uma vez.")
    pendencias = PendenciaSerializer(many=True, help_text="Vencidas primeiro, depois as próximas.")
    veiculos = SituacaoVeiculoSerializer(many=True, help_text="Cada veículo ativo, com a situação dos seus planos.")
    realizadas_no_mes = serializers.IntegerField(help_text="Ordens concluídas no mês atual.")
    tolerancia = serializers.DictField(child=serializers.IntegerField(),
                                       help_text='Faixa de "próxima do vencimento": {"km": 1000, "dias": 30}.')
