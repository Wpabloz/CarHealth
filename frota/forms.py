from django import forms
from django.db.models import Max

from contas.validators import somente_digitos

from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo

DATA = forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d")


class EmpresaForm(forms.ModelForm):
    """Recebe a empresa do usuário logado e restringe as opções a ela."""

    def __init__(self, *args, empresa, usuario=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.empresa = empresa
        self.usuario = usuario
        # A chave primária não pode ser alterada depois de criada
        pk_nome = self._meta.model._meta.pk.name
        if self.instance._state.adding is False and pk_nome in self.fields:
            self.fields[pk_nome].disabled = True


class MotoristaForm(EmpresaForm):
    cpf = forms.CharField(label="CPF", max_length=14, help_text="Pode digitar com ou sem pontuação.")

    class Meta:
        model = Motorista
        fields = ["cpf", "nome", "telefone", "num_cnh", "validade_cnh"]
        widgets = {"validade_cnh": DATA}

    def clean_cpf(self):
        return somente_digitos(self.cleaned_data["cpf"])


class VeiculoForm(EmpresaForm):
    class Meta:
        model = Veiculo
        fields = ["placa", "marca", "modelo", "ano", "tipo", "situacao", "motorista"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorista"].queryset = Motorista.objects.filter(empresa=self.empresa)

    def clean_placa(self):
        return self.cleaned_data["placa"].upper().replace("-", "")


class PlanoManutencaoForm(EmpresaForm):
    class Meta:
        model = PlanoManutencao
        fields = ["descricao", "tipo_veiculo", "intervalo_km", "intervalo_meses"]

    def clean(self):
        dados = super().clean()
        if not dados.get("intervalo_km") and not dados.get("intervalo_meses"):
            raise forms.ValidationError("Informe o intervalo em km, em meses ou ambos.")
        return dados


class LeituraOdometroForm(EmpresaForm):
    class Meta:
        model = LeituraOdometro
        fields = ["veiculo", "data_leitura", "quilometragem", "origem"]
        widgets = {"data_leitura": DATA}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["veiculo"].queryset = Veiculo.objects.filter(empresa=self.empresa)

    def clean(self):
        dados = super().clean()
        veiculo, data, km = dados.get("veiculo"), dados.get("data_leitura"), dados.get("quilometragem")
        if veiculo and data and km is not None:
            anterior = (
                veiculo.leituras.filter(data_leitura__lte=data)
                .exclude(pk=self.instance.pk)
                .aggregate(maximo=Max("quilometragem"))["maximo"]
            )
            if anterior is not None and km < anterior:
                self.add_error(
                    "quilometragem",
                    f"Quilometragem menor que a última leitura registrada ({anterior} km).",
                )
        return dados


class OrdemServicoForm(EmpresaForm):
    class Meta:
        model = OrdemServico
        fields = [
            "veiculo", "plano", "descricao", "data_abertura", "quilometragem",
            "oficina", "valor", "status", "data_conclusao",
        ]
        widgets = {"data_abertura": DATA, "data_conclusao": DATA}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["veiculo"].queryset = Veiculo.objects.filter(empresa=self.empresa)
        self.fields["plano"].queryset = PlanoManutencao.objects.filter(empresa=self.empresa)

    def clean(self):
        dados = super().clean()
        status, veiculo, plano = dados.get("status"), dados.get("veiculo"), dados.get("plano")
        S = OrdemServico.Status

        if veiculo and plano and plano.tipo_veiculo != veiculo.tipo:
            self.add_error("plano", "O plano não é do mesmo tipo do veículo.")

        # Somente Gestor aprova: qualquer status além de "Aberta"/"Cancelada" exige aprovação
        precisa_aprovacao = status in (S.APROVADA, S.EM_EXECUCAO, S.CONCLUIDA)
        if precisa_aprovacao and not self.instance.aprovador_id and not self.usuario.is_gestor:
            self.add_error("status", "Somente um Gestor pode aprovar a ordem de serviço.")

        if status == S.CONCLUIDA and not dados.get("data_conclusao"):
            self.add_error("data_conclusao", "Informe a data de conclusão.")
        if status != S.CONCLUIDA and dados.get("data_conclusao"):
            self.add_error("data_conclusao", "Só preencha a conclusão quando a OS estiver concluída.")
        if (
            dados.get("data_conclusao") and dados.get("data_abertura")
            and dados["data_conclusao"] < dados["data_abertura"]
        ):
            self.add_error("data_conclusao", "A conclusão não pode ser antes da abertura.")
        return dados
