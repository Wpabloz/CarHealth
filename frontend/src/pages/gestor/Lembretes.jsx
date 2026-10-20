import { Link } from "react-router-dom";
import { AlarmClock, ArrowRight, Calendar, CircleAlert, CircleCheck, Lightbulb, Asterisk, TriangleAlert, Truck } from "lucide-react";

import {
  BotaoLink, Cabecalho, Carregando, IconeQuadrado, Selo, SeloPrazo, Vazio,
} from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import { data, dataLonga, intervalo, km, marcaModelo, nomeVeiculo, placaFormatada, plural, prazo } from "../../lib/formato";

/** "Lembretes de Manutenção" do protótipo: cada manutenção atrasada ou próxima, da mais urgente (RF39). */
export default function Lembretes() {
  const { painel } = useResumo();
  if (!painel) return <Carregando />;
  const { pendencias, veiculos, tolerancia } = painel;
  const vencidas = pendencias.filter((p) => p.situacao === "VENCIDA").length;
  const proximas = pendencias.length - vencidas;
  const obsPorPlaca = new Map(veiculos.map((v) => [v.placa, v]));

  return (
    <>
      <Cabecalho titulo={<><span className="barra-titulo" aria-hidden="true" />Lembretes de Manutenção</>}
        subtitulo="Fique atento aos prazos das revisões para evitar que seus veículos fiquem parados." />

      {pendencias.length === 0 ? (
        <section className="cartao">
          <Vazio icone={CircleCheck} titulo="Nenhuma manutenção requer atenção agora.">
            A frota está em dia. Os lembretes aparecem aqui quando faltar até {plural(tolerancia.dias, "dia")} ou {km(tolerancia.km)}.
          </Vazio>
        </section>
      ) : (
        <section className="cartao alerta-geral">
          <IconeQuadrado icone={TriangleAlert} tom="perigo" />
          <div>
            <strong className="alerta-geral__titulo">
              {plural(pendencias.length, "manutenção requer", "manutenções requerem")} sua atenção
            </strong>
            <p>
              {[vencidas && `${plural(vencidas, "manutenção vencida", "manutenções vencidas")} com risco de parada`,
                proximas && `${plural(proximas, "preventiva", "preventivas")} para os próximos ${tolerancia.dias} dias`]
                .filter(Boolean).join(" e ")}.
            </p>
          </div>
        </section>
      )}

      <ul className="lembretes-cartoes">
        {pendencias.map((p) => {
          const atrasada = p.situacao === "VENCIDA";
          const veiculo = obsPorPlaca.get(p.placa) || p;
          return (
            <li key={`${p.placa}-${p.id_plano}`} className={`lembrete-cartao lembrete-cartao--${atrasada ? "perigo" : "atencao"}`}>
              <div className="lembrete-cartao__faixa">
                {atrasada ? (
                  <Selo tom="perigo" solido icone={CircleAlert}>{prazo(p, tolerancia).selo}! Ação imediata recomendada</Selo>
                ) : (
                  <SeloPrazo item={p} tolerancia={tolerancia} />
                )}
                <span className="chip-placa">Placa: {placaFormatada(p.placa)}</span>
                {p.data_prevista && (
                  <span className="lembrete-cartao__data texto--laranja">
                    <Calendar size={14} aria-hidden="true" /> Data limite prevista: {dataLonga(p.data_prevista)}
                  </span>
                )}
              </div>
              <div className="lembrete-cartao__corpo">
                <div className="lembrete-cartao__veiculo">
                  <IconeQuadrado icone={atrasada ? Asterisk : AlarmClock} tom={atrasada ? "perigo" : "atencao"} tamanho="g" />
                  <div>
                    <h2 className="lembrete-cartao__nome">{nomeVeiculo(p)}</h2>
                    <p className="lembrete-cartao__modelo">{marcaModelo(p)}</p>
                    {veiculo.observacoes && <p className="lembrete-cartao__obs">{veiculo.observacoes}</p>}
                  </div>
                </div>
                <div className="lembrete-cartao__servico">
                  <span className="rotulo-caixa-alta">Serviço exigido</span>
                  <strong>{p.descricao}</strong>
                  <p>
                    Plano {intervalo(p)}.
                    {p.ultima_execucao && ` Última execução em ${data(p.ultima_execucao.data)} com ${km(p.ultima_execucao.quilometragem)}.`}
                    {` Odômetro atual: ${km(p.km_atual)}.`}
                  </p>
                </div>
                <div className="lembrete-cartao__acoes">
                  <BotaoLink icone={CircleCheck} to={`/manutencoes/nova?veiculo=${p.placa}&plano=${p.id_plano}`}>
                    Registrar como realizado
                  </BotaoLink>
                  <BotaoLink variante="suave" icone={Truck} to={`/historico/${p.placa}`}>Ver veículo</BotaoLink>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="cartao dica dica--clara">
        <Lightbulb size={20} className="texto--marinho" aria-hidden="true" />
        <div>
          <strong className="dica__titulo">Registre a oficina e o valor de cada serviço</strong>
          <p className="dica__texto">Eles ficam no histórico do veículo e ajudam a comparar custos e prestadores.</p>
        </div>
        <Link to="/historico" className="link-forte">Ver histórico <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    </>
  );
}
