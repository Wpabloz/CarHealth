from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models

from .validators import validar_cnpj


class Situacao(models.TextChoices):
    """Usada por usuario, motorista, veiculo e plano: inativar em vez de excluir (RN15)."""

    ATIVO = "ATIVO", "Ativo"
    INATIVO = "INATIVO", "Inativo"


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


class UsuarioManager(BaseUserManager):
    def create_user(self, email, password=None, **campos):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        usuario = self.model(email=self.normalize_email(email).lower(), **campos)
        usuario.set_password(password)  # grava o hash na coluna "senha"
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, password=None, **campos):
        campos["perfil"] = Usuario.Perfil.GESTOR
        return self.create_user(email, password, **campos)


class Usuario(AbstractBaseUser):
    """
    Usuário do sistema (tabela "usuario", que até a Sprint 2 se chamava "admin").
    Faz login com e-mail + senha. O perfil define o que cada um pode fazer (RN16):
      GESTOR    -> acesso completo; não tem cpf_motorista.
      MOTORISTA -> acesso restrito; a conta pertence a um cadastro de motorista (RN18).
    """

    class Perfil(models.TextChoices):
        GESTOR = "GESTOR", "Gestor"
        MOTORISTA = "MOTORISTA", "Motorista"

    email = models.EmailField("e-mail", max_length=120, primary_key=True)
    # Vazio no perfil MOTORISTA: o nome vem do cadastro do motorista, para não ser copiado
    nome = models.CharField(max_length=120, null=True, blank=True)
    # A senha nunca é salva em texto puro: o Django grava um hash bcrypt na coluna "senha"
    password = models.CharField("senha", max_length=255, db_column="senha")
    perfil = models.CharField(max_length=20, choices=Perfil.choices)
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.ATIVO
    )
    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, db_column="cnpj_empresa", related_name="usuarios"
    )
    # UNIQUE no banco: cada motorista tem no máximo uma conta de acesso
    motorista = models.OneToOneField(
        "frota.Motorista",
        on_delete=models.PROTECT,
        db_column="cpf_motorista",
        null=True,
        blank=True,
        related_name="usuario",
    )

    last_login = None  # a tabela "usuario" não possui essa coluna

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["empresa"]

    class Meta:
        db_table = "usuario"
        ordering = ["email"]
        verbose_name = "usuário"

    def __str__(self):
        return self.nome_exibicao

    @property
    def nome_exibicao(self):
        return self.motorista.nome if self.motorista_id else (self.nome or self.email)

    @property
    def is_gestor(self):
        return self.perfil == self.Perfil.GESTOR

    @property
    def is_motorista(self):
        return self.perfil == self.Perfil.MOTORISTA

    @property
    def is_active(self):
        """Conta inativa não entra no sistema (RN18). Vale também se o motorista foi inativado."""
        if self.situacao != Situacao.ATIVO:
            return False
        return not self.motorista_id or self.motorista.situacao == Situacao.ATIVO
