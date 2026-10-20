"""
Serializers = "tradutores" entre JSON e os models.

Eles dizem quais campos entram/saem da API e validam os dados recebidos.
Os nomes das chaves no JSON seguem as colunas do banco (ex.: cnpj_empresa).
"""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as ErroDjango
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from frota.models import Motorista

from .models import Empresa, Usuario
from .sessao import revogar_sessoes


class DaEmpresaField(serializers.PrimaryKeyRelatedField):
    """Campo de chave estrangeira que só aceita registros da empresa do usuário logado (RN01)."""

    def get_queryset(self):
        return super().get_queryset().filter(empresa=self.context["request"].user.empresa)


def chave_nao_muda(serializer, campo, valor):
    """No PUT/PATCH, impede trocar a chave primária (CPF, placa, e-mail)."""
    if serializer.instance is not None and valor != getattr(serializer.instance, campo):
        raise serializers.ValidationError("Este campo não pode ser alterado.")
    return valor


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ["cnpj", "razao_social", "telefone", "email"]
        read_only_fields = ["cnpj"]  # a chave primária não muda depois de criada


class UsuarioSerializer(serializers.ModelSerializer):
    """
    Usuário. A senha só entra (write_only): nunca é devolvida pela API.
    GESTOR exige nome e não tem cpf_motorista; MOTORISTA exige cpf_motorista e o nome
    vem do cadastro do motorista (RN18).
    """

    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)
    cpf_motorista = DaEmpresaField(
        source="motorista",
        queryset=Motorista.objects.all(),
        allow_null=True,
        required=False,
        validators=[UniqueValidator(Usuario.objects.all(), "Este motorista já possui uma conta de acesso.")],
    )
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    class Meta:
        model = Usuario
        fields = ["email", "nome", "perfil", "situacao", "cpf_motorista", "cnpj_empresa", "password"]

    def validate_email(self, valor):
        return chave_nao_muda(self, "email", valor.lower())

    def validate(self, dados):
        perfil = dados.get("perfil", getattr(self.instance, "perfil", None))
        motorista = dados["motorista"] if "motorista" in dados else getattr(self.instance, "motorista", None)
        if perfil == Usuario.Perfil.MOTORISTA:
            if motorista is None:
                raise serializers.ValidationError(
                    {"cpf_motorista": "Obrigatório no perfil MOTORISTA: informe o CPF do motorista."})
            dados["nome"] = None  # o nome vem do cadastro do motorista, sem ser copiado
        else:
            if motorista is not None:
                raise serializers.ValidationError(
                    {"cpf_motorista": "Conta de GESTOR não pode ter motorista vinculado."})
            if not dados.get("nome", getattr(self.instance, "nome", None)):
                raise serializers.ValidationError({"nome": "Obrigatório no perfil GESTOR."})
        if self.instance is None and not dados.get("password"):
            raise serializers.ValidationError({"password": "Este campo é obrigatório."})
        return dados

    def create(self, dados):
        return Usuario.objects.create_user(**dados)

    def update(self, usuario, dados):
        senha = dados.pop("password", None)
        if senha:
            usuario.set_password(senha)  # o gestor pode redefinir a senha
            revogar_sessoes(usuario)  # e as sessões abertas dessa conta caem
        return super().update(usuario, dados)

    def to_representation(self, usuario):
        dados = super().to_representation(usuario)
        dados["nome"] = usuario.nome_exibicao if usuario.is_motorista else usuario.nome
        return dados


class MeuPerfilSerializer(serializers.ModelSerializer):
    """PATCH /auth/me: o gestor muda o próprio nome. O nome do motorista vem do cadastro dele."""

    class Meta:
        model = Usuario
        fields = ["nome"]

    def validate_nome(self, valor):
        if self.instance.is_motorista:
            raise serializers.ValidationError(
                "O nome do motorista é alterado pelo gestor, no cadastro do motorista.")
        if not (valor or "").strip():
            raise serializers.ValidationError("Informe o nome.")
        return valor.strip()


class TrocarSenhaSerializer(serializers.Serializer):
    """POST /auth/senha: troca a própria senha, confirmando a atual (gestor ou motorista)."""

    senha_atual = serializers.CharField(write_only=True)
    nova_senha = serializers.CharField(write_only=True)

    def validate_senha_atual(self, valor):
        if not self.context["request"].user.check_password(valor):
            raise serializers.ValidationError("Senha atual incorreta.")
        return valor

    def validate(self, dados):
        if dados["nova_senha"] == dados["senha_atual"]:
            raise serializers.ValidationError({"nova_senha": "A nova senha precisa ser diferente da atual."})
        try:
            validate_password(dados["nova_senha"], self.context["request"].user)
        except ErroDjango as erro:
            raise serializers.ValidationError({"nova_senha": list(erro.messages)}) from erro
        return dados


class TokensSerializer(serializers.Serializer):
    """Par de tokens devolvido no login, no cadastro e na troca de senha (documentação)."""

    access = serializers.CharField()
    refresh = serializers.CharField()


class EmpresaCadastroSerializer(serializers.ModelSerializer):
    """Igual ao EmpresaSerializer, mas aqui o CNPJ pode ser informado (só números)."""

    class Meta:
        model = Empresa
        fields = ["cnpj", "razao_social", "telefone", "email"]


class RegistrarSerializer(serializers.Serializer):
    """Cadastro inicial: cria a EMPRESA e o primeiro usuário (perfil GESTOR)."""

    empresa = EmpresaCadastroSerializer()
    nome = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=120)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_email(self, valor):
        valor = valor.lower()
        if Usuario.objects.filter(email=valor).exists():
            raise serializers.ValidationError("Já existe um usuário com este e-mail.")
        return valor

    def create(self, dados):
        empresa = Empresa.objects.create(**dados["empresa"])
        return Usuario.objects.create_user(
            dados["email"],
            dados["password"],
            nome=dados["nome"],
            empresa=empresa,
            perfil=Usuario.Perfil.GESTOR,
        )
