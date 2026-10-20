"""
Views = o que acontece quando uma rota é chamada (os "controllers").

Fluxo de toda requisição:
  rota (urls.py) -> autenticação JWT -> permissão -> view -> serializer -> banco
"""
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Empresa, Situacao, Usuario
from .permissoes import SomenteGestor
from .serializers import (
    EmpresaSerializer, MeuPerfilSerializer, RegistrarSerializer, TokensSerializer, TrocarSenhaSerializer,
    UsuarioSerializer,
)
from .sessao import gerar_tokens, revogar_sessoes


class RegistrarView(generics.GenericAPIView):
    """POST /api/auth/registrar — cria empresa + usuário gestor e já devolve o token."""

    serializer_class = RegistrarSerializer
    permission_classes = [AllowAny]  # rota pública
    authentication_classes = []

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(
            {"usuario": UsuarioSerializer(usuario).data, **gerar_tokens(usuario)},
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.RetrieveAPIView):
    """
    GET /api/auth/me — dados do usuário dono do token, gestor ou motorista (RF38).
    PATCH /api/auth/me — o gestor muda o próprio nome. E-mail, perfil e situação não mudam por aqui.
    """

    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user

    @extend_schema(request=MeuPerfilSerializer, responses=UsuarioSerializer)
    def patch(self, request):
        perfil = MeuPerfilSerializer(request.user, data=request.data, partial=True)
        perfil.is_valid(raise_exception=True)
        perfil.save()
        return Response(UsuarioSerializer(request.user).data)


class TrocarSenhaView(generics.GenericAPIView):
    """
    POST /api/auth/senha — troca a própria senha, informando a atual (gestor ou motorista).
    Todas as sessões abertas da conta caem; esta recebe tokens novos para continuar.
    """

    serializer_class = TrocarSenhaSerializer

    @extend_schema(responses=TokensSerializer)
    def post(self, request):
        troca = self.get_serializer(data=request.data)
        troca.is_valid(raise_exception=True)
        request.user.set_password(troca.validated_data["nova_senha"])
        request.user.save(update_fields=["password"])
        revogar_sessoes(request.user)
        return Response(gerar_tokens(request.user))


class EmpresaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/empresas — o usuário só enxerga a própria empresa.

    Pelo modelo de dados, cada USUARIO pertence a uma EMPRESA (usuario.cnpj_empresa),
    por isso a empresa é criada junto com o primeiro usuário em /api/auth/registrar.
    Aqui: listar, ver e editar. Editar exige perfil GESTOR.
    """

    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer

    def get_queryset(self):
        return self.queryset.filter(cnpj=self.request.user.empresa_id)

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [SomenteGestor()]
        return super().get_permissions()


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    /api/usuarios — o GESTOR cadastra, edita e inativa usuários da sua empresa (RF06).
    Usuário com histórico (leituras ou ordens) não é excluído: mude a situacao para INATIVO.
    """

    queryset = Usuario.objects.select_related("motorista")
    serializer_class = UsuarioSerializer
    permission_classes = [SomenteGestor]
    lookup_value_regex = "[^/]+"  # o id é o e-mail, que tem ponto

    def get_queryset(self):
        return self.queryset.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    def perform_update(self, serializer):
        dados = serializer.validated_data
        if serializer.instance == self.request.user and (
            dados.get("situacao", Situacao.ATIVO) != Situacao.ATIVO
            or dados.get("perfil", Usuario.Perfil.GESTOR) != Usuario.Perfil.GESTOR
        ):
            raise ValidationError("Você não pode inativar a própria conta nem trocar o próprio perfil.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError("Você não pode excluir o próprio usuário.")
        instance.delete()
