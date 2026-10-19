"""
Views (controllers) da frota.

Cada ViewSet já entrega as 5 operações do CRUD:
  GET    /api/<recurso>        lista
  POST   /api/<recurso>        cria
  GET    /api/<recurso>/<id>   mostra um
  PUT    /api/<recurso>/<id>   edita (PATCH edita só alguns campos)
  DELETE /api/<recurso>/<id>   exclui (se tiver histórico, devolve 409: inative em vez de excluir)

Perfis (RN16): o GESTOR faz tudo; o MOTORISTA só o que estiver em acoes_motorista.
"""
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from contas.models import Empresa, Situacao
from contas.permissoes import PermissaoPorPerfil

from . import serializers
from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo


class DaEmpresaViewSet(viewsets.ModelViewSet):
    """
    Base de todos os CRUDs: o usuário só vê e altera dados da PRÓPRIA empresa (RN01).

    caminho_empresa:  como chegar na empresa a partir do model
                      ("empresa" ou, para leituras/OS, "veiculo__empresa").
    filtros:          parâmetros aceitos na URL, ex.: /api/veiculos?situacao=ATIVO
    acoes_motorista:  ações liberadas ao perfil MOTORISTA (o resto é só do GESTOR).
    filtro_motorista: o que o MOTORISTA enxerga, ex.: só veículos ativos.
    """

    permission_classes = [PermissaoPorPerfil]
    caminho_empresa = "empresa"
    filtros = {}
    acoes_motorista = ()
    filtro_motorista = {}

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # geração da documentação Swagger
            return self.queryset.none()
        usuario = self.request.user
        qs = self.queryset.filter(**{self.caminho_empresa: usuario.empresa})
        if usuario.is_motorista:
            qs = qs.filter(**self.filtro_motorista)
        for parametro, campo in self.filtros.items():
            valor = self.request.query_params.get(parametro)
            if valor:
                qs = qs.filter(**{campo: valor})
        return qs

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


class MotoristaViewSet(DaEmpresaViewSet):
    """CRUD dos motoristas da empresa: /api/motoristas (só GESTOR)"""
    queryset = Motorista.objects.select_related("usuario")
    serializer_class = serializers.MotoristaSerializer
    filtros = {"situacao": "situacao"}


class VeiculoViewSet(DaEmpresaViewSet):
    queryset = Veiculo.objects.all()
    serializer_class = serializers.VeiculoSerializer
    # ?placa=ABC busca por parte da placa (RF10, RF34)
    filtros = {"situacao": "situacao", "tipo": "tipo__iexact", "placa": "placa__icontains"}
    acoes_motorista = ("list", "retrieve")
    filtro_motorista = {"situacao": Situacao.ATIVO}  # o motorista só vê veículos ativos (RF34)

    @extend_schema(responses={200: {"type": "array", "items": {"type": "string"}}})
    @action(detail=False, methods=["get"])
    def tipos(self, request):
        """GET /api/veiculos/tipos — tipos já usados pela empresa, para sugerir no cadastro."""
        empresa = request.user.empresa
        tipos = set(Veiculo.objects.filter(empresa=empresa).values_list("tipo", flat=True))
        tipos |= set(PlanoManutencao.objects.filter(empresa=empresa).values_list("tipo_veiculo", flat=True))
        return Response(sorted(tipos))


class PlanoManutencaoViewSet(DaEmpresaViewSet):
    queryset = PlanoManutencao.objects.all()
    serializer_class = serializers.PlanoManutencaoSerializer
    filtros = {"tipo_veiculo": "tipo_veiculo__iexact", "situacao": "situacao"}


class LeituraOdometroViewSet(DaEmpresaViewSet):
    queryset = LeituraOdometro.objects.all()
    serializer_class = serializers.LeituraOdometroSerializer
    caminho_empresa = "veiculo__empresa"
    filtros = {"veiculo": "veiculo__placa__iexact"}  # /api/leituras-odometro?veiculo=ABC1D23
    acoes_motorista = ("list", "retrieve", "create")
    filtro_motorista = {"veiculo__situacao": Situacao.ATIVO}

    def perform_create(self, serializer):
        # a data é a de hoje e o responsável é quem está logado (RF12, RNF09)
        serializer.save(usuario=self.request.user, data_leitura=timezone.localdate())


class OrdemServicoViewSet(DaEmpresaViewSet):
    """
    /api/ordens-servico/{numero} — o número é sequencial dentro da empresa (RF23).
    Ciclo no MVP (RN11): ABERTA -> CONCLUIDA, ou ABERTA -> CANCELADA. Sem aprovação (RN12).
    Não há DELETE: a ordem é cancelada e o registro fica guardado (RF28).
    """

    queryset = OrdemServico.objects.all()
    serializer_class = serializers.OrdemServicoSerializer
    caminho_empresa = "veiculo__empresa"
    lookup_field = "numero"
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    filtros = {"veiculo": "veiculo__placa__iexact", "status": "status"}  # histórico do veículo
    acoes_motorista = ("list", "retrieve")
    # o motorista vê só o histórico (ordens concluídas) dos veículos ativos, sem valores (RF36)
    filtro_motorista = {"veiculo__situacao": Situacao.ATIVO, "status": OrdemServico.Status.CONCLUIDA}

    def perform_create(self, serializer):
        # Trava a linha da empresa: duas aberturas ao mesmo tempo não recebem o mesmo número
        empresa = Empresa.objects.select_for_update().get(pk=self.request.user.empresa_id)
        ultimo = OrdemServico.objects.filter(veiculo__empresa=empresa).aggregate(m=Max("numero"))["m"]
        serializer.save(emitente=self.request.user, numero=(ultimo or 0) + 1)

    @extend_schema(request=serializers.ConclusaoSerializer, responses=serializers.OrdemServicoSerializer)
    @action(detail=True, methods=["post"])
    def concluir(self, request, numero=None):
        """POST /api/ordens-servico/{numero}/concluir — grava a execução e gera a leitura (RN09)."""
        ordem = self.get_object()
        if ordem.status != OrdemServico.Status.ABERTA:
            return Response({"detail": "Só é possível concluir uma ordem ABERTA."},
                            status=status.HTTP_400_BAD_REQUEST)
        conclusao = serializers.ConclusaoSerializer(data=request.data, context={"ordem": ordem})
        conclusao.is_valid(raise_exception=True)

        with transaction.atomic():  # ou grava a ordem e a leitura, ou nenhuma das duas
            for campo, valor in conclusao.validated_data.items():
                setattr(ordem, campo, valor)
            ordem.status = OrdemServico.Status.CONCLUIDA
            ordem.save()
            LeituraOdometro.objects.create(
                veiculo=ordem.veiculo,
                data_leitura=ordem.data_conclusao,
                quilometragem=ordem.quilometragem,
                origem=LeituraOdometro.Origem.ORDEM_SERVICO,
                usuario=request.user,
            )
        return Response(self.get_serializer(ordem).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, numero=None):
        """POST /api/ordens-servico/{numero}/cancelar — só enquanto não estiver concluída (RF28)."""
        ordem = self.get_object()
        if ordem.status in (OrdemServico.Status.CONCLUIDA, OrdemServico.Status.CANCELADA):
            return Response({"detail": f"Esta ordem já está {ordem.get_status_display().lower()}."},
                            status=status.HTTP_400_BAD_REQUEST)
        ordem.status = OrdemServico.Status.CANCELADA
        ordem.save()
        return Response(self.get_serializer(ordem).data)
