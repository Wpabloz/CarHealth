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


class ExigeCheckinDoDia(BasePermission):
    """
    Sprint 5: enquanto o motorista não fizer o check-in do dia, a API recusa as demais
    ações dele (Cap. 5, item 5.9). Não se aplica ao GESTOR. As ações que o próprio
    check-in usa (criar e consultar) ficam de fora em view.acoes_sem_checkin.
    """

    message = "Faça o check-in do dia antes de continuar."

    def has_permission(self, request, view):
        usuario = request.user
        if not usuario.is_motorista:
            return True
        if view.action in getattr(view, "acoes_sem_checkin", ()):
            return True
        from frota.models import Checkin  # import tardio: evita import circular com frota.models
        from django.utils import timezone
        return Checkin.objects.filter(usuario=usuario, data_checkin=timezone.localdate()).exists()
