from django.urls import include, path

urlpatterns = [
    path("contas/", include("contas.urls")),
    path("", include("frota.urls")),
]
