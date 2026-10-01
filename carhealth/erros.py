"""
Transforma erros do banco em respostas JSON amigáveis.

Sem isto, uma regra violada no PostgreSQL (ex.: CHECK ou chave duplicada)
viraria um "Erro 500". Aqui ela vira um 400/409 com uma mensagem clara.
"""
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback


def tratar_erros(exc, context):
    resposta = exception_handler(exc, context)  # erros normais do DRF (400, 401, 404...)
    if resposta is not None:
        return resposta

    if isinstance(exc, ProtectedError):
        set_rollback()
        return Response(
            {"detail": "Este registro possui outros registros vinculados e não pode ser excluído."},
            status=status.HTTP_409_CONFLICT,
        )
    if isinstance(exc, IntegrityError):
        set_rollback()
        return Response(
            {"detail": "Os dados violam uma regra do banco de dados.", "erro": str(exc).split("\n")[0]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None
