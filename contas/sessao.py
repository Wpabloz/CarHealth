"""
Sessões de login (tokens JWT).

- O access dura 15 minutos e o refresh é a janela de inatividade (SESSAO_INATIVIDADE_MINUTOS no .env):
  a cada renovação o refresh é trocado por um novo e o antigo é revogado. Sem uso, a sessão expira (RF02).
- Cada token leva uma impressão da senha (CHECK_REVOKE_TOKEN): trocar a senha derruba as sessões abertas.
- Sair revoga o refresh (POST /api/auth/sair).
"""
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken


def gerar_tokens(usuario):
    refresh = RefreshToken.for_user(usuario)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def revogar_sessoes(usuario):
    """Revoga todos os refresh tokens já emitidos para o usuário (ex.: depois de trocar a senha)."""
    for token in OutstandingToken.objects.filter(user=usuario):
        BlacklistedToken.objects.get_or_create(token=token)
