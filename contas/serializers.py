"""
Serializers = "tradutores" entre JSON e os models.

Eles dizem quais campos entram/saem da API e validam os dados recebidos.
Os nomes das chaves no JSON seguem as colunas do banco (ex.: cnpj_empresa).
"""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Admin, Empresa


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ["cnpj", "razao_social", "telefone", "email"]
        read_only_fields = ["cnpj"]  # a chave primária não muda depois de criada


class AdminSerializer(serializers.ModelSerializer):
    """Usuário. A senha só entra (write_only): nunca é devolvida pela API."""

    cnpj_empresa = serializers.CharField(source="empresa_id", read_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = Admin
        fields = ["email", "nome", "perfil", "cnpj_empresa", "password"]

    def validate_email(self, valor):
        return valor.lower()

    def create(self, dados):
        return Admin.objects.create_user(**dados)


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
        if Admin.objects.filter(email=valor).exists():
            raise serializers.ValidationError("Já existe um usuário com este e-mail.")
        return valor

    def create(self, dados):
        empresa = Empresa.objects.create(**dados["empresa"])
        return Admin.objects.create_user(
            email=dados["email"],
            nome=dados["nome"],
            empresa=empresa,
            password=dados["password"],
            perfil=Admin.Perfil.GESTOR,
        )
