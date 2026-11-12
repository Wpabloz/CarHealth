import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Truck } from "lucide-react";

import { ErroApi, get, post } from "../../api/client";
import { BarraInferior, BotaoMo, CampoKm, CarregandoMo, Conteudo, TopoVoltar } from "../../components/motorista/ui";
import { useMotorista } from "../../layouts/motoristaContexto";
import { km, nomeVeiculo, placaFormatada } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

const ESTADOS = [["BOM", "Bom"], ["REGULAR", "Regular"], ["RUIM", "Ruim"]];

/** 00c — Check-in do dia: km do painel, como está o caminhão e, se não estiver bom, o que foi notado. */
export default function CheckinDados() {
  const { placa } = useParams();
  const navegar = useNavigate();
  const { recarregar } = useMotorista();
  const veiculo = useCarregar(() => get(`/veiculos/${placa}`), [placa]);
  const [valores, setValores] = useState({ quilometragem: "", estado_geral: "", observacao: "" });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const v = veiculo.dados;

  const mudar = (campo, valor) => {
    setValores((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined, geral: undefined }));
  };

  const aoEnviar = async (evento) => {
    evento.preventDefault();
    const faltando = {};
    if (!valores.quilometragem) faltando.quilometragem = "Informe a quilometragem do painel.";
    if (!valores.estado_geral) faltando.estado_geral = "Escolha como está o caminhão.";
    if (valores.estado_geral && valores.estado_geral !== "BOM" && !valores.observacao.trim()) {
      faltando.observacao = "Conte o que você notou.";
    }
    if (Object.keys(faltando).length) {
      setErros(faltando);
      return;
    }
    setEnviando(true);
    try {
      await post("/checkins", {
        placa_veiculo: placa,
        quilometragem: Number(valores.quilometragem),
        estado_geral: valores.estado_geral,
        observacao: valores.estado_geral === "BOM" ? "" : valores.observacao.trim(),
      });
      await recarregar();
      navegar("/m/checkin/feito", {
        replace: true,
        state: { caminhao: nomeVeiculo(v), quilometragem: Number(valores.quilometragem),
                 estado: ESTADOS.find(([id]) => id === valores.estado_geral)[1] },
      });
    } catch (erro) {
      if (!(erro instanceof ErroApi)) throw erro;
      setErros({ ...erro.campos, geral: Object.keys(erro.campos).length ? undefined : erro.message });
      setEnviando(false);
    }
  };

  if (!v) return <><TopoVoltar para={`/m/checkin/${placa}`} />{veiculo.erro ? <p className="mo-carregando">{veiculo.erro.message}</p> : <CarregandoMo />}</>;

  const precisaObservacao = valores.estado_geral && valores.estado_geral !== "BOM";

  return (
    <form onSubmit={aoEnviar} noValidate style={{ display: "contents" }}>
      <TopoVoltar para={`/m/checkin/${placa}`} />
      <Conteudo gap={24}>
        <div className="mo-grupo mo-grupo--10">
          <span className="mo-chip mo-chip--veiculo">
            <Truck size={18} strokeWidth={2.2} aria-hidden="true" /> {nomeVeiculo(v)} · {placaFormatada(v.placa)}
          </span>
          <h1 className="mo-titulo mo-titulo--26">Check-in do dia</h1>
        </div>

        <div className="mo-grupo mo-grupo--10">
          <label className="mo-rotulo" htmlFor="km">Quantos km o painel mostra?</label>
          <CampoKm id="km" valor={valores.quilometragem} aoMudar={(valor) => mudar("quilometragem", valor)}
            erro={erros.quilometragem} placeholder={v.km_atual ? Number(v.km_atual).toLocaleString("pt-BR") : "0"} />
          {erros.quilometragem
            ? <p id="km-erro" className="mo-erro" role="alert">{erros.quilometragem}</p>
            : <p className="mo-ajuda">Da última vez: {km(v.km_atual)}.</p>}
        </div>

        <fieldset className="mo-fieldset">
          <legend className="mo-rotulo" style={{ marginBottom: 12 }}>Como está o caminhão hoje?</legend>
          <div className="mo-escolhas mo-escolhas--3" role="radiogroup">
            {ESTADOS.map(([id, rotulo]) => {
              const sel = valores.estado_geral === id;
              return (
                <label key={id} className={`mo-escolha${sel ? " mo-escolha--sel" : ""}`}>
                  <input type="radio" name="estado_geral" value={id} checked={sel} onChange={() => mudar("estado_geral", id)} />
                  {sel && <Check size={20} strokeWidth={2.5} aria-hidden="true" />} {rotulo}
                </label>
              );
            })}
          </div>
          {erros.estado_geral && <p className="mo-erro" role="alert">{erros.estado_geral}</p>}
        </fieldset>

        {precisaObservacao && (
          <div className="mo-grupo mo-grupo--10">
            <label className="mo-rotulo" htmlFor="observacao">O que você notou?<small>(obrigatório)</small></label>
            <textarea id="observacao" className={`mo-texto-livre${erros.observacao ? " mo-texto-livre--erro" : ""}`}
              maxLength={255} placeholder="Ex.: pneu traseiro meio murcho" value={valores.observacao}
              aria-invalid={erros.observacao ? true : undefined} onChange={(e) => mudar("observacao", e.target.value)} />
            {erros.observacao
              ? <p className="mo-erro" role="alert">{erros.observacao}</p>
              : <p className="mo-ajuda">O responsável pela frota vai ver essa observação.</p>}
          </div>
        )}

        {(erros.geral || erros.placa_veiculo) && <p className="mo-erro" role="alert">{erros.geral || erros.placa_veiculo}</p>}
      </Conteudo>
      <BarraInferior>
        <BotaoMo type="submit" icone={Check} carregando={enviando}>Fazer check-in</BotaoMo>
      </BarraInferior>
    </form>
  );
}
