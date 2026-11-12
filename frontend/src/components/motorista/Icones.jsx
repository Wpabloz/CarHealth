/**
 * Ícones da área do motorista que o lucide-react não tem (pneu, freio e gancho do guincho),
 * no mesmo traço dos ícones do protótipo. Mesma interface dos ícones do lucide: size, strokeWidth.
 */
import { Droplet, Engine, Wrench, Zap } from "lucide-react";

function Svg({ size = 24, strokeWidth = 2, children, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

/** Pneu: roda com o cubo e quatro raios. */
export const Pneu = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v6" /><path d="M12 16v6" /><path d="M2 12h6" /><path d="M16 12h6" />
  </Svg>
);

/** Freio: disco com a pinça por cima. */
export const Freio = (props) => (
  <Svg {...props}>
    <circle cx="11" cy="13" r="8" />
    <circle cx="11" cy="13" r="2.5" />
    <path d="M15.4 3.5a10.5 10.5 0 0 1 5.1 5.1" />
  </Svg>
);

/** Guincho: gancho de içamento. */
export const Guincho = (props) => (
  <Svg {...props}>
    <path d="M9.5 3h5" />
    <path d="M12 3v10a4 4 0 1 1-8 0v-1.5" />
  </Svg>
);

const semAcento = (texto) => (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ícone do serviço pelo nome (Histórico e Avisos): óleo, pneu, freio, guincho, elétrica ou motor. */
export function iconeDoServico(descricao) {
  const t = semAcento(descricao);
  if (/oleo|lubrif|filtro/.test(t)) return Droplet;
  if (/pneu|rodizio|alinhamento|balanceamento|roda/.test(t)) return Pneu;
  if (/freio|pastilha|lona|disco/.test(t)) return Freio;
  if (/guincho|hidraulic|lanca|plataforma|cabo|asa/.test(t)) return Guincho;
  if (/eletric|bateria|luz|luzes|farol|lampada/.test(t)) return Zap;
  if (/motor|embreagem|correia|radiador|arrefec/.test(t)) return Engine;
  return Wrench;
}
