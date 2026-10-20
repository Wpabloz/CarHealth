/** Abas em pílula com contador ("Todos 9", "Pendentes 1"...), como no protótipo. */
export default function Segmentado({ opcoes, valor, aoMudar, rotulo }) {
  return (
    <div className="segmentado" role="tablist" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id}
          className={`segmentado__item ${valor === o.id ? "segmentado__item--ativo" : ""}`} onClick={() => aoMudar(o.id)}>
          {o.icone && <o.icone size={15} aria-hidden="true" />}
          <span>{o.rotulo}</span>
          {o.total !== undefined && <span className={`segmentado__total segmentado__total--${o.tom || "info"}`}>{o.total}</span>}
        </button>
      ))}
    </div>
  );
}
