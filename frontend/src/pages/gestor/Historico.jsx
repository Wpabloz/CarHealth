import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import {
  AlarmClock, Calendar, CircleCheck, ClipboardList, Filter, Gauge, History, Pencil, Plus, Receipt, ShieldCheck,
  TrendingUp, Truck, Wrench,
} from "lucide-react";

import { get, query } from "../../api/client";
import Placa from "../../components/Placa";
import Segmentado from "../../components/Segmentado";
import {
  Aviso, AvisoDaNavegacao, Botao, BotaoLink, Cabecalho, Carregando, Conteudo, IconeQuadrado, Selo, SeloPrazo, Vazio,
} from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import {
  ORIGEM_LEITURA, data, diasEntre, dinheiro, haQuanto, hojeISO, intervalo, km, marcaModelo, milhar, nomeVeiculo,
  plural, porGravidade,
} from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import LeituraModal from "./LeituraModal";
import VeiculoModal from "./VeiculoModal";

/** /historico sem placa: abre o primeiro veículo ativo. */
export function HistoricoInicio() {
  const { painel } = useResumo();
  const todos = useCarregar(() => get("/veiculos"), []);
  if (!painel || todos.carregando) return <Carregando />;
  const primeiro = painel.veiculos[0] || todos.dados?.[0];
  if (!primeiro) {
    return (
      <>
        <Cabecalho titulo="Histórico de Manutenções" />
        <section className="cartao"><Vazio icone={Truck} titulo="Nenhum veículo cadastrado." /></section>
      </>
    );
  }
  return <Navigate to={`/historico/${primeiro.placa}`} replace />;
}

