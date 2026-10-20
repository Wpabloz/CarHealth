import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
  api, get, idadeDoRefreshMs, janelaDaSessaoMs, quandoPerderSessao, renovarToken, revogarRefresh, tokens,
} from "../api/client";
import { Carregando } from "../components/ui";
import { plural } from "../lib/formato";

const AuthContext = createContext(null);

// Última vez que alguém usou o sistema neste navegador (vale para todas as abas)
const CHAVE_ATIVIDADE = "carhealth.ultima-atividade";
const EVENTOS_DE_USO = ["pointerdown", "keydown", "scroll", "touchstart"];
function lerAtividade() {
  try {
    return Number(localStorage.getItem(CHAVE_ATIVIDADE)) || 0;
  } catch {
    return 0;
  }
}
function marcarAtividade() {
  try {
    localStorage.setItem(CHAVE_ATIVIDADE, String(Date.now()));
  } catch {
    /* sem armazenamento: a inatividade é contada só pelo servidor */
  }
}
const avisoDeInatividade = (janela) =>
  `Sua sessão foi encerrada depois de ${plural(Math.round(janela / 60000), "minuto")} sem uso. Entre de novo.`;

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [motivoSaida, setMotivoSaida] = useState(""); // mostrado na tela de login

  /** Encerra a sessão: revoga o refresh na API e apaga os tokens deste navegador. */
  const encerrar = useCallback((motivo = "") => {
    const { refresh } = tokens.ler();
    tokens.limpar();
    revogarRefresh(refresh);
    setMotivoSaida(motivo);
    setUsuario(null);
  }, []);

  // Ao abrir o site: se a última atividade passou da janela, a sessão já acabou (RF02); senão busca a conta
  useEffect(() => {
    quandoPerderSessao(() => {
      setMotivoSaida("Sua sessão expirou. Entre de novo.");
      setUsuario(null);
    });
    if (!tokens.ler().access) {
      setCarregando(false);
      return;
    }
    const janela = janelaDaSessaoMs();
    const ultima = lerAtividade();
    if (ultima && Date.now() - ultima > janela) {
      encerrar(avisoDeInatividade(janela));
      setCarregando(false);
      return;
    }
    get("/auth/me")
      .then(setUsuario)
      .catch(() => tokens.limpar())
      .finally(() => setCarregando(false));
  }, [encerrar]);

  // Enquanto há alguém logado: conta a inatividade e mantém a sessão viva no servidor enquanto há uso
  const logado = Boolean(usuario);
  useEffect(() => {
    if (!logado) return undefined;
    const janela = janelaDaSessaoMs();
    let marcadoEm = 0;
    marcarAtividade();

    const aoUsar = () => {
      const agora = Date.now();
      if (agora - marcadoEm < 5000) return; // no máximo uma marca a cada 5 segundos
      marcadoEm = agora;
      marcarAtividade();
      // Usar a tela sem chamar a API (ex.: preencher um formulário) também conta como uso
      if (idadeDoRefreshMs() > Math.min(5 * 60000, janela / 3)) renovarToken().catch(() => {});
    };
    const conferir = () => {
      if (Date.now() - lerAtividade() > janela) encerrar(avisoDeInatividade(janela));
    };
    // Saiu em outra aba: sai nesta também
    const aoMudarArmazenamento = (e) => {
      if (e.key === "carhealth.tokens" && !e.newValue) setUsuario(null);
    };

    EVENTOS_DE_USO.forEach((e) => window.addEventListener(e, aoUsar, { passive: true }));
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("storage", aoMudarArmazenamento);
    const relogio = setInterval(conferir, 15000);
    return () => {
      EVENTOS_DE_USO.forEach((e) => window.removeEventListener(e, aoUsar));
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("storage", aoMudarArmazenamento);
      clearInterval(relogio);
    };
  }, [logado, encerrar]);

  const entrar = useCallback(async (email, senha) => {
    const novos = await api("/auth/login", { metodo: "POST", corpo: { email, password: senha }, publica: true });
    tokens.salvar(novos);
    marcarAtividade();
    const conta = await get("/auth/me");
    setMotivoSaida("");
    setUsuario(conta);
    return conta;
  }, []);

  const criarConta = useCallback(async (dados) => {
    const resp = await api("/auth/registrar", { metodo: "POST", corpo: dados, publica: true });
    tokens.salvar({ access: resp.access, refresh: resp.refresh });
    marcarAtividade();
    setMotivoSaida("");
    setUsuario(resp.usuario);
    return resp.usuario;
  }, []);

  const sair = useCallback(() => encerrar(""), [encerrar]);

  // Depois de editar o perfil, a barra superior e o menu mostram os dados novos
  const atualizarConta = useCallback((conta) => setUsuario(conta), []);

  const valor = useMemo(
    () => ({
      usuario, carregando, motivoSaida, entrar, criarConta, sair, atualizarConta,
      isGestor: usuario?.perfil === "GESTOR",
    }),
    [usuario, carregando, motivoSaida, entrar, criarConta, sair, atualizarConta],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Página inicial de cada perfil (RF04): gestor no Painel, motorista na lista de veículos. */
export function inicioDoPerfil(usuario) {
  return usuario?.perfil === "MOTORISTA" ? "/m/veiculos" : "/painel";
}

/** Só deixa entrar quem está logado com o perfil certo; os outros vão para a própria área. */
export function ExigePerfil({ perfil, children }) {
  const { usuario, carregando } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/login" replace state={{ voltarPara: local.pathname }} />;
  if (perfil && usuario.perfil !== perfil) return <Navigate to={inicioDoPerfil(usuario)} replace />;
  return children;
}

/** Login e Criar conta: quem já está logado vai direto para a sua área. */
export function SoDeslogado({ children }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (usuario) return <Navigate to={inicioDoPerfil(usuario)} replace />;
  return children;
}
