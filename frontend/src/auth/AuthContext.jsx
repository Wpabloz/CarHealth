import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { api, get, quandoPerderSessao, tokens } from "../api/client";
import { Carregando } from "../components/ui";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Ao abrir o site, se já houver token salvo, busca os dados da conta
  useEffect(() => {
    quandoPerderSessao(() => setUsuario(null));
    if (!tokens.ler().access) {
      setCarregando(false);
      return;
    }
    get("/auth/me")
      .then(setUsuario)
      .catch(() => tokens.limpar())
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const novos = await api("/auth/login", { metodo: "POST", corpo: { email, password: senha }, publica: true });
    tokens.salvar(novos);
    const conta = await get("/auth/me");
    setUsuario(conta);
    return conta;
  }, []);

  const criarConta = useCallback(async (dados) => {
    const resp = await api("/auth/registrar", { metodo: "POST", corpo: dados, publica: true });
    tokens.salvar({ access: resp.access, refresh: resp.refresh });
    setUsuario(resp.usuario);
    return resp.usuario;
  }, []);

  const sair = useCallback(() => {
    tokens.limpar();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, criarConta, sair, isGestor: usuario?.perfil === "GESTOR" }),
    [usuario, carregando, entrar, criarConta, sair],
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
