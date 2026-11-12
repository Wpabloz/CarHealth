/** Peças da área do motorista, iguais às do protótipo no Figma (telas de 390 px). */
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, History, House, LogOut, RefreshCw, Truck } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { useMotorista } from "../../layouts/motoristaContexto";
import { iniciais, placaFormatada } from "../../lib/formato";

const juntar = (...classes) => classes.filter(Boolean).join(" ");

/** Topo com a marca e o avatar; o avatar abre o menu com "Trocar de caminhão" e "Sair". */
export function TopoMarca() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

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

  const aoSair = () => {
    sair();
    navegar("/login", { replace: true });
  };

  return (
    <header className="mo-topo">
      <span className="mo-marca">
        <span className="mo-logo" aria-hidden="true"><Truck size={20} strokeWidth={2.2} /></span>
        <span className="mo-marca__nome">Carhealth</span>
      </span>
      <div className="mo-conta" ref={caixa}>
        <button type="button" className="mo-avatar" aria-haspopup="menu" aria-expanded={aberto}
          aria-label={`Conta de ${usuario?.nome || "motorista"}`} onClick={() => setAberto((a) => !a)}>
          {iniciais(usuario?.nome)}
        </button>
        {aberto && (
          <div className="mo-menu" role="menu">
            <div className="mo-menu__quem">
              <strong>{usuario?.nome}</strong>
              <span>{usuario?.email}</span>
            </div>
            <Link to="/m/checkin" className="mo-menu__item" role="menuitem" onClick={() => setAberto(false)}>
              <RefreshCw size={20} aria-hidden="true" /> Trocar de caminhão
            </Link>
            <button type="button" className="mo-menu__item" role="menuitem" onClick={aoSair}>
              <LogOut size={20} aria-hidden="true" /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/** Topo com "Voltar" (telas de uma ação só). */
export function TopoVoltar({ para }) {
  return (
    <header className="mo-topo mo-topo--voltar">
      <Link to={para} className="mo-voltar"><ArrowLeft size={24} strokeWidth={2.3} aria-hidden="true" /> Voltar</Link>
    </header>
  );
}

/** Topo com o nome da tela (Avisos, Histórico). */
export function TopoTitulo({ children }) {
  return (
    <header className="mo-topo">
      <h1 className="mo-topo__titulo">{children}</h1>
    </header>
  );
}

export function Conteudo({ children, gap = 20, centro = false, ...props }) {
  return (
    <main className={juntar("mo-conteudo", centro && "mo-conteudo--centro")} style={{ "--gap": `${gap}px` }} {...props}>
      {children}
    </main>
  );
}

/** Menu de baixo (Início, Avisos com o número de avisos novos, Histórico). */
export function MenuInferior() {
  const { avisos } = useMotorista();
  const novos = avisos.filter((a) => !a.visto).length;
  return (
    <nav className="mo-nav" aria-label="Menu do motorista">
      <NavLink to="/m" end className="mo-nav__item">
        <span className="mo-nav__icone"><House size={26} strokeWidth={2} aria-hidden="true" /></span>Início
      </NavLink>
      <NavLink to="/m/avisos" className="mo-nav__item" aria-label={novos ? `Avisos, ${novos} novos` : "Avisos"}>
        <span className="mo-nav__icone">
          <Bell size={26} strokeWidth={2} aria-hidden="true" />
          {novos > 0 && <span className="mo-badge" aria-hidden="true">{novos}</span>}
        </span>
        Avisos
      </NavLink>
      <NavLink to="/m/historico" className="mo-nav__item">
        <span className="mo-nav__icone"><History size={26} strokeWidth={2} aria-hidden="true" /></span>Histórico
      </NavLink>
    </nav>
  );
}

/** Barra fixa de baixo com o botão principal da tela. */
export const BarraInferior = ({ children }) => <div className="mo-barra">{children}</div>;

export function BotaoMo({ variante = "primario", icone: Icone, carregando, children, className, alto, ...props }) {
  return (
    <button type="button" className={juntar("mo-botao", variante !== "primario" && `mo-botao--${variante}`, alto && "mo-botao--alto", className)}
      disabled={carregando || props.disabled} aria-busy={carregando || undefined} {...props}>
      {Icone && <Icone size={variante === "marinho" || variante === "visto" ? 22 : 24} strokeWidth={2.3} aria-hidden="true" />}
      <span>{carregando ? "Aguarde…" : children}</span>
    </button>
  );
}

export function BotaoLinkMo({ variante = "primario", icone: Icone, children, alto, ...props }) {
  return (
    <Link className={juntar("mo-botao", variante !== "primario" && `mo-botao--${variante}`, alto && "mo-botao--alto")} {...props}>
      {Icone && <Icone size={24} strokeWidth={2.3} aria-hidden="true" />}
      <span>{children}</span>
    </Link>
  );
}

/** Quadrado com ícone (60 px no Início, 64 px nas telas de uma ação, 52 px nos avisos, 44 px nas listas). */
export function IconeBloco({ icone: Icone, tamanho = 60, raio = 16, iconeTamanho = 32, tom, circulo, strokeWidth = 2 }) {
  return (
    <span className={juntar("mo-icone", tom && `mo-icone--${tom}`, circulo && "mo-icone--circulo")}
      style={{ "--t": `${tamanho}px`, "--r": `${raio}px` }} aria-hidden="true">
      <Icone size={iconeTamanho} strokeWidth={strokeWidth} />
    </span>
  );
}

export const PlacaMo = ({ placa, clara }) => (
  <span className={juntar("mo-placa", clara && "mo-placa--clara")}>{placaFormatada(placa)}</span>
);

export const CarregandoMo = ({ texto = "Carregando…" }) => <p className="mo-carregando" role="status">{texto}</p>;

/** Campo grande de quilometragem ("182.615 km"), como no protótipo. */
export function CampoKm({ id, valor, aoMudar, erro, placeholder, rotuloOculto, autoFocus }) {
  const exibido = valor ? Number(valor).toLocaleString("pt-BR") : "";
  return (
    <div className={juntar("mo-km", erro && "mo-km--erro")}>
      <input id={id} inputMode="numeric" autoComplete="off" value={exibido} placeholder={placeholder}
        aria-label={rotuloOculto} aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-erro` : undefined}
        autoFocus={autoFocus} onChange={(e) => aoMudar(e.target.value.replace(/\D/g, "").slice(0, 7))} />
      <span className="mo-km__sufixo" aria-hidden="true">km</span>
    </div>
  );
}
