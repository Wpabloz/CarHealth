import { Navigate, useLocation } from "react-router-dom";
import { Check, House } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { BarraInferior, BotaoLinkMo, Conteudo, IconeBloco } from "../../components/motorista/ui";
import { km } from "../../lib/formato";
import { primeiroNome } from "../../lib/motorista";

/** 00d — Check-in feito: libera o app até o fim do dia. */
export default function CheckinFeito() {
  const { state } = useLocation();
  const { usuario } = useAuth();
  if (!state?.caminhao) return <Navigate to="/m" replace />;

  return (
    <>
      <Conteudo centro gap={20}>
        <span style={{ display: "flex", justifyContent: "center" }}>
          <IconeBloco icone={Check} tamanho={104} iconeTamanho={56} strokeWidth={2.4} circulo />
        </span>
        <h1 className="mo-titulo mo-titulo--30">Check-in feito!</h1>
        <p className="mo-texto mo-texto--18">
          Bom trabalho, {primeiroNome(usuario?.nome)}. O app está liberado até o fim do dia.
        </p>
        <div className="mo-resumo">
          <div className="mo-resumo__linha"><span>Caminhão</span><strong>{state.caminhao}</strong></div>
          <div className="mo-resumo__linha"><span>Quilometragem</span><strong>{km(state.quilometragem)}</strong></div>
          <div className="mo-resumo__linha"><span>Estado</span><strong>{state.estado}</strong></div>
        </div>
      </Conteudo>
      <BarraInferior>
        <BotaoLinkMo icone={House} to="/m" replace>Ir para o início</BotaoLinkMo>
      </BarraInferior>
    </>
  );
}
