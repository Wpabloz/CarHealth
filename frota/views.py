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
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from contas.models import Empresa, Situacao
from contas.permissoes import PermissaoPorPerfil, SomenteGestor

from . import manutencao, serializers
from .models import ORDEM_DOS_VEICULOS, LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo


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
    queryset = Veiculo.objects.order_by(*ORDEM_DOS_VEICULOS)
    serializer_class = serializers.VeiculoSerializer
    # ?placa=ABC busca por parte da placa (RF10, RF34)
    filtros = {"situacao": "situacao", "tipo": "tipo__iexact", "placa": "placa__icontains"}
    acoes_motorista = ("list", "retrieve", "situacao")
    filtro_motorista = {"situacao": Situacao.ATIVO}  # o motorista só vê veículos ativos (RF34)

    @extend_schema(responses=serializers.SituacaoVeiculoSerializer)
    @action(detail=True, methods=["get"])
    def situacao(self, request, pk=None):
        """GET /api/veiculos/{placa}/situacao — situação de cada manutenção prevista (RF19, RF20)."""
        veiculo = self.get_object()
        dados = manutencao.calcular(request.user.empresa, Veiculo.objects.filter(pk=veiculo.pk))[0]
        return Response(serializers.SituacaoVeiculoSerializer(dados).data)

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

    def proximo_numero(self):
        # Trava a linha da empresa: duas aberturas ao mesmo tempo não recebem o mesmo número
        empresa = Empresa.objects.select_for_update().get(pk=self.request.user.empresa_id)
        ultimo = OrdemServico.objects.filter(veiculo__empresa=empresa).aggregate(m=Max("numero"))["m"]
        return (ultimo or 0) + 1

    def perform_create(self, serializer):
        serializer.save(emitente=self.request.user, numero=self.proximo_numero())

    def gravar_conclusao(self, ordem, dados):
        """Conclui a ordem e grava a leitura de odômetro: ou as duas, ou nenhuma (RN09)."""
        with transaction.atomic():
            for campo, valor in dados.items():
                setattr(ordem, campo, valor)
            ordem.status = OrdemServico.Status.CONCLUIDA
            ordem.save()
            LeituraOdometro.objects.create(
                veiculo=ordem.veiculo,
                data_leitura=ordem.data_conclusao,
                quilometragem=ordem.quilometragem,
                origem=LeituraOdometro.Origem.ORDEM_SERVICO,
                usuario=self.request.user,
            )
        return ordem

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
        return Response(self.get_serializer(self.gravar_conclusao(ordem, conclusao.validated_data)).data)

    @extend_schema(request=serializers.RealizadaSerializer, responses={201: serializers.OrdemServicoSerializer})
    @action(detail=False, methods=["post"])
    def realizada(self, request):
        """
        POST /api/ordens-servico/realizada — registra um serviço que já foi feito: abre e conclui
        a ordem de uma vez, com a leitura de odômetro. Se algo for recusado, nada é gravado.
        """
        dados = request.data.copy()
        if not dados.get("data_abertura") and dados.get("data_conclusao"):
            dados["data_abertura"] = dados["data_conclusao"]  # serviço feito: abriu e concluiu no mesmo dia
        abertura = self.get_serializer(data=dados)
        abertura_ok = abertura.is_valid()
        provisoria = (OrdemServico(veiculo=abertura.validated_data["veiculo"],
                                   data_abertura=abertura.validated_data["data_abertura"]) if abertura_ok else None)
        conclusao = serializers.ConclusaoSerializer(data=request.data, context={"ordem": provisoria})
        conclusao_ok = conclusao.is_valid()
        if not (abertura_ok and conclusao_ok):  # devolve os erros das duas partes de uma vez
            raise ValidationError({**(conclusao.errors if not conclusao_ok else {}),
                                   **(abertura.errors if not abertura_ok else {})})
        with transaction.atomic():
            ordem = abertura.save(emitente=request.user, numero=self.proximo_numero())
            self.gravar_conclusao(ordem, conclusao.validated_data)
        return Response(self.get_serializer(ordem).data, status=status.HTTP_201_CREATED)

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


class PainelView(APIView):
    """GET /api/painel — contagem de veículos ativos por situação e pendências da frota (RF21, RF32)."""

    permission_classes = [SomenteGestor]

    @extend_schema(responses=serializers.PainelSerializer)
    def get(self, request):
        return Response(serializers.PainelSerializer(manutencao.painel(request.user.empresa)).data)
