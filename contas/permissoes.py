from rest_framework.permissions import BasePermission


class SomenteGestor(BasePermission):
    """Libera a rota apenas para usuários com perfil GESTOR."""

    message = "Apenas usuários com perfil GESTOR podem fazer isso."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_gestor)
