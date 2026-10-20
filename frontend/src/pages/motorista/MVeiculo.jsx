import { useParams } from "react-router-dom";
import { Gauge, History, Wrench } from "lucide-react";

import { get } from "../../api/client";
import Placa from "../../components/Placa";
import {
  AvisoDaNavegacao, BotaoLink, Cabecalho, Cartao, Conteudo, SeloManutencao, SeloPrazo, Vazio,
} from "../../components/ui";
import { data, km } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

/** Veículo escolhido: quilometragem atual e situação de cada manutenção prevista (US14, RF36, RF39). */
export default function MVeiculo() {
  const { placa } = useParams();
  const situacao = useCarregar(() => get(`/veiculos/${placa}/situacao`), [placa]);
  const s = situacao.dados;

  return (
    <>
      <Cabecalho voltar="/m/veiculos" titulo={s ? s.identificacao || s.modelo : placa}
        subtitulo={s && `${s.marca} ${s.modelo}`} />
      <AvisoDaNavegacao />
      <Conteudo carregando={situacao.carregando && !s} erro={situacao.erro} tentar={situacao.recarregar}>
        {s && (
          <div className="pilha">
            <div className="m-resumo">
              <Placa placa={s.placa} />
              <div className="m-resumo__km">
                <span><Gauge size={14} aria-hidden="true" /> Odômetro atual</span>
                <strong>{km(s.km_atual)}</strong>
              </div>
              <SeloManutencao situacao={s.situacao} />
            </div>

            <BotaoLink to={`/m/veiculos/${placa}/registrar`} icone={Gauge} className="botao--largo botao--grande">
              Registrar quilometragem
            </BotaoLink>

            <Cartao titulo="Manutenções previstas">
              {s.planos.length === 0 ? (
                <Vazio icone={Wrench} titulo="Nenhuma manutenção prevista para este veículo." />
              ) : (
                <ul className="proximas">
                  {s.planos.map((p) => (
                    <li key={p.id_plano} className="proximas__item">
                      <div className="proximas__cabeca"><strong>{p.descricao}</strong><SeloPrazo item={p} /></div>
                      <span className="texto--suave texto--p">
                        {p.data_prevista || p.km_previsto
                          ? `Prevista: ${[p.data_prevista && data(p.data_prevista), p.km_previsto && km(p.km_previsto)].filter(Boolean).join(" • ")}`
                          : "Ainda sem manutenção registrada"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>

            <BotaoLink variante="contorno" icone={History} to={`/m/veiculos/${placa}/historico`} className="botao--largo">
              Histórico do veículo
            </BotaoLink>
          </div>
        )}
      </Conteudo>
    </>
  );
}
