import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, CircleCheck, History, Wrench } from "lucide-react";

import { get, post } from "../../api/client";
import {
  Aviso, AvisoDaNavegacao, Botao, BotaoLink, Cabecalho, Cartao, Conteudo, Dado, SeloStatus,
} from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import { data, dinheiro, km, nomeVeiculo, placaFormatada } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import ConcluirModal from "./ConcluirModal";

/** Detalhe da ordem: tudo o que foi registrado; concluir ou cancelar enquanto estiver aberta (RN11, RF28). */
export default function OrdemDetalhe() {
  const { numero } = useParams();
  const { painel, recarregarPainel } = useResumo();
  const ordem = useCarregar(() => get(`/ordens-servico/${numero}`), [numero]);
  const [mensagem, setMensagem] = useState("");
  const [concluindo, setConcluindo] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const o = ordem.dados;
  const veiculo = o && (painel?.veiculos.find((v) => v.placa === o.placa_veiculo) || { placa: o.placa_veiculo });
  const aoMudar = (texto) => {
    setMensagem(texto);
    setConcluindo(false);
    setConfirmarCancelar(false);
    ordem.recarregar();
    recarregarPainel();
  };
  const cancelar = async () => {
    setEnviando(true);
    setErro("");
    try {
      await post(`/ordens-servico/${numero}/cancelar`);
      aoMudar("Ordem de serviço cancelada. O registro continua no sistema.");
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Cabecalho voltar={o ? `/historico/${o.placa_veiculo}` : "/manutencoes"}
        migalha={<><Wrench size={13} aria-hidden="true" /> Manutenções / Ordem de serviço</>}
        titulo={`Ordem de serviço nº ${numero}`}
        subtitulo={o && <>Veículo <Link to={`/historico/${o.placa_veiculo}`}>{nomeVeiculo(veiculo)} · {placaFormatada(o.placa_veiculo)}</Link></>}
        acoes={o && <SeloStatus status={o.status} />} />
      <AvisoDaNavegacao />
      <Aviso tipo="sucesso" icone={CircleCheck}>{mensagem}</Aviso>
      <Aviso tipo="erro">{erro}</Aviso>

      <Conteudo carregando={ordem.carregando && !o} erro={ordem.erro} tentar={ordem.recarregar}>
        {o && (
          <>
            <Cartao>
              <dl className="dados dados--2">
                <Dado rotulo="Serviço">{o.descricao}</Dado>
                <Dado rotulo="Tipo">{o.id_plano ? "Preventiva (com plano)" : "Corretiva"}</Dado>
                <Dado rotulo="Abertura">{data(o.data_abertura)}</Dado>
                <Dado rotulo="Conclusão">{data(o.data_conclusao)}</Dado>
                <Dado rotulo="Oficina">{o.oficina || "—"}</Dado>
                <Dado rotulo="Quilometragem">{o.quilometragem === null ? "—" : km(o.quilometragem)}</Dado>
                <Dado rotulo="Valor">{dinheiro(o.valor)}</Dado>
                <Dado rotulo="Aberta por">{o.email_emitente}</Dado>
              </dl>
            </Cartao>

            <div className="botoes">
              {o.status === "ABERTA" && !confirmarCancelar && (
                <>
                  <Botao icone={CircleCheck} onClick={() => setConcluindo(true)}>Concluir manutenção</Botao>
                  <Botao variante="contorno" icone={Ban} onClick={() => setConfirmarCancelar(true)}>Cancelar ordem</Botao>
                </>
              )}
              {confirmarCancelar && (
                <div className="confirmacao">
                  <span>Cancelar a ordem nº {numero}? Ela continua registrada, com status Cancelada.</span>
                  <Botao variante="perigo" carregando={enviando} onClick={cancelar}>Sim, cancelar</Botao>
                  <Botao variante="contorno" onClick={() => setConfirmarCancelar(false)}>Não</Botao>
                </div>
              )}
              <BotaoLink variante="suave" icone={History} to={`/historico/${o.placa_veiculo}`}>Ver histórico do veículo</BotaoLink>
            </div>

            <ConcluirModal ordem={concluindo ? o : null} veiculo={veiculo} aoFechar={() => setConcluindo(false)}
              aoConcluir={() => aoMudar("Ordem concluída. Próxima manutenção recalculada.")} />
          </>
        )}
      </Conteudo>
    </>
  );
}
