import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, Bell, Check, CircleAlert } from "lucide-react";

import { nomeVeiculo, plural, prazo } from "../lib/formato";
import { Selo } from "./ui";

const CHAVE_LIDAS = "carhealth.notificacoes-lidas";
const chave = (p) => `${p.placa}-${p.id_plano}-${p.situacao}-${p.data_prevista || p.km_previsto}`;
function lerLidas() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_LIDAS)) || []);
  } catch {
    return new Set();
  }
}

/** Urgência mostrada no sino: Atrasada, Urgente (até 7 dias ou 300 km) ou Atenção. */
function urgencia(p) {
  if (p.situacao === "VENCIDA") return { rotulo: "Atrasada", tom: "perigo", solido: true };
  const perto = (p.dias_restantes ?? Infinity) <= 7 || (p.km_restante ?? Infinity) <= 300;
  return perto ? { rotulo: "Urgente", tom: "atencao" } : { rotulo: "Atenção", tom: "info" };
}

/** Sino da barra superior com o painel "Notificações de Manutenção" do protótipo. */
export default function Notificacoes({ pendencias, tolerancia }) {
  const [aberto, setAberto] = useState(false);
  const [lidas, setLidas] = useState(lerLidas);
  const caixa = useRef(null);
  const novas = pendencias.filter((p) => !lidas.has(chave(p))).length;

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => caixa.current && !caixa.current.contains(e.target) && setAberto(false);
    const tecla = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const marcarTodas = () => {
    const todas = new Set([...lidas, ...pendencias.map(chave)]);
    setLidas(todas);
    try {
      localStorage.setItem(CHAVE_LIDAS, JSON.stringify([...todas]));
    } catch {
      /* sem armazenamento: vale até recarregar a página */
    }
  };

  return (
    <div className="notificacoes" ref={caixa}>
      <button type="button" className="notificacoes__sino" onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto} aria-label={novas ? `Notificações: ${novas} novas` : "Notificações"}>
        <Bell size={20} aria-hidden="true" />
        {novas > 0 && <span className="notificacoes__contador">{novas}</span>}
      </button>
      {aberto && (
        <div className="notificacoes__painel" role="dialog" aria-label="Notificações de Manutenção">
          <header className="notificacoes__topo">
            <span className="notificacoes__titulo"><Bell size={16} aria-hidden="true" /> Notificações de Manutenção</span>
            {pendencias.length > 0 && <Selo tom="perigo">{plural(pendencias.length, "ação pendente", "ações pendentes")}</Selo>}
          </header>
          {pendencias.length === 0 ? (
            <p className="notificacoes__vazio">Nenhuma pendência: a frota está em dia.</p>
          ) : (
            <ul className="notificacoes__lista">
              {pendencias.slice(0, 6).map((p) => {
                const u = urgencia(p);
                const Icone = p.situacao === "VENCIDA" ? CircleAlert : AlarmClock;
                return (
                  <li key={chave(p)}>
                    <Link to="/lembretes" className="notificacoes__item" onClick={() => setAberto(false)}>
                      <span className={`notificacoes__icone notificacoes__icone--${p.situacao === "VENCIDA" ? "perigo" : "atencao"}`}>
                        <Icone size={16} aria-hidden="true" />
                      </span>
                      <span className="notificacoes__textos">
                        <strong>{nomeVeiculo(p)}</strong>
                        <span>{p.descricao}</span>
                        <span className={`notificacoes__prazo texto--${p.situacao === "VENCIDA" ? "perigo" : "laranja"}`}>
                          • {prazo(p, tolerancia).selo}
                        </span>
                      </span>
                      <Selo tom={u.tom} solido={u.solido} ponto={false}>{u.rotulo}</Selo>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <footer className="notificacoes__rodape">
            <button type="button" className="link-discreto" onClick={marcarTodas}>
              <Check size={14} aria-hidden="true" /> Marcar todas como lidas
            </button>
            <button type="button" className="link-discreto link-discreto--forte" onClick={() => setAberto(false)}>Fechar</button>
          </footer>
        </div>
      )}
    </div>
  );
}
