from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

from .models import Admin, Empresa
from .validators import somente_digitos


class LoginForm(AuthenticationForm):
    username = forms.EmailField(label="E-mail", widget=forms.EmailInput(attrs={"autofocus": True}))

    def clean_username(self):
        return self.cleaned_data["username"].lower()


class SenhaMixin(forms.Form):
    senha = forms.CharField(label="Senha", widget=forms.PasswordInput)
    confirmar_senha = forms.CharField(label="Confirmar senha", widget=forms.PasswordInput)

    def clean(self):
        dados = super().clean()
        if dados.get("senha") and dados.get("senha") != dados.get("confirmar_senha"):
            self.add_error("confirmar_senha", "As senhas não conferem.")
        elif dados.get("senha"):
            try:
                validate_password(dados["senha"])
            except forms.ValidationError as erro:
                self.add_error("senha", erro)
        return dados


class CadastroEmpresaForm(SenhaMixin, forms.ModelForm):
    """Cria a empresa e o primeiro usuário (perfil Gestor) em uma única transação."""

    cnpj = forms.CharField(label="CNPJ", max_length=18)
    nome = forms.CharField(label="Seu nome", max_length=120)
    email_usuario = forms.EmailField(label="Seu e-mail (login)", max_length=120)

    class Meta:
        model = Empresa
        fields = ["cnpj", "razao_social", "telefone", "email"]
        labels = {"email": "E-mail da empresa"}

    def clean_cnpj(self):
        return somente_digitos(self.cleaned_data["cnpj"])

    def clean_email_usuario(self):
        email = self.cleaned_data["email_usuario"].lower()
        if Admin.objects.filter(email=email).exists():
            raise forms.ValidationError("Já existe um usuário com este e-mail.")
        return email

    @transaction.atomic
    def save(self, commit=True):
        empresa = super().save()
        Admin.objects.create_user(
            email=self.cleaned_data["email_usuario"],
            nome=self.cleaned_data["nome"],
            empresa=empresa,
            password=self.cleaned_data["senha"],
            perfil=Admin.Perfil.GESTOR,
        )
        return empresa


class UsuarioForm(SenhaMixin, forms.ModelForm):
    class Meta:
        model = Admin
        fields = ["nome", "email", "perfil"]

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if Admin.objects.filter(email=email).exists():
            raise forms.ValidationError("Já existe um usuário com este e-mail.")
        return email

    def save(self, commit=True):
        usuario = super().save(commit=False)
        usuario.set_password(self.cleaned_data["senha"])
        if commit:
            usuario.save()
        return usuario
