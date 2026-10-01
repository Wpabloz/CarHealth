"""
Serializers da frota: convertem os models em JSON (e o JSON de volta em models).

As chaves do JSON usam os nomes das colunas do banco:
cnpj_empresa, cpf_motorista, placa_veiculo, id_plano, email_emitente, email_aprovador.
"""
from django.db.models import Max
from rest_framework import serializers

from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo


class DaEmpresaField(serializers.PrimaryKeyRelatedField):
    """Campo de chave estrangeira que só aceita registros da empresa do usuário logado."""

    def __init__(self, caminho_empresa="empresa", **kwargs):
        self.caminho_empresa = caminho_empresa
        super().__init__(**kwargs)

    def get_queryset(self):
        empresa = self.context["request"].user.empresa
        return super().get_queryset().filter(**{self.caminho_empresa: empresa})


def chave_nao_muda(serializer, campo, valor):
    """No PUT/PATCH, impede trocar a chave primária (CPF, placa)."""
    if serializer.instance is not None and valor != getattr(serializer.instance, campo):
        raise serializers.ValidationError("Este campo não pode ser alterado.")
    return valor


class MotoristaSerializer(serializers.ModelSerializer):
    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)

    class Meta:
        model = Motorista
        fields = ["cpf", "nome", "telefone", "num_cnh", "validade_cnh", "cnpj_empresa"]

    def validate_cpf(self, valor):
        return chave_nao_muda(self, "cpf", valor)


class VeiculoSerializer(serializers.ModelSerializer):
    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)
    cpf_motorista = DaEmpresaField(
        source="motorista", queryset=Motorista.objects.all(), allow_null=True, required=False
    )
    km_atual = serializers.IntegerField(read_only=True)  # calculado pela última leitura

    class Meta:
        model = Veiculo
        fields = ["placa", "marca", "modelo", "ano", "tipo", "situacao",
                  "cpf_motorista", "cnpj_empresa", "km_atual"]

    def validate_placa(self, valor):
        valor = valor.upper().replace("-", "")
        return chave_nao_muda(self, "placa", valor)


class PlanoManutencaoSerializer(serializers.ModelSerializer):
    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)

    class Meta:
        model = PlanoManutencao
        fields = ["id_plano", "descricao", "tipo_veiculo", "intervalo_km",
                  "intervalo_meses", "cnpj_empresa"]

    def validate(self, dados):
        km = dados.get("intervalo_km", getattr(self.instance, "intervalo_km", None))
        meses = dados.get("intervalo_meses", getattr(self.instance, "intervalo_meses", None))
        if km is None and meses is None:
            raise serializers.ValidationError("Informe intervalo_km, intervalo_meses ou ambos.")
        return dados


class LeituraOdometroSerializer(serializers.ModelSerializer):
    placa_veiculo = DaEmpresaField(source="veiculo", queryset=Veiculo.objects.all())

    class Meta:
        model = LeituraOdometro
        fields = ["codigo", "placa_veiculo", "data_leitura", "quilometragem", "origem"]

    def validate(self, dados):
        """O odômetro nunca volta: a km não pode ser menor que a leitura anterior."""
        veiculo = dados.get("veiculo", getattr(self.instance, "veiculo", None))
        data = dados.get("data_leitura", getattr(self.instance, "data_leitura", None))
        km = dados.get("quilometragem", getattr(self.instance, "quilometragem", None))
        anterior = (
            veiculo.leituras.filter(data_leitura__lte=data)
            .exclude(pk=getattr(self.instance, "pk", None))
            .aggregate(maximo=Max("quilometragem"))["maximo"]
        )
        if anterior is not None and km < anterior:
            raise serializers.ValidationError(
                {"quilometragem": f"Menor que a última leitura registrada ({anterior} km)."}
            )
        return dados


class OrdemServicoSerializer(serializers.ModelSerializer):
    placa_veiculo = DaEmpresaField(source="veiculo", queryset=Veiculo.objects.all())
    id_plano = DaEmpresaField(
        source="plano", queryset=PlanoManutencao.objects.all(), allow_null=True, required=False
    )
    email_emitente = serializers.CharField(source="emitente_id", read_only=True)
    email_aprovador = serializers.CharField(source="aprovador_id", read_only=True)

    class Meta:
        model = OrdemServico
        fields = ["numero", "placa_veiculo", "id_plano", "descricao", "data_abertura",
                  "data_conclusao", "quilometragem", "status", "oficina", "valor",
                  "email_emitente", "email_aprovador"]

    def validate(self, dados):
        S = OrdemServico.Status
        status = dados.get("status", getattr(self.instance, "status", S.ABERTA))
        abertura = dados.get("data_abertura", getattr(self.instance, "data_abertura", None))
        conclusao = dados.get("data_conclusao", getattr(self.instance, "data_conclusao", None))
        aprovada = getattr(self.instance, "aprovador_id", None) is not None

        if status == S.APROVADA and not aprovada:
            raise serializers.ValidationError(
                {"status": "Para aprovar use POST /api/ordens-servico/{numero}/aprovar."})
        if status in (S.EM_EXECUCAO, S.CONCLUIDA) and not aprovada:
            raise serializers.ValidationError({"status": "A OS precisa ser aprovada antes."})
        if status == S.CONCLUIDA and not conclusao:
            raise serializers.ValidationError({"data_conclusao": "Informe a data de conclusão."})
        if conclusao and abertura and conclusao < abertura:
            raise serializers.ValidationError(
                {"data_conclusao": "A conclusão não pode ser antes da abertura."})
        return dados
