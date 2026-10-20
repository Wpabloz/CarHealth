from rest_framework.permissions import BasePermission


class SomenteGestor(BasePermission):
    """Libera a rota apenas para usuários com perfil GESTOR."""

    message = "Apenas usuários com perfil GESTOR podem fazer isso."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_gestor)


class PermissaoPorPerfil(BasePermission):
    """
    GESTOR: acesso completo. MOTORISTA: só as ações listadas em view.acoes_motorista
    (ex.: ("list", "retrieve")). A regra é conferida no servidor, não só na tela (RNF08).
    """

    message = "Esta função é exclusiva do perfil GESTOR."

    def has_permission(self, request, view):
        usuario = request.user
        if not (usuario and usuario.is_authenticated):
            return False
        return usuario.is_gestor or view.action in getattr(view, "acoes_motorista", ())
