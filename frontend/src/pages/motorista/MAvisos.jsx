import { useState } from "react";
import { Calendar, Check, CircleCheck, TriangleAlert } from "lucide-react";

import { iconeDoServico } from "../../components/motorista/Icones";
import { BotaoMo, Conteudo, IconeBloco, MenuInferior, TopoTitulo } from "../../components/motorista/ui";
import { useMotorista } from "../../layouts/motoristaContexto";
import { nomeVeiculo } from "../../lib/formato";
import { prazoDoAviso, tomDoAviso } from "../../lib/motorista";

function Aviso({ aviso }) {
  const { marcarVisto } = useMotorista();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const tom = tomDoAviso(aviso);

  const entendi = async () => {
    setEnviando(true);
    setErro("");
    try {
      await marcarVisto(aviso.id_plano);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <article className="mo-aviso">
      <div className="mo-aviso__cabeca">
        <IconeBloco icone={iconeDoServico(aviso.descricao)} tamanho={52} raio={14} iconeTamanho={28}
          tom={tom === "azul" ? undefined : tom} />
        <div className="mo-aviso__textos">
          <h2 className="mo-aviso__titulo">{aviso.descricao}</h2>
          <span className={`mo-aviso__prazo${tom === "azul" ? "" : ` mo-aviso__prazo--${tom}`}`}>
            {tom === "vermelho" ? <TriangleAlert size={18} strokeWidth={2.2} aria-hidden="true" />
              : <Calendar size={18} strokeWidth={2.2} aria-hidden="true" />}
            {prazoDoAviso(aviso)}
          </span>
        </div>
      </div>
      {aviso.visto ? (
        <p className="mo-botao mo-botao--visto" style={{ margin: 0 }}>
          <Check size={22} strokeWidth={2.3} aria-hidden="true" /> Você já viu
        </p>
      ) : (
        <BotaoMo variante="marinho" icone={Check} carregando={enviando} onClick={entendi}>Entendi</BotaoMo>
      )}
      {erro && <p className="mo-erro" role="alert">{erro}</p>}
    </article>
  );
}

/** 02 — Avisos: manutenções atrasadas ou próximas do caminhão; "Entendi" avisa o responsável. */
export default function MAvisos() {
  const { avisos, veiculo } = useMotorista();
  return (
    <>
      <TopoTitulo>Avisos</TopoTitulo>
      <Conteudo gap={20}>
        <p className="mo-texto">Toque em “Entendi” para o responsável saber que você viu o aviso.</p>
        {avisos.length === 0 ? (
          <div className="mo-vazio">
            <IconeBloco icone={CircleCheck} tamanho={52} raio={14} iconeTamanho={28} />
            <strong>Nenhum aviso agora</strong>
            <span>As manutenções do {veiculo ? nomeVeiculo(veiculo) : "caminhão"} estão em dia.</span>
          </div>
        ) : (
          <div className="mo-avisos">
            {avisos.map((a) => <Aviso key={`${a.id_plano}-${a.referencia}`} aviso={a} />)}
          </div>
        )}
      </Conteudo>
      <MenuInferior />
    </>
  );
}
