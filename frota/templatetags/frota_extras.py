from django import template
from django.utils.formats import localize

register = template.Library()


@register.filter
def valor_campo(obj, campo):
    """Mostra o valor de um campo, usando o rótulo amigável quando houver choices."""
    exibir = getattr(obj, f"get_{campo}_display", None)
    valor = exibir() if exibir else getattr(obj, campo, "")
    if valor is None or valor == "":
        return "—"
    return localize(valor)
