import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Gauge } from "lucide-react";

import { ErroApi, post } from "../../api/client";
import { BarraInferior, BotaoMo, CampoKm, Conteudo, IconeBloco, TopoVoltar } from "../../components/motorista/ui";
import { useMotorista } from "../../layouts/motoristaContexto";
import { km } from "../../lib/formato";

/** 04 — Informar km: um campo só; a data é a de hoje e km menor que a última é recusada (CA18). */
export default function MInformarKm() {
  const navegar = useNavigate();
  const { veiculo, recarregar } = useMotorista();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = async (evento) => {
    evento.preventDefault();
    if (!valor) {
      setErro("Informe a quilometragem do painel.");
      return;
    }
    setEnviando(true);
    try {
      await post("/leituras-odometro", { placa_veiculo: veiculo.placa, quilometragem: Number(valor) });
      await recarregar();
      navegar("/m", { replace: true, state: { aviso: "Quilometragem salva." } });
    } catch (e) {
      if (!(e instanceof ErroApi)) throw e;
      setErro(e.campos.quilometragem || e.campos.placa_veiculo || e.message);
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={aoEnviar} noValidate style={{ display: "contents" }}>
      <TopoVoltar para="/m" />
      <Conteudo gap={24}>
        <IconeBloco icone={Gauge} tamanho={64} raio={18} iconeTamanho={34} strokeWidth={2} />
        <h1 className="mo-titulo mo-titulo--26"><label htmlFor="km">Quantos km o painel do caminhão mostra?</label></h1>
        <div className="mo-grupo mo-grupo--10">
          <CampoKm id="km" valor={valor} erro={erro} autoFocus
            placeholder={veiculo?.km_atual ? Number(veiculo.km_atual).toLocaleString("pt-BR") : "0"}
            aoMudar={(v) => { setValor(v); setErro(""); }} />
          {erro
            ? <p id="km-erro" className="mo-erro" role="alert">{erro}</p>
            : <p className="mo-ajuda mo-ajuda--16">Da última vez você informou {km(veiculo?.km_atual)}.</p>}
        </div>
      </Conteudo>
      <BarraInferior>
        <BotaoMo type="submit" icone={Check} carregando={enviando}>Salvar</BotaoMo>
      </BarraInferior>
    </form>
  );
}