/** "Histórico de Manutenções" do protótipo: prontuário de um veículo (RF09, RF14, RF29, RF30). */
export default function Historico() {
  const { placa } = useParams();
  const { state } = useLocation();
  const { painel, recarregarPainel } = useResumo();
  const todos = useCarregar(() => get("/veiculos"), []);
  const veiculo = useCarregar(() => get(`/veiculos/${placa}`), [placa]);
  const situacao = useCarregar(() => get(`/veiculos/${placa}/situacao`), [placa]);
  const ordens = useCarregar(() => get(`/ordens-servico${query({ veiculo: placa })}`), [placa]);
  const leituras = useCarregar(() => get(`/leituras-odometro${query({ veiculo: placa })}`), [placa]);
  const [servico, setServico] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [aba, setAba] = useState("MANUTENCOES");
  const [modal, setModal] = useState("");
  const [aviso, setAviso] = useState("");
  useEffect(() => setAviso(""), [placa]); // trocou de veículo: a mensagem anterior não vale mais

  const v = veiculo.dados;
  const concluidas = useMemo(() => (ordens.dados || []).filter((o) => o.status === "CONCLUIDA")
    .sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao) || b.numero - a.numero), [ordens.dados]);
  const abertas = (ordens.dados || []).filter((o) => o.status === "ABERTA");
  const anos = [...new Set(concluidas.map((o) => o.data_conclusao.slice(0, 4)))].sort().reverse();
  const servicos = [...new Set(concluidas.map((o) => (o.id_plano ? o.descricao.split(" — ")[0] : "Corretivas")))];
  const exibidas = concluidas.filter((o) =>
    (!ano || o.data_conclusao.startsWith(ano)) &&
    (!servico || (servico === "Corretivas" ? !o.id_plano : o.id_plano && o.descricao.startsWith(servico))));

  const atualizar = (texto) => {
    setModal("");
    setAviso(texto);
    veiculo.recarregar();
    situacao.recarregar();
    leituras.recarregar();
    todos.recarregar();
    recarregarPainel();
  };

  const abas = (todos.dados || []).filter((x) => x.situacao === "ATIVO" || x.placa === placa);
  return (
    <>
      <Cabecalho migalha="Frota operacional • Prontuário ativo"
        titulo={<>Histórico de Manutenções – {v ? nomeVeiculo(v) : placa}</>}
        acoes={abas.length > 1 && (
          <nav className="abas-veiculo" aria-label="Escolher veículo">
            {abas.map((x) => (
              <Link key={x.placa} to={`/historico/${x.placa}`} aria-current={x.placa === placa ? "page" : undefined}
                className={`abas-veiculo__item ${x.placa === placa ? "abas-veiculo__item--ativa" : ""}`}>
                {x.placa === placa && <i className="ponto ponto--laranja" />}
                <span>{nomeVeiculo(x)}{x.placa === placa && <small>(Selecionado)</small>}</span>
              </Link>
            ))}
          </nav>
        )} />
      <AvisoDaNavegacao />
      <Aviso tipo="sucesso" icone={CircleCheck}>{!state?.aviso && aviso}</Aviso>

      <Conteudo carregando={veiculo.carregando && !v} erro={veiculo.erro} tentar={veiculo.recarregar}>
        {v && (
          <>
            <section className="cartao veiculo-topo">
              <IconeQuadrado icone={Truck} tom="marinho-solido" tamanho="g" />
              <div className="veiculo-topo__dados">
                <div className="veiculo-topo__linha">
                  <Placa placa={v.placa} escura />
                  <h2 className="veiculo-topo__modelo">{marcaModelo(v)}</h2>
                </div>
                <div className="veiculo-topo__linha">
                  <span className="chip-suave">Ano {v.ano}</span>
                  <span className="chip-suave">{v.tipo}</span>
                  {v.situacao === "INATIVO" && <Selo tom="neutro">Inativo</Selo>}
                </div>
                {v.observacoes && <p className="veiculo-topo__obs">{v.observacoes}</p>}
              </div>
              <div className="veiculo-topo__numeros">
                <div className="mini-numero">
                  <span><Gauge size={13} aria-hidden="true" /> Odômetro atual</span>
                  <strong>{km(v.km_atual)}</strong>
                </div>
                <div className="mini-numero">
                  <span><CircleCheck size={13} aria-hidden="true" /> Total realizadas</span>
                  <strong>{plural(concluidas.length, "manutenção", "manutenções")}</strong>
                </div>
              </div>
              <div className="veiculo-topo__acoes">
                <Botao variante="suave" tamanho="p" icone={Gauge} onClick={() => setModal("leitura")}>Registrar km</Botao>
                <Botao variante="icone" icone={Pencil} aria-label="Editar veículo" onClick={() => setModal("veiculo")} />
              </div>
            </section>

            <section className="cartao barra-filtros">
              <Filter size={17} className="texto--suave" aria-hidden="true" />
              <div className="campo__caixa campo__caixa--select">
                <select className="campo__entrada" aria-label="Serviço" value={servico} onChange={(e) => setServico(e.target.value)}>
                  <option value="">Todos os serviços</option>
                  {servicos.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="campo__caixa campo__caixa--select">
                <select className="campo__entrada" aria-label="Ano" value={ano} onChange={(e) => setAno(e.target.value)}>
                  <option value={String(new Date().getFullYear())}>Ano atual ({new Date().getFullYear()})</option>
                  {anos.filter((a) => a !== String(new Date().getFullYear())).map((a) => <option key={a} value={a}>{a}</option>)}
                  <option value="">Todos os anos</option>
                </select>
              </div>
              <BotaoLink to={`/manutencoes/nova?veiculo=${placa}`} icone={Plus} className="barra-filtros__direita">
                Nova manutenção para este veículo
              </BotaoLink>
            </section>

            <div className="duas-colunas">
              <section>
                <div className="linha-tempo__topo">
                  <h2 className="secao__titulo">Linha do Tempo Operacional</h2>
                  <span className="chip-suave">{plural(exibidas.length, "registro exibido", "registros exibidos")}</span>
                  <span className="texto--suave texto--p">Mais recente para a mais antiga</span>
                </div>
                <Segmentado rotulo="Registros" valor={aba} aoMudar={setAba} opcoes={[
                  { id: "MANUTENCOES", rotulo: "Manutenções", icone: Wrench },
                  { id: "LEITURAS", rotulo: "Leituras do odômetro", icone: Gauge },
                ]} />
                {aba === "MANUTENCOES" ? (
                  <Conteudo carregando={ordens.carregando && !ordens.dados} erro={ordens.erro}>
                    {exibidas.length === 0 ? (
                      <div className="cartao"><Vazio icone={History} titulo="Nenhuma manutenção realizada neste filtro." /></div>
                    ) : (
                      <ol className="linha-tempo">
                        {exibidas.map((o, i) => (
                          <li key={o.numero} className="linha-tempo__item">
                            <span className="linha-tempo__numero">{i + 1}</span>
                            <article className="cartao linha-tempo__cartao">
                              <div className="linha-tempo__cabeca">
                                <h3>{o.descricao}</h3>
                                <span className="linha-tempo__data"><Calendar size={13} aria-hidden="true" /> {data(o.data_conclusao)}</span>
                                <strong className="linha-tempo__km">{km(o.quilometragem)}</strong>
                              </div>
                              <Selo tom="realizada">Realizada</Selo>
                              <p className="linha-tempo__texto">
                                {[o.oficina && `Executado em ${o.oficina}`, o.valor && `valor de ${dinheiro(o.valor)}`].filter(Boolean).join(", ") || "Sem oficina informada"}.
                              </p>
                              <div className="etiquetas">
                                <span className="etiqueta">
                                  {o.id_plano ? <ClipboardList size={13} aria-hidden="true" /> : <Wrench size={13} aria-hidden="true" />}
                                  {o.id_plano ? "Preventiva" : "Corretiva"}
                                </span>
                                <Link to={`/ordens/${o.numero}`} className="etiqueta"><Receipt size={13} aria-hidden="true" /> OS nº {o.numero}</Link>
                              </div>
                            </article>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Conteudo>
                ) : (
                  <Leituras leituras={leituras} />
                )}
              </section>

              <aside className="coluna-lateral">
                <ProximasManutencoes situacao={situacao.dados} abertas={abertas} placa={placa} tolerancia={painel?.tolerancia} />
                <Resumo leituras={leituras.dados} concluidas={concluidas} situacao={situacao.dados} />
                <section className="cartao prontuario">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <div>
                    <strong>Prontuário do veículo</strong>
                    <p>Todos os registros ficam guardados, mesmo se o veículo for inativado.</p>
                  </div>
                </section>
              </aside>
            </div>

            <LeituraModal aberto={modal === "leitura"} veiculo={v} aoFechar={() => setModal("")}
              aoSalvar={() => atualizar("Quilometragem registrada.")} />
            <VeiculoModal aberto={modal === "veiculo"} veiculo={v} aoFechar={() => setModal("")}
              aoSalvar={() => atualizar("Veículo atualizado.")} />
          </>
        )}
      </Conteudo>
    </>
  );
}

function Leituras({ leituras }) {
  return (
    <section className="cartao cartao--sem-espaco">
      <Conteudo carregando={leituras.carregando && !leituras.dados} erro={leituras.erro}>
        {leituras.dados?.length === 0 ? (
          <Vazio icone={Gauge} titulo="Nenhuma leitura registrada." />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Data</th><th>Quilometragem</th><th>Origem</th><th>Lançada por</th></tr></thead>
              <tbody>
                {leituras.dados?.map((l) => (
                  <tr key={l.codigo}>
                    <td>{data(l.data_leitura)}</td>
                    <td><strong>{km(l.quilometragem)}</strong></td>
                    <td>{l.origem === "AJUSTE_ODOMETRO" ? <Selo tom="atencao">{ORIGEM_LEITURA[l.origem]}</Selo> : ORIGEM_LEITURA[l.origem]}</td>
                    <td>{l.email_usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Conteudo>
    </section>
  );
}

function ProximasManutencoes({ situacao, abertas, placa, tolerancia }) {
  const planos = [...(situacao?.planos || [])].sort(porGravidade);
  const pendentes = planos.filter((p) => ["VENCIDA", "PROXIMA"].includes(p.situacao)).length + abertas.length;
  return (
    <section className="cartao">
      <header className="cartao__topo cartao__topo--compacto">
        <h2 className="cartao__titulo cartao__titulo--p"><AlarmClock size={17} className="texto--laranja" aria-hidden="true" /> Próximas Manutenções</h2>
        {pendentes > 0 && <span className="chip-suave">{plural(pendentes, "pendente")}</span>}
      </header>
      {planos.length === 0 && abertas.length === 0 ? (
        <p className="texto--suave texto--p">Nenhum plano se aplica a este veículo.</p>
      ) : (
        <ul className="proximas">
          {abertas.map((o) => (
            <li key={`o-${o.numero}`} className="proximas__item">
              <div className="proximas__cabeca"><strong>{o.descricao}</strong><Selo tom="info">Pendente</Selo></div>
              <span className="texto--suave texto--p">Ordem nº {o.numero} aberta em {data(o.data_abertura)}</span>
              <BotaoLink variante="contorno" tamanho="p" icone={CircleCheck} to={`/ordens/${o.numero}`}>Concluir</BotaoLink>
            </li>
          ))}
          {planos.map((p) => (
            <li key={p.id_plano} className="proximas__item">
              <div className="proximas__cabeca"><strong>{p.descricao}</strong><SeloPrazo item={p} tolerancia={tolerancia} /></div>
              <span className="texto--suave texto--p">
                {p.data_prevista || p.km_previsto
                  ? `Prevista: ${[p.data_prevista && data(p.data_prevista), p.km_previsto && km(p.km_previsto)].filter(Boolean).join(" • ")}`
                  : "Ainda sem execução registrada"}
              </span>
              <BotaoLink variante="contorno" tamanho="p" icone={Receipt} to={`/manutencoes/nova?veiculo=${placa}&plano=${p.id_plano}`}>
                Antecipar / Registrar
              </BotaoLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Resumo operacional calculado das leituras e ordens (nada é inventado: sem dados, mostra "—"). */
function Resumo({ leituras, concluidas, situacao }) {
  const lista = [...(leituras || [])].sort((a, b) => a.codigo - b.codigo);
  const ultimoAjuste = lista.map((l) => l.origem).lastIndexOf("AJUSTE_ODOMETRO");
  const serie = lista.slice(Math.max(0, ultimoAjuste));
  let media = null;
  if (serie.length >= 2) {
    const dias = diasEntre(serie[0].data_leitura, serie[serie.length - 1].data_leitura);
    if (dias >= 7) media = Math.round((serie[serie.length - 1].quilometragem - serie[0].quilometragem) / (dias / 30.44));
  }
  const ultima = concluidas[0];
  const plano = [...(situacao?.planos || [])].filter((p) => p.ultima_execucao).sort(porGravidade)[0];
  let ciclo = null;
  if (plano && plano.intervalo_km && situacao.km_atual !== null && plano.ultima_execucao.quilometragem !== null) {
    ciclo = Math.max(0, Math.round(((situacao.km_atual - plano.ultima_execucao.quilometragem) / plano.intervalo_km) * 100));
  } else if (plano && plano.intervalo_meses) {
    ciclo = Math.max(0, Math.round((diasEntre(plano.ultima_execucao.data, hojeISO()) / (plano.intervalo_meses * 30.44)) * 100));
  }

  return (
    <section className="cartao">
      <header className="cartao__topo cartao__topo--compacto">
        <h2 className="cartao__titulo cartao__titulo--p"><TrendingUp size={17} aria-hidden="true" /> Resumo Operacional</h2>
      </header>
      <ul className="resumo-op">
        <li><span><TrendingUp size={15} aria-hidden="true" /> Média rodada estimada</span><strong>{media !== null ? `${milhar(media)} km / mês` : "—"}</strong></li>
        <li>
          <span><Calendar size={15} aria-hidden="true" /> Última intervenção</span>
          <strong>{ultima ? <>{data(ultima.data_conclusao)} <small className="texto--laranja">{haQuanto(ultima.data_conclusao)}</small></> : "—"}</strong>
        </li>
        {plano && (
          <li><span><Wrench size={15} aria-hidden="true" /> {plano.descricao}</span><strong>{intervalo(plano)}</strong></li>
        )}
      </ul>
      {ciclo !== null && (
        <div className="ciclo">
          <div className="ciclo__texto"><span>Ciclo do plano atual</span><strong>{ciclo}% percorrido</strong></div>
          <div className="ciclo__barra" role="progressbar" aria-valuenow={Math.min(ciclo, 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.min(ciclo, 100)}%` }} className={ciclo >= 100 ? "ciclo__barra--perigo" : ""} />
          </div>
        </div>
      )}
    </section>
  );
}
