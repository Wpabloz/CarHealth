"""
Situação de manutenção: calculada a cada consulta, nunca gravada no banco (Cap. 4, Quadro 16).

Para cada veículo e cada plano que se aplica a ele (mesmo tipo, plano ATIVO):
  última execução (RN07) = ordem CONCLUIDA mais recente daquele plano naquele veículo
  próxima (RN06)         = última execução + intervalo do plano, em km e em data
  situação (RN08)        = VENCIDA se passou da km ou da data prevista;
                           PROXIMA se faltam até TOLERANCIA_KM ou TOLERANCIA_DIAS;
                           EM_DIA nos demais casos. Com os dois intervalos, vale o
                           que vencer primeiro (RN05).
Sem leitura de odômetro, o critério de km não é aplicado (RN19). Sem execução
registrada, não há base para calcular o vencimento (SEM_BASE).
"""
import calendar
from datetime import date

from django.conf import settings
from django.db import models
from django.db.models import OuterRef, Subquery
from django.utils import timezone

from contas.models import Situacao

from .models import ORDEM_DOS_VEICULOS, LeituraOdometro, OrdemServico, PlanoManutencao, Veiculo


class SituacaoManutencao(models.TextChoices):
    VENCIDA = "VENCIDA", "Vencida"
    PROXIMA = "PROXIMA", "Próxima do vencimento"
    EM_DIA = "EM_DIA", "Em dia"
    SEM_BASE = "SEM_BASE", "Sem execução registrada"
    SEM_PLANO = "SEM_PLANO", "Sem plano aplicável"


# Da mais grave para a menos grave: o veículo assume a pior situação entre os seus planos
GRAVIDADE = [SituacaoManutencao.VENCIDA, SituacaoManutencao.PROXIMA, SituacaoManutencao.EM_DIA,
             SituacaoManutencao.SEM_BASE, SituacaoManutencao.SEM_PLANO]


def somar_meses(data, meses):
    mes = data.month - 1 + meses
    ano, mes = data.year + mes // 12, mes % 12 + 1
    return date(ano, mes, min(data.day, calendar.monthrange(ano, mes)[1]))


def com_km_atual(veiculos):
    """Anota em cada veículo a km da última leitura, na ordem de registro (RN02)."""
    ultima = LeituraOdometro.objects.filter(veiculo=OuterRef("pk")).order_by("-codigo")
    return veiculos.annotate(km_ultima_leitura=Subquery(ultima.values("quilometragem")[:1]))


def calcular_plano(plano, execucao, km_atual, hoje):
    """Situação de um plano em um veículo. execucao = última OS concluída (ou None)."""
    item = {
        "id_plano": plano.id_plano, "descricao": plano.descricao,
        "intervalo_km": plano.intervalo_km, "intervalo_meses": plano.intervalo_meses,
        "ultima_execucao": None, "km_previsto": None, "km_restante": None,
        "data_prevista": None, "dias_restantes": None, "situacao": SituacaoManutencao.SEM_BASE,
    }
    if execucao is None:
        return item
    item["ultima_execucao"] = {"numero": execucao.numero, "data": execucao.data_conclusao,
                               "quilometragem": execucao.quilometragem}

    if plano.intervalo_km and execucao.quilometragem is not None:
        item["km_previsto"] = execucao.quilometragem + plano.intervalo_km
        if km_atual is not None:  # sem leitura, o critério de km não vale (RN19)
            item["km_restante"] = item["km_previsto"] - km_atual
    if plano.intervalo_meses:
        item["data_prevista"] = somar_meses(execucao.data_conclusao, plano.intervalo_meses)
        item["dias_restantes"] = (item["data_prevista"] - hoje).days

    km, dias = item["km_restante"], item["dias_restantes"]
    if km is None and dias is None:
        return item
    if (km is not None and km < 0) or (dias is not None and dias < 0):
        item["situacao"] = SituacaoManutencao.VENCIDA
    elif (km is not None and km <= settings.TOLERANCIA_KM) or (dias is not None and dias <= settings.TOLERANCIA_DIAS):
        item["situacao"] = SituacaoManutencao.PROXIMA
    else:
        item["situacao"] = SituacaoManutencao.EM_DIA
    return item


def situacao_do_veiculo(planos):
    if not planos:
        return SituacaoManutencao.SEM_PLANO
    return min((p["situacao"] for p in planos), key=GRAVIDADE.index)


def calcular(empresa, veiculos, hoje=None):
    """
    Devolve, para cada veículo, a lista de planos com a situação calculada.
    Faz poucas consultas, para servir também ao painel da frota inteira (RNF05).
    """
    hoje = hoje or timezone.localdate()
    veiculos = list(com_km_atual(veiculos))
    planos = list(PlanoManutencao.objects.filter(empresa=empresa, situacao=Situacao.ATIVO))
    execucoes = {}  # (placa, id_plano) -> ordem concluída mais recente
    concluidas = (OrdemServico.objects
                  .filter(veiculo__empresa=empresa, status=OrdemServico.Status.CONCLUIDA, plano__isnull=False)
                  .order_by("data_conclusao", "numero"))
    for ordem in concluidas:
        execucoes[(ordem.veiculo_id, ordem.plano_id)] = ordem

    resultado = []
    for veiculo in veiculos:
        aplicaveis = [p for p in planos if p.tipo_veiculo == veiculo.tipo]
        itens = [calcular_plano(p, execucoes.get((veiculo.placa, p.id_plano)), veiculo.km_ultima_leitura, hoje)
                 for p in aplicaveis]
        resultado.append({
            "placa": veiculo.placa, "identificacao": veiculo.identificacao,
            "marca": veiculo.marca, "modelo": veiculo.modelo, "tipo": veiculo.tipo, "observacoes": veiculo.observacoes,
            "km_atual": veiculo.km_ultima_leitura,
            "situacao": situacao_do_veiculo(itens), "planos": itens,
        })
    return resultado


def painel(empresa, hoje=None):
    """Contagem por situação, pendências por criticidade (RF21, RF32), a frota ativa e as realizadas no mês."""
    ativos = Veiculo.objects.filter(empresa=empresa, situacao=Situacao.ATIVO).order_by(*ORDEM_DOS_VEICULOS)
    veiculos = calcular(empresa, ativos, hoje)
    contagem = {s.value: 0 for s in SituacaoManutencao}
    pendencias = []
    for v in veiculos:
        contagem[v["situacao"]] += 1  # cada veículo conta uma vez, pela situação mais grave
        for p in v["planos"]:
            if p["situacao"] in (SituacaoManutencao.VENCIDA, SituacaoManutencao.PROXIMA):
                pendencias.append({"placa": v["placa"], "identificacao": v["identificacao"], "marca": v["marca"],
                                   "modelo": v["modelo"], "km_atual": v["km_atual"], **p})
    infinito = float("inf")
    pendencias.sort(key=lambda p: (GRAVIDADE.index(p["situacao"]),
                                   p["dias_restantes"] if p["dias_restantes"] is not None else infinito,
                                   p["km_restante"] if p["km_restante"] is not None else infinito))
    hoje = hoje or timezone.localdate()
    realizadas = OrdemServico.objects.filter(
        veiculo__empresa=empresa, status=OrdemServico.Status.CONCLUIDA,
        data_conclusao__year=hoje.year, data_conclusao__month=hoje.month).count()
    return {"contagem": contagem, "pendencias": pendencias, "veiculos": veiculos, "realizadas_no_mes": realizadas,
            "tolerancia": {"km": settings.TOLERANCIA_KM, "dias": settings.TOLERANCIA_DIAS}}
