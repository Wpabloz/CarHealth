"""Rotas principais. Tudo da API fica abaixo de /api/."""
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("", RedirectView.as_view(url="/api/docs")),  # o endereço principal abre a documentação
    path("api/", include("contas.urls")),   # /api/auth/..., /api/empresas, /api/usuarios
    path("api/", include("frota.urls")),    # /api/veiculos, /api/motoristas, ...
    # Documentação interativa (Swagger) — ótimo para mostrar ao professor
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
