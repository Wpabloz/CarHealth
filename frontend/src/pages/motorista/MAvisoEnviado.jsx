import { Navigate, useLocation } from "react-router-dom";
import { Check, House } from "lucide-react";

import { BarraInferior, BotaoLinkMo, Conteudo, IconeBloco } from "../../components/motorista/ui";

/** 06 — Aviso enviado: confirmação com o resumo do que foi avisado. */
export default function MAvisoEnviado() {
  const { state } = useLocation();
  if (!state?.problema) return <Navigate to="/m" replace />;

  return (
    <>
      <Conteudo centro gap={20}>
        <span style={{ display: "flex", justifyContent: "center" }}>
          <IconeBloco icone={Check} tamanho={104} iconeTamanho={56} strokeWidth={2.4} circulo />
        </span>
        <h1 className="mo-titulo mo-titulo--30">Aviso enviado!</h1>
        <p className="mo-texto mo-texto--18">O responsável pela frota já recebeu. A resposta vai aparecer no Início.</p>
        <div className="mo-resumo" style={{ marginTop: 4 }}>
          <div className="mo-resumo__linha"><span>Problema</span><strong>{state.problema}</strong></div>
          <div className="mo-resumo__linha"><span>Pode rodar?</span><strong>{state.podeRodar ? "Sim" : "Não"}</strong></div>
        </div>
      </Conteudo>
      <BarraInferior>
        <BotaoLinkMo icone={House} to="/m" replace>Voltar ao início</BotaoLinkMo>
      </BarraInferior>
    </>
  );
}
