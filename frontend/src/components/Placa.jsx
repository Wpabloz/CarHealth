import { placaFormatada } from "../lib/formato";

/** Placa no estilo Mercosul: faixa "BRASIL" e o número, como no protótipo. */
export default function Placa({ placa, escura = false }) {
  return (
    <span className={`placa-br ${escura ? "placa-br--escura" : ""}`} aria-label={`Placa ${placaFormatada(placa)}`}>
      <span className="placa-br__pais" aria-hidden="true">BRASIL</span>
      <span className="placa-br__numero">{placaFormatada(placa)}</span>
    </span>
  );
}
