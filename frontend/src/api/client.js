/**
 * Cliente da API do CarHealth.
 *
 * - Envia e recebe JSON.
 * - Coloca o token JWT em toda chamada (Authorization: Bearer <token>).
 * - Se o token vencer (401), tenta renová-lo uma vez com o refresh e repete a chamada.
 * - Em erro, lança ErroApi com a mensagem e os erros por campo que o Django devolve.
 */
const BASE = import.meta.env.VITE_API_URL || "/api";
const CHAVE_TOKENS = "carhealth.tokens";

export class ErroApi extends Error {
  constructor(status, dados) {
    super(mensagemDoErro(status, dados));
    this.status = status;
    // Erros por campo, ex.: { cpf: "CPF inválido.", "empresa.cnpj": "CNPJ inválido." }
    this.campos = dados && typeof dados === "object" && !Array.isArray(dados) ? achatar(dados) : {};
  }
}

function achatar(dados, prefixo = "", saida = {}) {
  for (const [campo, valor] of Object.entries(dados)) {
    if (campo === "detail" || campo === "non_field_errors") continue;
    const chave = prefixo ? `${prefixo}.${campo}` : campo;
    if (valor && typeof valor === "object" && !Array.isArray(valor)) achatar(valor, chave, saida);
    else saida[chave] = textoDoErro(valor);
  }
  return saida;
}

function textoDoErro(valor) {
  if (Array.isArray(valor)) return valor.map(textoDoErro).join(" ");
  if (valor && typeof valor === "object") return Object.values(valor).map(textoDoErro).join(" ");
  return String(valor ?? "");
}

function mensagemDoErro(status, dados) {
  if (dados?.detail) return textoDoErro(dados.detail);
  if (dados?.non_field_errors) return textoDoErro(dados.non_field_errors);
  if (Array.isArray(dados)) return textoDoErro(dados);
  if (status === 0) return "Não foi possível falar com o servidor. Verifique se a API está ligada.";
  if (status === 403) return "Seu perfil não tem permissão para fazer isso.";
  if (status === 404) return "Registro não encontrado.";
  if (status >= 500) return "Erro no servidor. Tente de novo em instantes.";
  return "Confira os campos destacados.";
}

export const tokens = {
  ler() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_TOKENS)) || {};
    } catch {
      return {};
    }
  },
  salvar(valor) {
    try {
      localStorage.setItem(CHAVE_TOKENS, JSON.stringify(valor));
    } catch {
      /* navegador sem armazenamento: a sessão dura até fechar a aba */
    }
  },
  limpar() {
    try {
      localStorage.removeItem(CHAVE_TOKENS);
    } catch {
      /* nada a limpar */
    }
  },
};

// Chamado quando a sessão não pode ser renovada (o AuthContext manda para o login)
let aoPerderSessao = () => {};
export function quandoPerderSessao(funcao) {
  aoPerderSessao = funcao;
}

async function renovarToken() {
  const { refresh } = tokens.ler();
  if (!refresh) return false;
  const resp = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!resp.ok) return false;
  const dados = await resp.json();
  tokens.salvar({ ...tokens.ler(), access: dados.access, ...(dados.refresh && { refresh: dados.refresh }) });
  return true;
}

export async function api(caminho, { metodo = "GET", corpo, publica = false, repetida = false } = {}) {
  const headers = { Accept: "application/json" };
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  const { access } = tokens.ler();
  if (access && !publica) headers.Authorization = `Bearer ${access}`;

  let resp;
  try {
    resp = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, null);
  }

  if (resp.status === 401 && !publica && !repetida) {
    if (await renovarToken()) return api(caminho, { metodo, corpo, publica, repetida: true });
    tokens.limpar();
    aoPerderSessao();
  }

  const texto = await resp.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new ErroApi(resp.status, dados);
  return dados;
}

// Atalhos usados nas telas
export const get = (caminho) => api(caminho);
export const post = (caminho, corpo = {}) => api(caminho, { metodo: "POST", corpo });
export const patch = (caminho, corpo) => api(caminho, { metodo: "PATCH", corpo });
export const put = (caminho, corpo) => api(caminho, { metodo: "PUT", corpo });
export const remover = (caminho) => api(caminho, { metodo: "DELETE" });

// Monta ?a=1&b=2 ignorando valores vazios
export function query(parametros) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") busca.set(chave, valor);
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}
