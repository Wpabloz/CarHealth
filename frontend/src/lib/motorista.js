/** Textos e regras das telas do motorista (com as palavras do protótipo). */
import { diaMesNumero, plural } from "./formato";

const numero = new Intl.NumberFormat("pt-BR");

/** Cor do aviso: atrasado (vermelho), perto (marrom: até 10 dias ou 300 km) ou mais adiante (azul). */
export function tomDoAviso(aviso) {
  if (aviso.situacao === "VENCIDA") return "vermelho";
  const perto = (aviso.dias_restantes ?? Infinity) <= 10 || (aviso.km_restante ?? Infinity) <= 300;
  return perto ? "marrom" : "azul";
}

const venceDias = (dias) => dias !== null && dias !== undefined && dias <= 30;

/** "Atrasada há 7 dias", "Daqui a 8 dias (09/10)", "Faltam 800 km"... */
export function prazoDoAviso(aviso) {
  const d = aviso.dias_restantes;
  const k = aviso.km_restante;
  if (aviso.situacao === "VENCIDA") {
    if (d !== null && d !== undefined && d < 0) return `Atrasada há ${plural(-d, "dia")}`;
    if (k !== null && k !== undefined && k < 0) return `Atrasada: passou ${numero.format(-k)} km`;
    return "Atrasada";
  }
  if (venceDias(d)) {
    if (d <= 0) return "Vence hoje";
    if (d === 1) return `Amanhã (${diaMesNumero(aviso.data_prevista)})`;
    return `Daqui a ${d} dias (${diaMesNumero(aviso.data_prevista)})`;
  }
  if (k !== null && k !== undefined) return `Faltam ${numero.format(k)} km`;
  return "Próxima";
}

/** Título do alerta do Início: "Troca de óleo atrasada", "Troca de óleo em 8 dias"... */
export function tituloDoAlerta(aviso) {
  if (aviso.situacao === "VENCIDA") return `${aviso.descricao} atrasada`;
  const d = aviso.dias_restantes;
  if (venceDias(d)) return d <= 0 ? `${aviso.descricao} vence hoje` : `${aviso.descricao} em ${plural(d, "dia")}`;
  return `${aviso.descricao}: faltam ${numero.format(aviso.km_restante)} km`;
}

/** Pior manutenção pendente de um caminhão (lista de planos de /veiculos/{placa}/situacao). */
export function piorPendencia(planos = []) {
  const ordem = { VENCIDA: 0, PROXIMA: 1 };
  return planos
    .filter((p) => p.situacao in ordem)
    .sort((a, b) => ordem[a.situacao] - ordem[b.situacao]
      || (a.dias_restantes ?? Infinity) - (b.dias_restantes ?? Infinity)
      || (a.km_restante ?? Infinity) - (b.km_restante ?? Infinity))[0];
}

/** Situação do último problema avisado, como o motorista vê no Início. */
export const SITUACAO_DO_PROBLEMA = {
  ABERTO: { texto: "O responsável já recebeu", tom: "azul" },
  EM_ANALISE: { texto: "O responsável está vendo", tom: "" },
  RESOLVIDO: { texto: "Resolvido", tom: "verde" },
};

export const primeiroNome = (nome) => (nome || "").trim().split(/\s+/)[0] || "motorista";

const FORMATO_DE_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/**
 * Placa lida do QR code da etiqueta ("https://.../m/checkin/RSV2B47") ou digitada ("rsv-2b47").
 * Devolve null se não for uma placa (antiga ou Mercosul).
 */
export function placaDoCodigo(texto) {
  const bruto = String(texto || "").trim();
  const doLink = bruto.match(/checkin\/([A-Za-z0-9-]{7,8})/);
  const placa = (doLink ? doLink[1] : bruto).replace(/[-\s]/g, "").toUpperCase();
  return FORMATO_DE_PLACA.test(placa) ? placa : null;
}
