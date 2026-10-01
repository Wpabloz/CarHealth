from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.views import LoginView
from django.db.models import ProtectedError
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, ListView

from .forms import CadastroEmpresaForm, LoginForm, UsuarioForm
from .models import Admin


class Entrar(LoginView):
    template_name = "contas/login.html"
    authentication_form = LoginForm
    redirect_authenticated_user = True


class CadastroEmpresa(CreateView):
    template_name = "contas/cadastro.html"
    form_class = CadastroEmpresaForm

    def form_valid(self, form):
        empresa = form.save()
        gestor = empresa.admins.get()
        login(self.request, gestor, backend="django.contrib.auth.backends.ModelBackend")
        messages.success(self.request, f"Empresa {empresa} cadastrada. Bem-vindo(a)!")
        return redirect("frota:dashboard")


class SomenteGestorMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_gestor


class UsuarioLista(SomenteGestorMixin, ListView):
    template_name = "contas/usuario_lista.html"
    context_object_name = "usuarios"

    def get_queryset(self):
        return Admin.objects.filter(empresa=self.request.user.empresa)


class UsuarioNovo(SomenteGestorMixin, CreateView):
    template_name = "form.html"
    form_class = UsuarioForm
    success_url = reverse_lazy("contas:usuarios")
    extra_context = {"titulo": "Novo usuário", "voltar": reverse_lazy("contas:usuarios")}

    def form_valid(self, form):
        form.instance.empresa = self.request.user.empresa
        messages.success(self.request, "Usuário criado.")
        return super().form_valid(form)


class UsuarioExcluir(SomenteGestorMixin, DeleteView):
    template_name = "confirmar_exclusao.html"
    success_url = reverse_lazy("contas:usuarios")

    def get_queryset(self):
        return Admin.objects.filter(empresa=self.request.user.empresa).exclude(
            pk=self.request.user.pk
        )

    def form_valid(self, form):
        try:
            return super().form_valid(form)
        except ProtectedError:
            messages.error(self.request, "Usuário possui ordens de serviço e não pode ser excluído.")
            return redirect(self.success_url)
