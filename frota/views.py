from datetime import timedelta

from django import forms as dj_forms
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import ProtectedError, Q
from django.shortcuts import redirect
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views.generic import CreateView, DeleteView, ListView, TemplateView, UpdateView

from . import forms
from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo


# ---------------------------------------------------------------------------
# Classes-base reutilizadas por todos os CRUDs
# ---------------------------------------------------------------------------
class DaEmpresaMixin(LoginRequiredMixin):
    """Garante que o usuário só enxergue/altere dados da própria empresa."""

    model = None
    filtro_empresa = "empresa"  # caminho até a empresa (ex.: "veiculo__empresa")
    rota = None  # prefixo do nome das URLs (ex.: "motorista")

    def get_queryset(self):
        return self.model.objects.filter(**{self.filtro_empresa: self.request.user.empresa})

    def get_success_url(self):
        return reverse(f"frota:{self.rota}_lista")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["voltar"] = reverse(f"frota:{self.rota}_lista")
        return ctx


class Lista(DaEmpresaMixin, ListView):
    template_name = "frota/lista.html"
    paginate_by = 20
    colunas = []  # [(titulo, campo)]
    campos_busca = []
    titulo = ""

    def get_queryset(self):
        qs = super().get_queryset()
        termo = self.request.GET.get("q", "").strip()
        if termo and self.campos_busca:
            filtro = Q()
            for campo in self.campos_busca:
                filtro |= Q(**{f"{campo}__icontains": termo})
            qs = qs.filter(filtro)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            titulo=self.titulo,
            colunas=self.colunas,
            rota=self.rota,
            busca=bool(self.campos_busca),
            q=self.request.GET.get("q", ""),
        )
        return ctx


class FormularioMixin(DaEmpresaMixin):
    template_name = "form.html"
    titulo = ""

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs.update(empresa=self.request.user.empresa, usuario=self.request.user)
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["titulo"] = self.titulo
        return ctx

    def form_valid(self, form):
        if hasattr(form.instance, "empresa_id") and not form.instance.empresa_id:
            form.instance.empresa = self.request.user.empresa
        messages.success(self.request, "Registro salvo com sucesso.")
        return super().form_valid(form)


class Novo(FormularioMixin, CreateView):
    pass


class Editar(FormularioMixin, UpdateView):
    pass


class Excluir(DaEmpresaMixin, DeleteView):
    template_name = "confirmar_exclusao.html"

    def get_form_class(self):
        return dj_forms.Form  # a exclusão só confirma; não usa o formulário do cadastro

    def form_valid(self, form):
        try:
            resposta = super().form_valid(form)
            messages.success(self.request, "Registro excluído.")
            return resposta
        except ProtectedError:
            messages.error(
                self.request,
                "Não é possível excluir: existem registros vinculados a este item.",
            )
            return redirect(self.get_success_url())


# ---------------------------------------------------------------------------
# Painel
# ---------------------------------------------------------------------------
class Dashboard(LoginRequiredMixin, TemplateView):
    template_name = "frota/dashboard.html"

    def get_context_data(self, **kwargs):
        empresa = self.request.user.empresa
        hoje = timezone.localdate()
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            total_veiculos=empresa.veiculos.count(),
            total_motoristas=empresa.motoristas.count(),
            veiculos_manutencao=empresa.veiculos.filter(situacao=Veiculo.Situacao.MANUTENCAO).count(),
            os_pendentes=OrdemServico.objects.filter(
                veiculo__empresa=empresa,
                status__in=[OrdemServico.Status.ABERTA, OrdemServico.Status.APROVADA,
                            OrdemServico.Status.EM_EXECUCAO],
            ).select_related("veiculo")[:10],
            cnh_vencendo=empresa.motoristas.filter(
                validade_cnh__lte=hoje + timedelta(days=30)
            ).order_by("validade_cnh"),
            hoje=hoje,
        )
        return ctx


# ---------------------------------------------------------------------------
# Motoristas
# ---------------------------------------------------------------------------
class MotoristaConfig:
    model = Motorista
    form_class = forms.MotoristaForm
    rota = "motorista"


class MotoristaLista(MotoristaConfig, Lista):
    titulo = "Motoristas"
    colunas = [("CPF", "cpf"), ("Nome", "nome"), ("Telefone", "telefone"),
               ("CNH", "num_cnh"), ("Validade CNH", "validade_cnh")]
    campos_busca = ["nome", "cpf", "num_cnh"]


class MotoristaNovo(MotoristaConfig, Novo):
    titulo = "Novo motorista"


class MotoristaEditar(MotoristaConfig, Editar):
    titulo = "Editar motorista"


class MotoristaExcluir(MotoristaConfig, Excluir):
    pass


