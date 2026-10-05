"""
Views (controllers) da frota.

Cada ViewSet já entrega as 5 operações do CRUD:
  GET    /api/<recurso>        lista
  POST   /api/<recurso>        cria
  GET    /api/<recurso>/<id>   mostra um
  PUT    /api/<recurso>/<id>   edita (PATCH edita só alguns campos)
  DELETE /api/<recurso>/<id>   exclui
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from contas.permissoes import SomenteGestor

from . import serializers
from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo


class DaEmpresaViewSet(viewsets.ModelViewSet):
    """
    Base de todos os CRUDs: o usuário só vê e altera dados da PRÓPRIA empresa.

    caminho_empresa: como chegar na empresa a partir do model
                     ("empresa" ou, para leituras/OS, "veiculo__empresa").
    filtros:         parâmetros aceitos na URL, ex.: /api/veiculos?situacao=ATIVO
    """

    caminho_empresa = "empresa"
    filtros = {}

    def get_queryset(self):
        qs = self.queryset.filter(**{self.caminho_empresa: self.request.user.empresa})
        for parametro, campo in self.filtros.items():
            valor = self.request.query_params.get(parametro)
            if valor:
                qs = qs.filter(**{campo: valor})
        return qs

    def perform_create(self, serializer):
        if self.caminho_empresa == "empresa":
            serializer.save(empresa=self.request.user.empresa)
        else:
            serializer.save()


class MotoristaViewSet(DaEmpresaViewSet):
    """CRUD dos motoristas da empresa: /api/motoristas"""
    queryset = Motorista.objects.all()
    serializer_class = serializers.MotoristaSerializer


class VeiculoViewSet(DaEmpresaViewSet):
    queryset = Veiculo.objects.all()
    serializer_class = serializers.VeiculoSerializer
    filtros = {"situacao": "situacao", "tipo": "tipo", "motorista": "motorista_id"}


class PlanoManutencaoViewSet(DaEmpresaViewSet):
    queryset = PlanoManutencao.objects.all()
    serializer_class = serializers.PlanoManutencaoSerializer
    filtros = {"tipo_veiculo": "tipo_veiculo"}


class LeituraOdometroViewSet(DaEmpresaViewSet):
    queryset = LeituraOdometro.objects.all()
    serializer_class = serializers.LeituraOdometroSerializer
    caminho_empresa = "veiculo__empresa"
    filtros = {"veiculo": "veiculo_id"}  # /api/leituras-odometro?veiculo=ABC1D23


class OrdemServicoViewSet(DaEmpresaViewSet):
    queryset = OrdemServico.objects.all()
    serializer_class = serializers.OrdemServicoSerializer
    caminho_empresa = "veiculo__empresa"
    filtros = {"veiculo": "veiculo_id", "status": "status"}  # histórico do veículo

    def perform_create(self, serializer):
        # quem abriu a OS é sempre o usuário logado
        serializer.save(emitente=self.request.user)

    @action(detail=True, methods=["post"], permission_classes=[SomenteGestor])
    def aprovar(self, request, pk=None):
        """POST /api/ordens-servico/<numero>/aprovar — só GESTOR."""
        ordem = self.get_object()
        if ordem.status != OrdemServico.Status.ABERTA:
            return Response(
                {"detail": "Só é possível aprovar uma OS com status ABERTA."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ordem.status = OrdemServico.Status.APROVADA
        ordem.aprovador = request.user
        ordem.save()
        return Response(self.get_serializer(ordem).data)
