import { useParams } from "react-router-dom";

import { get, query } from "../../api/client";
import { Cabecalho, Conteudo, Vazio } from "../../components/ui";
import { data, km } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

/** O que já foi feito no veículo, sem os valores pagos (RF36, CA25). */
export default function MHistorico() {
  const { placa } = useParams();
  const ordens = useCarregar(() => get(`/ordens-servico${query({ veiculo: placa })}`), [placa]);
  const lista = [...(ordens.dados || [])].sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao));

  return (
    <>
      <Cabecalho voltar={`/m/veiculos/${placa}`} titulo="Histórico do veículo" subtitulo={placa} />
      <Conteudo carregando={ordens.carregando} erro={ordens.erro} tentar={ordens.recarregar}>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhuma manutenção registrada neste veículo." />
        ) : (
          <ul className="linha-do-tempo">
            {lista.map((o) => (
              <li key={o.numero} className="linha-do-tempo__item">
                <span className="linha-do-tempo__data">{data(o.data_conclusao)}</span>
                <span className="linha-do-tempo__servico">{o.descricao}</span>
                <span className="linha-do-tempo__detalhe">
                  {km(o.quilometragem)}{o.oficina && ` · ${o.oficina}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Conteudo>
    </>
  );
}
