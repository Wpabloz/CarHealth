from django.contrib.auth.views import LogoutView
from django.urls import path

from . import views

app_name = "contas"

urlpatterns = [
    path("login/", views.Entrar.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("cadastro/", views.CadastroEmpresa.as_view(), name="cadastro"),
    path("usuarios/", views.UsuarioLista.as_view(), name="usuarios"),
    path("usuarios/novo/", views.UsuarioNovo.as_view(), name="usuario_novo"),
    path("usuarios/<str:pk>/excluir/", views.UsuarioExcluir.as_view(), name="usuario_excluir"),
]
