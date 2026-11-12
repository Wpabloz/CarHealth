import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Keyboard } from "lucide-react";

import { BarraInferior, BotaoMo, Conteudo, IconeBloco, TopoVoltar } from "../../components/motorista/ui";
import { placaDoCodigo } from "../../lib/motorista";

/**
 * "Digitar a placa" (alternativa à câmera no check-in). No mesmo formato da tela
 * "Informar km" do protótipo: uma pergunta, um campo grande e o botão embaixo.
 */
export default function CheckinPlaca() {
  const navegar = useNavigate();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");

  const aoEnviar = (evento) => {
    evento.preventDefault();
    const placa = placaDoCodigo(valor);
    if (!placa) {
      setErro("Confira a placa: 3 letras e 4 números ou letras, como ABC-1D23.");
      return;
    }
    navegar(`/m/checkin/${placa}`);
  };

  return (
    <form onSubmit={aoEnviar} noValidate style={{ display: "contents" }}>
      <TopoVoltar para="/m/checkin" />
      <Conteudo gap={24}>
        <IconeBloco icone={Keyboard} tamanho={64} raio={18} iconeTamanho={34} />
        <h1 className="mo-titulo mo-titulo--26"><label htmlFor="placa">Qual é a placa do caminhão?</label></h1>
        <div className="mo-grupo mo-grupo--10">
          <div className={`mo-km mo-placa-campo${erro ? " mo-km--erro" : ""}`} style={{ paddingRight: 20 }}>
            <input id="placa" autoFocus autoComplete="off" autoCapitalize="characters" maxLength={8} placeholder="ABC-1D23"
              value={valor} aria-invalid={erro ? true : undefined} aria-describedby={erro ? "placa-erro" : "placa-ajuda"}
              onChange={(e) => { setValor(e.target.value.toUpperCase()); setErro(""); }} />
          </div>
          {erro
            ? <p id="placa-erro" className="mo-erro" role="alert">{erro}</p>
            : <p id="placa-ajuda" className="mo-ajuda mo-ajuda--16">Está na etiqueta do painel e no documento do caminhão.</p>}
        </div>
      </Conteudo>
      <BarraInferior>
        <BotaoMo type="submit" icone={ArrowRight}>Continuar</BotaoMo>
      </BarraInferior>
    </form>
  );
}