# ---------------------------------------------------------------------------
# Veículos
# ---------------------------------------------------------------------------
class VeiculoConfig:
    model = Veiculo
    form_class = forms.VeiculoForm
    rota = "veiculo"


class VeiculoLista(VeiculoConfig, Lista):
    titulo = "Veículos"
    colunas = [("Placa", "placa"), ("Marca", "marca"), ("Modelo", "modelo"), ("Ano", "ano"),
               ("Tipo", "tipo"), ("Situação", "situacao"), ("Motorista", "motorista"),
               ("Km atual", "km_atual")]
    campos_busca = ["placa", "marca", "modelo", "motorista__nome"]

    def get_queryset(self):
        return super().get_queryset().select_related("motorista")


class VeiculoNovo(VeiculoConfig, Novo):
    titulo = "Novo veículo"


class VeiculoEditar(VeiculoConfig, Editar):
    titulo = "Editar veículo"


class VeiculoExcluir(VeiculoConfig, Excluir):
    pass


# ---------------------------------------------------------------------------
# Planos de manutenção
# ---------------------------------------------------------------------------
class PlanoConfig:
    model = PlanoManutencao
    form_class = forms.PlanoManutencaoForm
    rota = "plano"


class PlanoLista(PlanoConfig, Lista):
    titulo = "Planos de manutenção"
    colunas = [("Descrição", "descricao"), ("Tipo de veículo", "tipo_veiculo"),
               ("A cada (km)", "intervalo_km"), ("A cada (meses)", "intervalo_meses")]
    campos_busca = ["descricao"]


class PlanoNovo(PlanoConfig, Novo):
    titulo = "Novo plano de manutenção"


class PlanoEditar(PlanoConfig, Editar):
    titulo = "Editar plano de manutenção"


class PlanoExcluir(PlanoConfig, Excluir):
    pass


# ---------------------------------------------------------------------------
# Leituras de odômetro
# ---------------------------------------------------------------------------
class LeituraConfig:
    model = LeituraOdometro
    form_class = forms.LeituraOdometroForm
    rota = "leitura"
    filtro_empresa = "veiculo__empresa"


class LeituraLista(LeituraConfig, Lista):
    titulo = "Leituras de odômetro"
    colunas = [("Código", "codigo"), ("Veículo", "veiculo_id"), ("Data", "data_leitura"),
               ("Quilometragem", "quilometragem"), ("Origem", "origem")]
    campos_busca = ["veiculo__placa"]


class LeituraNovo(LeituraConfig, Novo):
    titulo = "Nova leitura de odômetro"


class LeituraEditar(LeituraConfig, Editar):
    titulo = "Editar leitura de odômetro"


class LeituraExcluir(LeituraConfig, Excluir):
    pass


# ---------------------------------------------------------------------------
# Ordens de serviço
# ---------------------------------------------------------------------------
class OrdemConfig:
    model = OrdemServico
    form_class = forms.OrdemServicoForm
    rota = "ordem"
    filtro_empresa = "veiculo__empresa"


class OrdemLista(OrdemConfig, Lista):
    titulo = "Ordens de serviço"
    colunas = [("Nº", "numero"), ("Veículo", "veiculo_id"), ("Descrição", "descricao"),
               ("Abertura", "data_abertura"), ("Status", "status"), ("Valor (R$)", "valor"),
               ("Emitente", "emitente"), ("Aprovador", "aprovador")]
    campos_busca = ["veiculo__placa", "descricao", "oficina"]

    def get_queryset(self):
        return super().get_queryset().select_related("emitente", "aprovador")


class OrdemSalvarMixin:
    @transaction.atomic
    def form_valid(self, form):
        os_ = form.instance
        if not os_.emitente_id:
            os_.emitente = self.request.user
        if os_.status not in (OrdemServico.Status.ABERTA, OrdemServico.Status.CANCELADA) \
                and not os_.aprovador_id:
            os_.aprovador = self.request.user  # o form já garantiu que é Gestor
        resposta = super().form_valid(form)
        # Ao concluir com km informado, registra automaticamente a leitura do odômetro
        if os_.status == OrdemServico.Status.CONCLUIDA and os_.quilometragem is not None:
            LeituraOdometro.objects.get_or_create(
                veiculo=os_.veiculo,
                data_leitura=os_.data_conclusao,
                quilometragem=os_.quilometragem,
                defaults={"origem": LeituraOdometro.Origem.ORDEM_SERVICO},
            )
        return resposta


class OrdemNovo(OrdemConfig, OrdemSalvarMixin, Novo):
    titulo = "Nova ordem de serviço"
    initial = {"data_abertura": timezone.localdate}


class OrdemEditar(OrdemConfig, OrdemSalvarMixin, Editar):
    titulo = "Editar ordem de serviço"


class OrdemExcluir(OrdemConfig, Excluir):
    pass
