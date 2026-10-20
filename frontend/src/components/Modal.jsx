import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Janela sobre a tela (ex.: "Cadastrar Novo Veículo"). Fecha com Esc, com o X ou clicando fora.
 * Com aoEnviar, o conteúdo vira um formulário e o botão type="submit" do rodapé envia.
 */
export default function Modal({ aberto, aoFechar, migalha, titulo, subtitulo, children, rodape, aoEnviar, largura = 680 }) {
  const id = useId();
  const caixa = useRef(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  // Só ao abrir: foca o primeiro campo, trava a rolagem da página e escuta o Esc
  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const tecla = (e) => e.key === "Escape" && fechar.current();
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    caixa.current?.querySelector("input:not([disabled]), select, textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;
  const Corpo = aoEnviar ? "form" : "div";
  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div ref={caixa} className="modal__caixa" role="dialog" aria-modal="true" aria-labelledby={id} style={{ maxWidth: largura }}>
        <Corpo className="modal__conteudo" onSubmit={aoEnviar} noValidate={aoEnviar ? true : undefined}>
          <header className="modal__topo">
            {migalha && <p className="migalha">{migalha}</p>}
            <h2 id={id} className="modal__titulo">{titulo}</h2>
            {subtitulo && <p className="modal__subtitulo">{subtitulo}</p>}
            <button type="button" className="modal__fechar" onClick={aoFechar} aria-label="Fechar">
              <X size={20} />
            </button>
          </header>
          <div className="modal__corpo">{children}</div>
          {rodape && <footer className="modal__rodape">{rodape}</footer>}
        </Corpo>
      </div>
    </div>,
    document.body,
  );
}
