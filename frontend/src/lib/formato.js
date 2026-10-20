/** Formatação e rótulos usados nas telas (sempre em português do Brasil). */

const numero = new Intl.NumberFormat("pt-BR");
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const diaMes = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });
const diaMesCurto = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

export const milhar = (valor) => numero.format(valor);
export const km = (valor) => (valor === null || valor === undefined ? "Sem registro" : `${numero.format(valor)} km`);
export const dinheiro = (valor) => (valor === null || valor === undefined ? "—" : moeda.format(Number(valor)));
export const plural = (n, palavra, plural = `${palavra}s`) => `${n} ${n === 1 ? palavra : plural}`;

const paraData = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

/** "2026-10-19" -> "19/10/2026" (sem passar pelo fuso, para não mudar o dia). */
export function data(valor) {
  if (!valor) return "—";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
/** "2026-10-22" -> "22 de outubro" */
export const dataLonga = (valor) => (valor ? diaMes.format(paraData(valor)) : "—");
/** "2026-10-22" -> "22 de out." */
export const dataCurta = (valor) => (valor ? diaMesCurto.format(paraData(valor)) : "—");
/** "2026-10-22" -> "22/10" */
export const diaMesNumero = (valor) => (valor ? data(valor).slice(0, 5) : "—");

export function hojeISO() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const diasEntre = (de, ate) => Math.round((paraData(ate) - paraData(de)) / 86400000);
export function haQuanto(iso) {
  const d = diasEntre(iso, hojeISO());
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}
export function somarMeses(iso, meses) {
  const base = paraData(iso);
  const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(base.getUTCDate(), ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** Placa exibida como no documento: "RBQ1A23" -> "RBQ-1A23". */
export const placaFormatada = (placa) => (placa && placa.length === 7 ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa || "—");
/** Nome do veículo na equipe ("Guincho 01"); sem apelido, a placa. */
export const nomeVeiculo = (v) => v?.identificacao || placaFormatada(v?.placa);
export const marcaModelo = (v) => [v?.marca, v?.modelo].filter(Boolean).join(" ");

/** CPF mascarado nas listagens, só com os dígitos centrais visíveis (Cap. 4, Quadro 29). */
export function cpfMascarado(cpf) {
  if (!cpf || cpf.length !== 11) return cpf || "—";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
export function cnpjFormatado(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj || "—";
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
export const somenteDigitos = (texto) => (texto || "").replace(/\D/g, "");
export const iniciais = (nome) =>
  (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

/**
 * Prazo de uma manutenção prevista, com as palavras do protótipo.
 * Usa os dias quando são eles que importam; senão, os quilômetros.
 *   selo:  "Atrasado há 3 dias" · "Vence em 5 dias" · "Faltam 800 km"
 *   curto: "Atrasada (3 dias)"  · "Próxima (5 dias)" · "Próxima (800 km)"
 */
export function prazo(item, tolerancia = { km: 1000, dias: 30 }) {
  const d = item.dias_restantes;
  const k = item.km_restante;
  const temDias = d !== null && d !== undefined;
  const temKm = k !== null && k !== undefined;
  if (item.situacao === "VENCIDA") {
    if (temDias && d < 0) return { selo: `Atrasado há ${plural(-d, "dia")}`, curto: `Atrasada (${plural(-d, "dia")})` };
    if (temKm && k < 0) return { selo: `Passou ${numero.format(-k)} km`, curto: `Atrasada (${numero.format(-k)} km)` };
    return { selo: "Atrasada", curto: "Atrasada" };
  }
  if (item.situacao === "PROXIMA") {
    if (temDias && d <= tolerancia.dias) {
      if (d === 0) return { selo: "Vence hoje", curto: "Próxima (hoje)" };
      return { selo: `Vence em ${plural(d, "dia")}`, curto: `Próxima (${plural(d, "dia")})` };
    }
    if (temKm) return { selo: `Faltam ${numero.format(k)} km`, curto: `Próxima (${numero.format(k)} km)` };
    return { selo: "Próxima", curto: "Próxima" };
  }
  if (item.situacao === "EM_DIA") return { selo: "Em dia", curto: "Em dia" };
  if (item.situacao === "SEM_PLANO") return { selo: "Sem plano", curto: "Sem plano" };
  return { selo: "Sem histórico", curto: "Sem histórico" };
}

/** Tom de cor de cada situação. O texto sempre acompanha a cor (RNF03). */
export const TOM_MANUTENCAO = { VENCIDA: "perigo", PROXIMA: "atencao", EM_DIA: "realizada", SEM_BASE: "neutro", SEM_PLANO: "neutro" };
export const ROTULO_MANUTENCAO = {
  VENCIDA: "Atrasada", PROXIMA: "Próxima", EM_DIA: "Em dia", SEM_BASE: "Sem histórico", SEM_PLANO: "Sem plano",
};
export const STATUS_ORDEM = {
  ABERTA: { rotulo: "Pendente", tom: "info" },
  APROVADA: { rotulo: "Aprovada", tom: "info" },
  CONCLUIDA: { rotulo: "Realizada", tom: "realizada" },
  CANCELADA: { rotulo: "Cancelada", tom: "neutro" },
};
export const SITUACAO_CADASTRO = {
  ATIVO: { rotulo: "Ativo", tom: "ok" },
  INATIVO: { rotulo: "Inativo", tom: "neutro" },
};
export const ORIGEM_LEITURA = { MANUAL: "Manual", ORDEM_SERVICO: "Ordem de serviço", AJUSTE_ODOMETRO: "Ajuste de odômetro" };

/** Plano: "a cada 10.000 km ou 6 meses". */
export function intervalo(plano) {
  const partes = [];
  if (plano.intervalo_km) partes.push(`${numero.format(plano.intervalo_km)} km`);
  if (plano.intervalo_meses) partes.push(plural(plano.intervalo_meses, "mês", "meses"));
  return partes.length ? `a cada ${partes.join(" ou ")}` : "—";
}

/** Ordena pela gravidade: atrasadas, próximas, em dia, sem histórico. */
const GRAVIDADE = ["VENCIDA", "PROXIMA", "EM_DIA", "SEM_BASE", "SEM_PLANO"];
export const porGravidade = (a, b) =>
  GRAVIDADE.indexOf(a.situacao) - GRAVIDADE.indexOf(b.situacao) ||
  (a.dias_restantes ?? Infinity) - (b.dias_restantes ?? Infinity) ||
  (a.km_restante ?? Infinity) - (b.km_restante ?? Infinity);
