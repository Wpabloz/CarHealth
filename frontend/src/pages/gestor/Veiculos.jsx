import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleCheck, Clock, History, Lightbulb, Pencil, Plus, Search, TriangleAlert, Truck } from "lucide-react";

import { get, query } from "../../api/client";
import Placa from "../../components/Placa";
import {
  Aviso, Botao, BotaoLink, Cabecalho, Conteudo, IconeQuadrado, Indicador, SeloCadastro, SeloManutencao, SeloPrazo, Vazio,
} from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import { km, marcaModelo, nomeVeiculo, plural, porGravidade } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import VeiculoModal from "./VeiculoModal";

/** "Veículos Cadastrados" do protótipo: a frota, o estado de cada veículo e o cadastro em janela. */
export default function Veiculos() {
  const { painel, recarregarPainel } = useResumo();
  const { state } = useLocation();
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("ATIVO");
  const [modal, setModal] = useState({ aberto: Boolean(state?.cadastrar), veiculo: null });
  const [aviso, setAviso] = useState("");
  const lista = useCarregar(() => get(`/veiculos${query({ situacao })}`), [situacao]);

  useEffect(() => {
    if (state?.cadastrar) navegar(".", { replace: true, state: null }); // abre o cadastro uma vez só
  }, [state, navegar]);

  const situacaoDe = useMemo(() => new Map((painel?.veiculos || []).map((v) => [v.placa, v])), [painel]);
  const termo = busca.trim().toLowerCase();
  const veiculos = (lista.dados || []).filter((v) =>
    !termo || v.placa.toLowerCase().includes(termo.replace("-", "")) || (v.identificacao || "").toLowerCase().includes(termo));
  const vencidas = painel?.pendencias.filter((p) => p.situacao === "VENCIDA").length || 0;
  const proximas = painel?.pendencias.filter((p) => p.situacao === "PROXIMA").length || 0;

  const aoSalvar = (salvo, editou) => {
    setModal({ aberto: false, veiculo: null });
    setAviso(editou ? `${nomeVeiculo(salvo)} atualizado.` : `${nomeVeiculo(salvo)} cadastrado.`);
    lista.recarregar();
    recarregarPainel();
  };

  return (
    <>
      <Cabecalho migalha={`Frota operacional / ${plural(painel?.veiculos.length ?? 0, "unidade")}`}
        titulo="Veículos Cadastrados"
        subtitulo="Gerencie os veículos da sua frota e acompanhe o estado operacional de cada um."
        acoes={<Botao icone={Plus} onClick={() => setModal({ aberto: true, veiculo: null })}>Cadastrar veículo</Botao>} />
      <Aviso tipo="sucesso" icone={CircleCheck}>{aviso}</Aviso>

      <div className="indicadores indicadores--3">
        <Indicador rotulo="Total na frota" valor={painel?.veiculos.length ?? "—"} icone={Truck}
          nota={<><i className="ponto ponto--info" />Veículos ativos</>} />
        <Indicador rotulo="Manutenções próximas" valor={plural(proximas, "Alerta")} icone={Clock} tom="atencao"
          notaTom="laranja" nota="Dentro do prazo de aviso" />
        <Indicador rotulo="Atenção crítica" valor={plural(vencidas, "Atrasada")} icone={TriangleAlert} tom="perigo"
          notaTom={vencidas ? "perigo" : undefined} nota={vencidas ? "Requer atenção imediata" : "Nenhuma em atraso"} />
      </div>

      <section className="cartao">
        <div className="barra-filtros">
          <div className="campo__caixa campo__caixa--icone barra-filtros__busca">
            <Search className="campo__icone" size={17} aria-hidden="true" />
            <input className="campo__entrada" type="search" placeholder="Buscar por placa ou identificação"
              aria-label="Buscar por placa ou identificação" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="campo__caixa campo__caixa--select">
            <select className="campo__entrada" aria-label="Situação do cadastro" value={situacao}
              onChange={(e) => setSituacao(e.target.value)}>
              <option value="ATIVO">Ativos</option>
              <option value="INATIVO">Inativos</option>
              <option value="">Todos</option>
            </select>
          </div>
          <span className="barra-filtros__info"><CircleCheck size={15} aria-hidden="true" /> Dados sincronizados agora</span>
        </div>

        <Conteudo carregando={lista.carregando && !lista.dados} erro={lista.erro} tentar={lista.recarregar}>
          {veiculos.length === 0 ? (
            <Vazio icone={Truck} titulo={termo ? "Nenhum veículo encontrado." : "Nenhum veículo nesta lista."}>
              {!termo && situacao === "ATIVO" && "Cadastre o primeiro veículo da frota."}
            </Vazio>
          ) : (
            <ul className="lista-veiculos">
              {veiculos.map((v) => {
                const s = situacaoDe.get(v.placa);
                const proxima = s && [...s.planos].sort(porGravidade)[0];
                return (
                  <li key={v.placa} className="lista-veiculos__item">
                    <IconeQuadrado icone={Truck} tom={s?.situacao === "VENCIDA" ? "perigo" : "info"} />
                    <div className="lista-veiculos__nome">
                      <strong>{nomeVeiculo(v)}</strong>
                      <span>{marcaModelo(v)} · {v.ano}</span>
                      {v.observacoes && <span className="lista-veiculos__obs">{v.observacoes}</span>}
                    </div>
                    <Placa placa={v.placa} />
                    <span className="lista-veiculos__km"><span className="texto--suave">Odômetro</span> {km(v.km_atual)}</span>
                    <span className="lista-veiculos__selo">
                      {v.situacao === "INATIVO" ? <SeloCadastro situacao="INATIVO" />
                        : proxima && ["VENCIDA", "PROXIMA"].includes(proxima.situacao)
                          ? <SeloPrazo item={proxima} tolerancia={painel?.tolerancia} curto />
                          : <SeloManutencao situacao={s?.situacao || "SEM_PLANO"} />}
                    </span>
                    <span className="lista-veiculos__acoes">
                      <BotaoLink variante="suave" tamanho="p" icone={History} to={`/historico/${v.placa}`}>Histórico</BotaoLink>
                      <Botao variante="icone" icone={Pencil} aria-label={`Editar ${nomeVeiculo(v)}`}
                        onClick={() => setModal({ aberto: true, veiculo: v })} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Conteudo>
      </section>

      <section className="cartao dica">
        <IconeQuadrado icone={Lightbulb} tom="marinho-solido" />
        <div>
          <h2 className="dica__titulo">Dica de Gestão Preventiva</h2>
          <p className="dica__texto">
            Cadastre os planos de manutenção para cada tipo de veículo: é a partir deles e das leituras do odômetro
            que o CarHealth calcula os lembretes, antes que o veículo pare na rua.
          </p>
        </div>
        <BotaoLink variante="contorno" to="/planos">Ver planos</BotaoLink>
      </section>

      <VeiculoModal aberto={modal.aberto} veiculo={modal.veiculo} aoSalvar={aoSalvar}
        aoFechar={() => setModal({ aberto: false, veiculo: null })} />
    </>
  );
}
