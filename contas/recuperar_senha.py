"""
"Esqueci minha senha" e "Redefinir senha".

1. POST /api/auth/esqueci-senha  {email}
   Se existir uma conta ATIVA com esse e-mail, envia um link com uid + token:
   {FRONTEND_URL}/redefinir-senha?uid=...&token=...
   A resposta é sempre a mesma, exista a conta ou não (ninguém descobre quais e-mails estão cadastrados).

2. POST /api/auth/redefinir-senha  {uid, token, nova_senha}
   Confere o token, grava a nova senha (bcrypt) e derruba todas as sessões abertas da conta.

O token é o do próprio Django (PasswordResetTokenGenerator): é calculado a partir da senha
atual, então deixa de valer assim que a senha muda (o link só pode ser usado uma vez) e
expira em PASSWORD_RESET_TIMEOUT segundos (1 hora).
"""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .models import Usuario


def link_de_redefinicao(usuario):
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    return f"{settings.FRONTEND_URL}/redefinir-senha?uid={uid}&token={token}"


def enviar_link(usuario):
    minutos = settings.PASSWORD_RESET_TIMEOUT // 60
    send_mail(
        subject="CarHealth — redefinir sua senha",
        message=(
            f"Olá, {usuario.nome_exibicao}.\n\n"
            "Recebemos um pedido para redefinir a senha da sua conta no CarHealth.\n"
            f"Para criar uma nova senha, abra o link abaixo (vale por {minutos} minutos):\n\n"
            f"{link_de_redefinicao(usuario)}\n\n"
            "Se não foi você, ignore este e-mail: sua senha continua a mesma."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[usuario.email],
    )


def usuario_do_link(uid, token):
    """Devolve o usuário se o link for válido (conta ativa, token certo e dentro do prazo); senão, None."""
    try:
        usuario = Usuario.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError, Usuario.DoesNotExist):
        return None
    if not usuario.is_active or not default_token_generator.check_token(usuario, token):
        return None
    return usuario
