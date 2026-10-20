import { useEffect, useMemo, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, ClipboardList, History, LayoutDashboard, LogOut, Truck, Users, Wrench,
} from "lucide-react";

import { get } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import Marca, { Simbolo } from "../components/Marca";
import Notificacoes from "../components/Notificacoes";
import { plural } from "../lib/formato";
import { useCarregar } from "../lib/useCarregar";
import { ResumoContext } from "./resumo";

const MENU = [
  { para: "/painel", rotulo: "Painel", icone: LayoutDashboard },
  { para: "/veiculos", rotulo: "Veículos", icone: Truck },
  { para: "/manutencoes", rotulo: "Manutenções", icone: Wrench },
  { para: "/lembretes", rotulo: "Lembretes", icone: Bell, contador: true },
  { para: "/historico", rotulo: "Histórico", icone: History },
];
const CADASTROS = [
  { para: "/motoristas", rotulo: "Motoristas", icone: Users },
  { para: "/planos", rotulo: "Planos de manutenção", icone: ClipboardList },
];

export default function LayoutGestor() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const painel = useCarregar(() => get("/painel"), []);
  const empresa = useCarregar(() => get(`/empresas/${usuario.cnpj_empresa}`), [usuario.cnpj_empresa]);

  // Ao trocar de tela, atualiza o resumo (lembretes sempre em dia com o que acabou de ser registrado)
  const primeira = useRef(true);
  const { recarregar } = painel;
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    recarregar();
  }, [pathname, recarregar]);

  const resumo = useMemo(
    () => ({ painel: painel.dados, empresa: empresa.dados, recarregarPainel: recarregar }),
    [painel.dados, empresa.dados, recarregar],
  );
  const pendencias = painel.dados?.pendencias.length || 0;
  const ativos = painel.dados?.veiculos.length;

  const aoSair = () => {
    sair();
    navegar("/login", { replace: true });
  };

  return (
    <ResumoContext.Provider value={resumo}>
      <div className="app">
        <aside className="lateral">
          <Link to="/painel" className="lateral__marca"><Marca /></Link>
          <nav className="lateral__menu" aria-label="Menu principal">
            {MENU.map(({ para, rotulo, icone: Icone, contador }) => (
              <NavLink key={para} to={para} className="lateral__item">
                <Icone size={18} aria-hidden="true" />
                <span>{rotulo}</span>
                {contador && pendencias > 0 && (
                  <span className="lateral__contador" aria-label={`${pendencias} pendentes`}>{pendencias}</span>
                )}
              </NavLink>
            ))}
            <span className="lateral__grupo">Cadastros</span>
            {CADASTROS.map(({ para, rotulo, icone: Icone }) => (
              <NavLink key={para} to={para} className="lateral__item">
                <Icone size={18} aria-hidden="true" />
                <span>{rotulo}</span>
              </NavLink>
            ))}
          </nav>
          <div className="lateral__rodape">
            <div className="lateral__empresa">
              <span className="lateral__empresa-nome"><i aria-hidden="true" />{empresa.dados?.razao_social || "Empresa"}</span>
              {ativos !== undefined && <span className="lateral__empresa-info">{plural(ativos, "veículo ativo", "veículos ativos")}</span>}
            </div>
            <button type="button" className="lateral__sair" onClick={aoSair}>
              <LogOut size={16} aria-hidden="true" /> Sair do sistema
            </button>
          </div>
        </aside>

        <div className="area">
          <header className="barra">
            <div className="barra__empresa">
              <Simbolo tamanho={30} />
              <span className="barra__nome">{empresa.dados?.razao_social}</span>
              <span className="barra__selo">Controle de Manutenção</span>
            </div>
            <div className="barra__direita">
              <Notificacoes pendencias={painel.dados?.pendencias || []} tolerancia={painel.dados?.tolerancia} />
              <NavLink to="/perfil" className="barra__conta">
                <span className="avatar" aria-hidden="true">{usuario.nome?.[0]?.toUpperCase() || "?"}</span>
                <span className="barra__conta-textos">
                  <span className="barra__conta-nome">{usuario.nome}</span>
                  <span className="barra__conta-perfil">Gestor</span>
                </span>
              </NavLink>
            </div>
          </header>
          <main className="principal">
            <Outlet />
          </main>
        </div>
      </div>
    </ResumoContext.Provider>
  );
}
