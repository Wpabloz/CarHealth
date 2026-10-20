import { Link } from "react-router-dom";
import {
  AlarmClock, ArrowRight, Bell, CircleAlert, CircleCheck, CirclePlus, Clock, Gauge, Info, TriangleAlert, Truck, Wrench,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import Placa from "../../components/Placa";
import {
  AvisoDaNavegacao, BotaoLink, Carregando, IconeQuadrado, Indicador, Selo, SeloManutencao, SeloPrazo, Vazio,
} from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import {
  dataLonga, diaMesNumero, km, marcaModelo, nomeVeiculo, placaFormatada, plural, porGravidade,
} from "../../lib/formato";

const MAX_LEMBRETES = 5;
const registrar = (p) => `/manutencoes/nova?veiculo=${p.placa}&plano=${p.id_plano}`;

/** Painel do gestor (protótipo "Painel"): o que precisa de atenção na frota (RF21, RF32, RF39). */
export default function Painel() {
  const { usuario } = useAuth();
  const { painel } = useResumo();
  if (!painel) return <Carregando />;

  const { pendencias, veiculos, tolerancia } = painel;
  const vencidas = pendencias.filter((p) => p.situacao === "VENCIDA");
  const proximas = pendencias.filter((p) => p.situacao === "PROXIMA");
  const primeiroNome = (usuario.nome || "").split(" ")[0];

  return (
    <>
      <AvisoDaNavegacao />
      <section className="cartao boas-vindas">
        <div>
          <h1 className="boas-vindas__titulo">Olá, {primeiroNome}! <span aria-hidden="true">👋</span></h1>
          <p className="boas-vindas__texto">
            Aqui está a situação das revisões e manutenções dos seus {plural(veiculos.length, "veículo")} hoje.
          </p>
        </div>
        <BotaoLink to="/manutencoes/nova" icone={CirclePlus}>Nova manutenção</BotaoLink>
      </section>

      <div className="indicadores">
        <Indicador rotulo="Veículos cadastrados" valor={veiculos.length} icone={Truck}
          nota={<><i className="ponto ponto--info" />{vencidas.length ? `${plural(new Set(vencidas.map((p) => p.placa)).size, "veículo")} com manutenção atrasada` : "Todos operando normalmente"}</>} />
        <Indicador rotulo="Manutenções próximas" valor={proximas.length} icone={Clock} tom="atencao"
          nota={`Vencendo nos próximos ${tolerancia.dias} dias`} notaTom="laranja" />
        <Indicador rotulo="Atrasadas" valor={vencidas.length} icone={TriangleAlert} tom="perigo"
          notaTom={vencidas.length ? "perigo" : undefined}
          selo={vencidas.length > 0 && <Selo tom="perigo" solido ponto={false}>Atenção</Selo>}
          nota={vencidas.length ? "Requer atenção imediata" : "Nenhuma em atraso"} />
        <Indicador rotulo="Realizadas este mês" valor={painel.realizadas_no_mes} icone={CircleCheck}
          nota={<><i className="ponto ponto--marinho" />Revisões em dia</>} />
      </div>

      <section className="cartao lembretes">
        <header className="lembretes__topo">
          <IconeQuadrado icone={Bell} tom="laranja-solido" />
          <div className="lembretes__titulos">
            <h2 className="secao__titulo">Lembretes de Manutenção</h2>
            <p className="secao__subtitulo">Não deixe passar o prazo para garantir que seus veículos nunca parem na rua</p>
          </div>
          {pendencias.length > 0 && (
            <span className="chip-branco"><i className="ponto ponto--perigo" />{plural(pendencias.length, "ação pendente", "ações pendentes")}</span>
          )}
        </header>
        {pendencias.length === 0 ? (
          <Vazio icone={CircleCheck} titulo="A frota está em dia.">Nenhuma manutenção vencida ou próxima do vencimento.</Vazio>
        ) : (
          <ul className="lembretes__lista">
            {pendencias.slice(0, MAX_LEMBRETES).map((p) => {
              const atrasada = p.situacao === "VENCIDA";
              return (
                <li key={`${p.placa}-${p.id_plano}`} className={`lembrete ${atrasada ? "lembrete--perigo" : ""}`}>
                  <IconeQuadrado icone={atrasada ? CircleAlert : AlarmClock} tom={atrasada ? "perigo" : "atencao"} />
                  <div className="lembrete__textos">
                    <p className="lembrete__veiculo">
                      <strong>{nomeVeiculo(p)}</strong> <span>({marcaModelo(p)} • {placaFormatada(p.placa)})</span>
                    </p>
                    <p className="lembrete__servico"><Wrench size={14} aria-hidden="true" /> {p.descricao}</p>
                  </div>
                  <div className="lembrete__prazo">
                    <SeloPrazo item={p} tolerancia={tolerancia} />
                    <span className={atrasada ? "texto--perigo" : "texto--suave"}>
                      {p.data_prevista
                        ? `${atrasada ? "Prevista para" : "Data prevista:"} ${dataLonga(p.data_prevista)}`
                        : `Prevista com ${km(p.km_previsto)}`}
                    </span>
                  </div>
                  <BotaoLink to={registrar(p)} variante={atrasada ? "primario" : "contorno"} icone={CircleCheck}>
                    Registrar manutenção
                  </BotaoLink>
                </li>
              );
            })}
          </ul>
        )}
        {pendencias.length > MAX_LEMBRETES && (
          <Link to="/lembretes" className="link-forte lembretes__mais">
            Ver todos os {pendencias.length} lembretes <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </section>

      <section className="frota">
        <h2 className="secao__titulo">Minha frota ({plural(veiculos.length, "veículo")})</h2>
        <p className="secao__subtitulo">Acompanhe a quilometragem e o estado técnico individual de cada veículo</p>
        {veiculos.length === 0 ? (
          <div className="cartao">
            <Vazio icone={Truck} titulo="Nenhum veículo ativo.">
              <Link to="/veiculos" className="link-forte">Cadastrar o primeiro veículo</Link>
            </Vazio>
          </div>
        ) : (
          <div className="frota__grade">
            {veiculos.map((v) => <CartaoVeiculo key={v.placa} veiculo={v} tolerancia={tolerancia} />)}
          </div>
        )}
      </section>

      <Legenda />
    </>
  );
}

function CartaoVeiculo({ veiculo: v, tolerancia }) {
  const proxima = [...v.planos].sort(porGravidade)[0];
  const atrasado = v.situacao === "VENCIDA";
  const comPrazo = proxima && ["VENCIDA", "PROXIMA"].includes(proxima.situacao);
  return (
    <article className="frota-cartao">
      <div className="frota-cartao__topo">
        <IconeQuadrado icone={Truck} tom={atrasado ? "perigo" : "info"} />
        {comPrazo ? <SeloPrazo item={proxima} tolerancia={tolerancia} curto /> : <SeloManutencao situacao={v.situacao} />}
      </div>
      <h3 className="frota-cartao__nome">{nomeVeiculo(v)}</h3>
      <p className="frota-cartao__modelo">{marcaModelo(v)}</p>
      <Placa placa={v.placa} />
      <div className={`frota-cartao__caixa ${atrasado ? "frota-cartao__caixa--perigo" : ""}`}>
        <div className="frota-cartao__linha">
          <span className="texto--suave"><Gauge size={14} aria-hidden="true" /> Odômetro atual</span>
          <strong>{km(v.km_atual)}</strong>
        </div>
        <hr />
        {proxima ? (
          <>
            <span className={`frota-cartao__rotulo ${atrasado ? "texto--perigo" : ""}`}>
              {atrasado ? "Requer manutenção imediata" : "Próxima manutenção"}
            </span>
            <div className="frota-cartao__linha frota-cartao__linha--topo">
              <strong className={atrasado ? "texto--perigo" : "texto--marinho"}>{proxima.descricao}</strong>
              <span className={atrasado ? "texto--perigo" : proxima.situacao === "SEM_BASE" ? "texto--suave" : "texto--laranja"}>
                {proxima.data_prevista
                  ? `${atrasado ? "Era em" : "Prevista"} ${diaMesNumero(proxima.data_prevista)}`
                  : proxima.km_previsto ? km(proxima.km_previsto) : "Sem histórico"}
              </span>
            </div>
          </>
        ) : (
          <span className="frota-cartao__rotulo">Nenhum plano de manutenção para o tipo {v.tipo}.</span>
        )}
      </div>
      <Link to={`/historico/${v.placa}`} className="link-forte">
        Ver histórico completo <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}

function Legenda() {
  return (
    <section className="cartao legenda">
      <span className="legenda__texto"><Info size={17} aria-hidden="true" /> Entenda as cores de situação do sistema:</span>
      <div className="legenda__selos">
        <Selo tom="realizada">Realizada (Em dia)</Selo>
        <Selo tom="info">Pendente</Selo>
        <Selo tom="atencao">Próxima (Atenção ao prazo)</Selo>
        <Selo tom="perigo">Atrasada (Prioridade máxima)</Selo>
      </div>
    </section>
  );
}
