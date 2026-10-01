"""Validadores de documentos brasileiros (CPF e CNPJ)."""
import re

from django.core.exceptions import ValidationError


def somente_digitos(valor):
    return re.sub(r"\D", "", valor or "")


def validar_cpf(valor):
    cpf = somente_digitos(valor)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        raise ValidationError("CPF inválido.")
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(cpf[tamanho]):
            raise ValidationError("CPF inválido.")


def validar_cnpj(valor):
    cnpj = somente_digitos(valor)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        raise ValidationError("CNPJ inválido.")
    pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    for tamanho in (12, 13):
        soma = sum(int(cnpj[i]) * pesos[i + 13 - tamanho] for i in range(tamanho))
        resto = soma % 11
        digito = 0 if resto < 2 else 11 - resto
        if digito != int(cnpj[tamanho]):
            raise ValidationError("CNPJ inválido.")


def validar_placa(valor):
    """Aceita placa antiga (ABC1234 / ABC-1234) e Mercosul (ABC1D23)."""
    placa = (valor or "").upper().replace("-", "")
    if not re.fullmatch(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", placa):
        raise ValidationError("Placa inválida. Use o formato ABC1234 ou ABC1D23.")
