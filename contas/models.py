from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models

from .validators import validar_cnpj


class Empresa(models.Model):
    cnpj = models.CharField(max_length=14, primary_key=True, validators=[validar_cnpj])
    razao_social = models.CharField("razão social", max_length=120)
    telefone = models.CharField(max_length=15)
    email = models.EmailField("e-mail", max_length=120)

    class Meta:
        db_table = "empresa"
        ordering = ["razao_social"]

    def __str__(self):
        return self.razao_social


class AdminManager(BaseUserManager):
    def create_user(self, email, nome, empresa, password=None, perfil="OPERADOR"):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        if not isinstance(empresa, Empresa):
            empresa = Empresa.objects.get(pk=empresa)
        admin = self.model(
            email=self.normalize_email(email).lower(), nome=nome, empresa=empresa, perfil=perfil
        )
        admin.set_password(password)  # grava o hash na coluna "senha"
        admin.save(using=self._db)
        return admin

    def create_superuser(self, email, nome, empresa, password=None):
        return self.create_user(email, nome, empresa, password, perfil=Admin.Perfil.GESTOR)


class Admin(AbstractBaseUser):
    """Usuário do sistema (tabela "admin"). Faz login com e-mail + senha."""

    class Perfil(models.TextChoices):
        GESTOR = "GESTOR", "Gestor"
        OPERADOR = "OPERADOR", "Operador"

    email = models.EmailField("e-mail", max_length=120, primary_key=True)
    nome = models.CharField(max_length=120)
    # A senha nunca é salva em texto puro: o Django grava um hash bcrypt na coluna "senha"
    password = models.CharField("senha", max_length=255, db_column="senha")
    perfil = models.CharField(max_length=20, choices=Perfil.choices, default=Perfil.OPERADOR)
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="admins"
    )

    last_login = None  # a tabela "admin" não possui essa coluna

    objects = AdminManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["nome", "empresa"]

    class Meta:
        db_table = "admin"
        ordering = ["nome"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(perfil__in=["GESTOR", "OPERADOR"]), name="ck_admin_perfil"
            ),
        ]

    def __str__(self):
        return self.nome

    @property
    def is_gestor(self):
        return self.perfil == self.Perfil.GESTOR
