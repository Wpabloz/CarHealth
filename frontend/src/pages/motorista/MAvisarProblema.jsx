import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CircleEllipsis, Engine, Send, Zap } from "lucide-react";

import { ErroApi, post } from "../../api/client";
import { Freio, Guincho, Pneu } from "../../components/motorista/Icones";
import { BarraInferior, BotaoMo, Conteudo, TopoVoltar } from "../../components/motorista/ui";
import { useMotorista } from "../../layouts/motoristaContexto";

const PECAS = [
  ["FREIO", "Freio", Freio], ["MOTOR", "Motor", Engine], ["PNEU", "Pneu", Pneu],
  ["LUZES", "Luzes", Zap], ["GUINCHO", "Guincho", Guincho], ["OUTRO", "Outro", CircleEllipsis],
];

/** 05 — Avisar problema: onde está, se o caminhão pode continuar rodando e, se quiser, uma explicação. */
export default function MAvisarProblema() {
  const navegar = useNavigate();
  const { veiculo, recarregar } = useMotorista();
  const [valores, setValores] = useState({ componente: "", pode_rodar: null, descricao: "" });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo, valor) => {
    setValores((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined, geral: undefined }));
  };

  const aoEnviar = async (evento) => {
    evento.preventDefault();
    const faltando = {};
    if (!valores.componente) faltando.componente = "Escolha onde está o problema.";
    if (valores.pode_rodar === null) faltando.pode_rodar = "Responda se o caminhão pode continuar rodando.";
    if (Object.keys(faltando).length) {
      setErros(faltando);
      return;
    }
    setEnviando(true);
    try {
      const aviso = await post("/problemas", { placa_veiculo: veiculo.placa, ...valores, descricao: valores.descricao.trim() });
      await recarregar();
      navegar("/m/problema/enviado", { replace: true, state: { problema: aviso.componente_nome, podeRodar: aviso.pode_rodar } });
    } catch (e) {
      if (!(e instanceof ErroApi)) throw e;
      setErros({ ...e.campos, geral: Object.keys(e.campos).length ? undefined : e.message });
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={aoEnviar} noValidate style={{ display: "contents" }}>
      <TopoVoltar para="/m" />
      <Conteudo gap={24}>
        <h1 className="mo-titulo mo-titulo--26">Avisar um problema</h1>

        <fieldset className="mo-fieldset">
          <legend className="mo-rotulo" style={{ marginBottom: 12 }}>Onde está o problema?</legend>
          <div className="mo-pecas">
            {PECAS.map(([id, rotulo, Icone]) => {
              const sel = valores.componente === id;
              return (
                <label key={id} className={`mo-peca${sel ? " mo-peca--sel" : ""}`}>
                  <input type="radio" name="componente" value={id} checked={sel} onChange={() => mudar("componente", id)} />
                  <Icone size={32} strokeWidth={2} aria-hidden="true" />
                  <span className="mo-peca__nome">{rotulo}</span>
                  {sel && <span className="mo-peca__marca" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>}
                </label>
              );
            })}
          </div>
          {erros.componente && <p className="mo-erro" role="alert">{erros.componente}</p>}
        </fieldset>

        <fieldset className="mo-fieldset">
          <legend className="mo-rotulo" style={{ marginBottom: 12 }}>O caminhão pode continuar rodando?</legend>
          <div className="mo-escolhas">
            {[[true, "Sim"], [false, "Não"]].map(([valor, rotulo]) => {
              const sel = valores.pode_rodar === valor;
              return (
                <label key={rotulo} className={`mo-escolha${sel ? " mo-escolha--sel" : ""}`}>
                  <input type="radio" name="pode_rodar" checked={sel} onChange={() => mudar("pode_rodar", valor)} />
                  {sel && <Check size={22} strokeWidth={2.5} aria-hidden="true" />} {rotulo}
                </label>
              );
            })}
          </div>
          {erros.pode_rodar && <p className="mo-erro" role="alert">{erros.pode_rodar}</p>}
        </fieldset>

        <div className="mo-grupo mo-grupo--10">
          <label className="mo-rotulo" htmlFor="descricao">Quer explicar melhor?<small>(opcional)</small></label>
          <textarea id="descricao" className="mo-texto-livre" maxLength={500} placeholder="Ex.: faz barulho quando eu freio"
            value={valores.descricao} onChange={(e) => mudar("descricao", e.target.value)} />
          {erros.descricao && <p className="mo-erro" role="alert">{erros.descricao}</p>}
        </div>
        {erros.geral && <p className="mo-erro" role="alert">{erros.geral}</p>}
      </Conteudo>
      <BarraInferior>
        <BotaoMo type="submit" icone={Send} carregando={enviando}>Enviar aviso</BotaoMo>
      </BarraInferior>
    </form>
  );
}
