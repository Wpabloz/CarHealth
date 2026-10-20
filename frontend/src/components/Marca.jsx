import { Truck } from "lucide-react";

/** Logotipo do protótipo: quadrado azul-marinho com o guincho em laranja e "CarHealth". */
export function Simbolo({ tamanho = 34 }) {
  return (
    <span className="simbolo" style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <Truck size={Math.round(tamanho * 0.55)} />
    </span>
  );
}

export default function Marca({ compacta = false }) {
  return (
    <div className={`marca ${compacta ? "marca--compacta" : ""}`}>
      <Simbolo tamanho={compacta ? 28 : 36} />
      <span className="marca__textos">
        <span className="marca__nome">Car<span>Health</span></span>
        {!compacta && <span className="marca__sub">Gestão Veicular</span>}
      </span>
    </div>
  );
}
