"""
Views = o que acontece quando uma rota é chamada (os "controllers").

Fluxo de toda requisição:
  rota (urls.py) -> autenticação JWT -> permissão -> view -> serializer -> banco
"""
from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Empresa, Situacao, Usuario
from .permissoes import SomenteGestor
from .serializers import EmpresaSerializer, RegistrarSerializer, UsuarioSerializer


def gerar_tokens(usuario):
    refresh = RefreshToken.for_user(usuario)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


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
    """GET /api/auth/me — dados do usuário dono do token, gestor ou motorista (RF38)."""

    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user


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
