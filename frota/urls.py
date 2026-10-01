from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.trailing_slash = "/?"  # aceita /api/veiculos e /api/veiculos/
router.register("motoristas", views.MotoristaViewSet, basename="motorista")
router.register("veiculos", views.VeiculoViewSet, basename="veiculo")
router.register("planos-manutencao", views.PlanoManutencaoViewSet, basename="plano")
router.register("leituras-odometro", views.LeituraOdometroViewSet, basename="leitura")
router.register("ordens-servico", views.OrdemServicoViewSet, basename="ordem")

urlpatterns = router.urls
