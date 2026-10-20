from django.urls import path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from . import views

# O router cria sozinho as rotas de listar, ver, criar, editar e excluir
router = SimpleRouter()
router.trailing_slash = "/?"  # aceita /api/empresas e /api/empresas/
router.register("empresas", views.EmpresaViewSet, basename="empresa")
router.register("usuarios", views.UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("auth/registrar", views.RegistrarView.as_view(), name="registrar"),
    path("auth/login", TokenObtainPairView.as_view(), name="login"),      # e-mail + senha -> token
    path("auth/refresh", TokenRefreshView.as_view(), name="refresh"),     # renova o token (e troca o refresh)
    path("auth/sair", TokenBlacklistView.as_view(), name="sair"),         # revoga o refresh
    path("auth/me", views.MeView.as_view(), name="me"),
    path("auth/senha", views.TrocarSenhaView.as_view(), name="trocar-senha"),
    *router.urls,
]
