"""
Limite de tentativas nas rotas públicas (sem login).

Conta por endereço IP + e-mail informado: quem erra a senha várias vezes seguidas de
uma conta precisa esperar, mas outra pessoa na mesma rede (ex.: o Wi-Fi da faculdade)
continua entrando normalmente. As taxas ficam em REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].
"""
from rest_framework.throttling import SimpleRateThrottle


class LimitePorIpEEmail(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "") if hasattr(request, "data") else "").strip().lower()
        return self.cache_format % {"scope": self.scope, "ident": f"{self.get_ident(request)}:{email}"}


class LimiteLogin(LimitePorIpEEmail):
    scope = "login"  # POST /api/auth/login


class LimiteRecuperarSenha(LimitePorIpEEmail):
    scope = "senha"  # POST /api/auth/esqueci-senha e /api/auth/redefinir-senha
