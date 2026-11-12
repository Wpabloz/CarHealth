import { History } from "lucide-react";

import { get, query } from "../../api/client";
import { iconeDoServico } from "../../components/motorista/Icones";
import { CarregandoMo, Conteudo, IconeBloco, MenuInferior, TopoTitulo } from "../../components/motorista/ui";
import { useMotorista } from "../../layouts/motoristaContexto";
import { data, nomeVeiculo } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

/** 03 — Histórico: serviços já feitos no caminhão do dia, do mais recente (sem valores, RF36). */
export default function MHistorico() {
  const { veiculo } = useMotorista();
  const placa = veiculo?.placa;
  const ordens = useCarregar(() => (placa ? get(`/ordens-servico${query({ veiculo: placa })}`) : Promise.resolve([])), [placa]);
  const lista = [...(ordens.dados || [])].sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao) || b.numero - a.numero);
  const nome = veiculo ? nomeVeiculo(veiculo) : "caminhão";

  return (
    <>
      <TopoTitulo>Histórico</TopoTitulo>
      <Conteudo gap={20}>
        <p className="mo-texto">Serviços já feitos no {nome}.</p>
        {ordens.carregando && !ordens.dados ? <CarregandoMo /> : ordens.erro ? (
          <p className="mo-erro" role="alert">{ordens.erro.message}</p>
        ) : lista.length === 0 ? (
          <div className="mo-vazio">
            <IconeBloco icone={History} tamanho={52} raio={14} iconeTamanho={28} />
            <strong>Nenhum serviço registrado</strong>
            <span>Quando o {nome} passar por manutenção, ela aparece aqui.</span>
          </div>
        ) : (
          <ul className="mo-lista" aria-label="Serviços feitos">
            {lista.map((o) => (
              <li key={o.numero} className="mo-lista__item">
                <IconeBloco icone={iconeDoServico(o.descricao)} tamanho={44} raio={12} iconeTamanho={24} />
                <span className="mo-lista__textos">
                  <span className="mo-lista__titulo">{o.descricao}</span>
                  <span className="mo-lista__data">{data(o.data_conclusao)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Conteudo>
      <MenuInferior />
    </>
  );
}
