from django.urls import path

from . import views

app_name = "frota"


def crud(prefixo, rota, lista, novo, editar, excluir, conversor="str"):
    return [
        path(f"{prefixo}/", lista.as_view(), name=f"{rota}_lista"),
        path(f"{prefixo}/novo/", novo.as_view(), name=f"{rota}_novo"),
        path(f"{prefixo}/<{conversor}:pk>/editar/", editar.as_view(), name=f"{rota}_editar"),
        path(f"{prefixo}/<{conversor}:pk>/excluir/", excluir.as_view(), name=f"{rota}_excluir"),
    ]


urlpatterns = [
    path("", views.Dashboard.as_view(), name="dashboard"),
    *crud("motoristas", "motorista", views.MotoristaLista, views.MotoristaNovo,
          views.MotoristaEditar, views.MotoristaExcluir),
    *crud("veiculos", "veiculo", views.VeiculoLista, views.VeiculoNovo,
          views.VeiculoEditar, views.VeiculoExcluir),
    *crud("planos", "plano", views.PlanoLista, views.PlanoNovo,
          views.PlanoEditar, views.PlanoExcluir, "int"),
    *crud("leituras", "leitura", views.LeituraLista, views.LeituraNovo,
          views.LeituraEditar, views.LeituraExcluir, "int"),
    *crud("ordens", "ordem", views.OrdemLista, views.OrdemNovo,
          views.OrdemEditar, views.OrdemExcluir, "int"),
]
