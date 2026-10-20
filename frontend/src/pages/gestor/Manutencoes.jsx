import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, CalendarClock, Check, CircleCheck, ClipboardCheck, Clock, Pencil, Plus, ShieldCheck, TriangleAlert, Truck,
} from "lucide-react";

import { get } from "../../api/client";
import Segmentado from "../../components/Segmentado";
import {
  Aviso, AvisoDaNavegacao, Botao, BotaoLink, Cabecalho, Conteudo, IconeQuadrado, Indicador, Selo, SeloPrazo, Vazio,
} from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import { data, intervalo, km, nomeVeiculo, plural, prazo } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import ConcluirModal from "./ConcluirModal";

const POR_PAGINA = 10;

/**
 * "Controle de Manutenções" do protótipo. Junta numa tabela só:
 * - as manutenções previstas pelos planos que estão atrasadas ou próximas (calculadas pelo sistema);
 * - as ordens abertas (Pendente) e as concluídas (Realizada).
 */
export default function Manutencoes() {
  const { painel, recarregarPainel, empresa } = useResumo();
  const navegar = useNavigate();
  const ordens = useCarregar(() => get("/ordens-servico"), []);
  const [aba, setAba] = useState("TODOS");
  const [placa, setPlaca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [concluindo, setConcluindo] = useState(null);
  const [aviso, setAviso] = useState("");

  const veiculos = useMemo(() => new Map((painel?.veiculos || []).map((v) => [v.placa, v])), [painel]);
  const linhas = useMemo(() => {
    if (!painel || !ordens.dados) return [];
    const previstas = painel.pendencias.map((p) => ({
      chave: `p-${p.placa}-${p.id_plano}`, tipo: p.situacao === "VENCIDA" ? "ATRASADAS" : "PROXIMAS", pendencia: p,
      veiculo: veiculos.get(p.placa) || p, servico: p.descricao, detalhe: intervalo(p),
      data: p.data_prevista, km: p.km_previsto, ordenar: p.data_prevista || "9999",
    }));
    const registradas = ordens.dados.map((o) => ({
      chave: `o-${o.numero}`, tipo: o.status === "ABERTA" ? "PENDENTES" : o.status === "CONCLUIDA" ? "REALIZADAS" : "OUTRAS",
      ordem: o, veiculo: veiculos.get(o.placa_veiculo) || { placa: o.placa_veiculo }, servico: o.descricao,
      detalhe: [o.id_plano ? "Preventiva" : "Corretiva", o.oficina].filter(Boolean).join(" · "),
      data: o.status === "CONCLUIDA" ? o.data_conclusao : o.data_abertura, km: o.quilometragem,
      ordenar: o.status === "CONCLUIDA" ? `0${o.data_conclusao}` : o.data_abertura,
    }));
    // Primeiro o que pede ação (atrasadas, próximas, pendentes), depois as realizadas, mais recentes antes
    const peso = { ATRASADAS: 0, PROXIMAS: 1, PENDENTES: 2, REALIZADAS: 3, OUTRAS: 4 };
    return [...previstas, ...registradas].sort((a, b) =>
      peso[a.tipo] - peso[b.tipo] || (a.tipo === "REALIZADAS" ? b.data.localeCompare(a.data) : a.ordenar.localeCompare(b.ordenar)));
  }, [painel, ordens.dados, veiculos]);

  const doVeiculo = linhas.filter((l) => !placa || l.veiculo.placa === placa);
  const contar = (tipo) => doVeiculo.filter((l) => l.tipo === tipo).length;
  const filtradas = aba === "TODOS" ? doVeiculo : doVeiculo.filter((l) => l.tipo === aba);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const mudarAba = (id) => { setAba(id); setPagina(1); };

  const realizadasMes = painel?.realizadas_no_mes ?? 0;
  const ativos = painel?.veiculos.length || 0;
  const emDia = (painel?.veiculos || []).filter((v) => !["VENCIDA", "PROXIMA"].includes(v.situacao)).length;
  const percentual = ativos ? Math.round((emDia / ativos) * 100) : 100;

  const aoConcluir = (ordem) => {
    setConcluindo(null);
    setAviso(`Ordem nº ${ordem.numero} concluída. Próxima manutenção recalculada.`);
    ordens.recarregar();
    recarregarPainel();
  };

  return (
    <>
      <Cabecalho migalha={`Operação & frota / ${empresa?.razao_social || ""}`} titulo="Controle de Manutenções"
        subtitulo="Acompanhe todas as revisões preventivas, corretivas e serviços agendados da sua frota."
        acoes={<BotaoLink to="/manutencoes/nova" icone={Plus}>Nova Manutenção</BotaoLink>} />
      <AvisoDaNavegacao />
      <Aviso tipo="sucesso" icone={CircleCheck}>{aviso}</Aviso>

      <div className="indicadores">
        <Indicador faixa tom="perigo" rotulo="Atrasadas críticas" valor={contar("ATRASADAS")} icone={TriangleAlert}
          notaTom="perigo" nota="Requer atenção imediata" />
        <Indicador faixa tom="atencao" rotulo={`Próximas (${painel?.tolerancia.dias ?? 30} dias)`} valor={contar("PROXIMAS")}
          icone={Clock} notaTom="laranja" nota="Dentro do prazo de aviso" />
        <Indicador faixa tom="marinho" rotulo="Pendentes futuras" valor={contar("PENDENTES")} icone={CalendarClock}
          nota="Ordens abertas" />
        <Indicador faixa tom="marinho" rotulo="Concluídas" valor={realizadasMes} icone={CircleCheck} nota="Histórico do mês" />
      </div>

      <section className="cartao cartao--sem-espaco">
        <div className="tabela-filtros">
          <Segmentado rotulo="Filtrar manutenções" valor={aba} aoMudar={mudarAba} opcoes={[
            { id: "TODOS", rotulo: "Todos", total: doVeiculo.length, tom: "marinho" },
            { id: "PENDENTES", rotulo: "Pendentes", total: contar("PENDENTES"), tom: "info" },
            { id: "PROXIMAS", rotulo: "Próximas", total: contar("PROXIMAS"), tom: "atencao" },
            { id: "ATRASADAS", rotulo: "Atrasadas", total: contar("ATRASADAS"), tom: "perigo" },
            { id: "REALIZADAS", rotulo: "Realizadas", total: contar("REALIZADAS"), tom: "info" },
          ]} />
          <div className="campo__caixa campo__caixa--icone campo__caixa--select campo__caixa--branca">
            <Truck className="campo__icone" size={16} aria-hidden="true" />
            <select className="campo__entrada" aria-label="Veículo" value={placa}
              onChange={(e) => { setPlaca(e.target.value); setPagina(1); }}>
              <option value="">Todos os veículos ({veiculos.size})</option>
              {[...veiculos.values()].map((v) => <option key={v.placa} value={v.placa}>{nomeVeiculo(v)}</option>)}
            </select>
          </div>
        </div>

        <Conteudo carregando={!painel || (ordens.carregando && !ordens.dados)} erro={ordens.erro} tentar={ordens.recarregar}>
          {filtradas.length === 0 ? (
            <Vazio icone={ClipboardCheck} titulo="Nenhuma manutenção nesta lista." />
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Serviço / Manutenção</th>
                    <th>Data prevista</th>
                    <th>Quilometragem</th>
                    <th>Situação</th>
                    <th className="tabela__acoes">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => (
                    <tr key={l.chave}>
                      <td>
                        <span className="celula-veiculo">
                          <IconeQuadrado icone={Truck} tom="info" tamanho="p" />
                          <span><strong>{nomeVeiculo(l.veiculo)}</strong><span>{l.veiculo.modelo}</span></span>
                        </span>
                      </td>
                      <td>
                        <span className="celula-servico"><strong>{l.servico}</strong><span>{l.detalhe}</span></span>
                      </td>
                      <td className="nowrap">
                        {l.data ? <><Calendar size={14} className="texto--suave" aria-hidden="true" /> {data(l.data)}</> : "—"}
                      </td>
                      <td className="nowrap"><strong>{l.km ? km(l.km) : "—"}</strong></td>
                      <td><SituacaoLinha linha={l} tolerancia={painel?.tolerancia} /></td>
                      <td className="tabela__acoes">
                        <span className="acoes-linha">
                          {l.pendencia && (
                            <BotaoLink variante="suave" tamanho="p" icone={Check}
                              to={`/manutencoes/nova?veiculo=${l.pendencia.placa}&plano=${l.pendencia.id_plano}`}>
                              Concluir
                            </BotaoLink>
                          )}
                          {l.ordem?.status === "ABERTA" && (
                            <Botao variante="suave" tamanho="p" icone={Check} onClick={() => setConcluindo(l.ordem)}>Concluir</Botao>
                          )}
                          {l.ordem && (
                            <Botao variante="icone" icone={Pencil} aria-label={`Abrir ordem nº ${l.ordem.numero}`}
                              onClick={() => navegar(`/ordens/${l.ordem.numero}`)} />
                          )}
                          {l.pendencia && (
                            <Botao variante="icone" icone={Pencil} aria-label={`Ver ${nomeVeiculo(l.veiculo)}`}
                              onClick={() => navegar(`/historico/${l.pendencia.placa}`)} />
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <footer className="tabela-rodape">
            <span>Mostrando {visiveis.length} de {plural(filtradas.length, "manutenção", "manutenções")}</span>
            {paginas > 1 && (
              <span className="paginacao">
                {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={`paginacao__item ${n === pagina ? "paginacao__item--ativo" : ""}`}
                    onClick={() => setPagina(n)} aria-current={n === pagina ? "page" : undefined}>{n}</button>
                ))}
              </span>
            )}
          </footer>
        </Conteudo>
      </section>

      <section className="cartao faixa-info">
        <IconeQuadrado icone={ShieldCheck} tom="atencao" />
        <div>
          <strong>Prontidão da frota</strong>
          <p>{emDia} de {plural(ativos, "veículo ativo", "veículos ativos")} sem manutenção atrasada ou próxima do vencimento.</p>
        </div>
        <span className="chip-branco chip-branco--forte">Frota {percentual}% em dia</span>
      </section>

      <ConcluirModal ordem={concluindo} veiculo={concluindo && veiculos.get(concluindo.placa_veiculo)}
        aoFechar={() => setConcluindo(null)} aoConcluir={aoConcluir} />
    </>
  );
}

function SituacaoLinha({ linha, tolerancia }) {
  if (linha.pendencia) return <SeloPrazo item={linha.pendencia} tolerancia={tolerancia} curto />;
  if (linha.tipo === "PENDENTES") return <Selo tom="info">Pendente</Selo>;
  if (linha.tipo === "REALIZADAS") return <Selo tom="realizada">Realizada</Selo>;
  return <Selo tom="neutro">{linha.ordem.status === "CANCELADA" ? "Cancelada" : prazo(linha).curto}</Selo>;
}
