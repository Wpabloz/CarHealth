import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CircleCheck, ClipboardCheck, Filter, QrCode } from "lucide-react";

import { get, patch, query } from "../../api/client";
import Placa from "../../components/Placa";
import Segmentado from "../../components/Segmentado";
import { Aviso, Cabecalho, Conteudo, Selo, Vazio } from "../../components/ui";
import { data, hojeISO, km } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

const SITUACAO_PROBLEMA = {
  ABERTO: { rotulo: "Aberto", tom: "perigo" },
  EM_ANALISE: { rotulo: "Em análise", tom: "atencao" },
  RESOLVIDO: { rotulo: "Resolvido", tom: "realizada" },
};
const ESTADO_GERAL = {
  BOM: { rotulo: "Bom", tom: "realizada" },
  REGULAR: { rotulo: "Regular", tom: "atencao" },
  RUIM: { rotulo: "Ruim", tom: "perigo" },
};
const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * "Ocorrências" do gestor: o que os motoristas mandaram pelo celular.
 * - Problemas avisados (GET /api/problemas): o gestor muda a situação (PATCH).
 * - Check-ins do dia (GET /api/checkins?data_checkin=): quem saiu com qual caminhão, km e estado.
 */
export default function Ocorrencias() {
  const [aba, setAba] = useState("PROBLEMAS");
  return (
    <>
      <Cabecalho titulo="Ocorrências" subtitulo="Problemas avisados e check-ins feitos pelos motoristas." />
      <Segmentado rotulo="Ocorrências" valor={aba} aoMudar={setAba} opcoes={[
        { id: "PROBLEMAS", rotulo: "Problemas avisados", icone: AlertTriangle },
        { id: "CHECKINS", rotulo: "Check-ins", icone: ClipboardCheck },
      ]} />
      {aba === "PROBLEMAS" ? <Problemas /> : <Checkins />}
    </>
  );
}

function Problemas() {
  const [situacao, setSituacao] = useState("");
  const lista = useCarregar(() => get(`/problemas${query({ situacao })}`), [situacao]);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });

  const mudarSituacao = async (problema, nova) => {
    try {
      await patch(`/problemas/${problema.id_problema}`, { situacao: nova });
      setAviso({ tipo: "sucesso", texto: `Problema em ${problema.placa_veiculo} marcado como "${SITUACAO_PROBLEMA[nova].rotulo}".` });
      lista.recarregar();
    } catch (erro) {
      setAviso({ tipo: "erro", texto: erro.message || "Não foi possível mudar a situação." });
    }
  };

  return (
    <>
      <Aviso tipo={aviso.tipo || "info"} icone={aviso.tipo === "sucesso" ? CircleCheck : undefined}>{aviso.texto}</Aviso>
      <section className="cartao barra-filtros">
        <Filter size={17} className="texto--suave" aria-hidden="true" />
        <div className="campo__caixa campo__caixa--select">
          <select className="campo__entrada" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">Todas as situações</option>
            {Object.entries(SITUACAO_PROBLEMA).map(([id, s]) => <option key={id} value={id}>{s.rotulo}</option>)}
          </select>
        </div>
      </section>
      <section className="cartao cartao--sem-espaco">
        <Conteudo carregando={lista.carregando && !lista.dados} erro={lista.erro} tentar={lista.recarregar}>
          {lista.dados?.length === 0 ? (
            <Vazio icone={AlertTriangle} titulo="Nenhum problema avisado." />
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr><th>Quando</th><th>Veículo</th><th>Onde</th><th>Pode rodar?</th><th>Explicação</th><th>Motorista</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {lista.dados?.map((p) => (
                    <tr key={p.id_problema}>
                      <td>{dataHora(p.data_hora)}</td>
                      <td><Link to={`/historico/${p.placa_veiculo}`}><Placa placa={p.placa_veiculo} /></Link></td>
                      <td><strong>{p.componente_nome}</strong></td>
                      <td>{p.pode_rodar ? <Selo tom="realizada">Sim</Selo> : <Selo tom="perigo">Não</Selo>}</td>
                      <td>{p.descricao || <span className="texto--suave">—</span>}</td>
                      <td>{p.nome_usuario}</td>
                      <td>
                        <div className="campo__caixa campo__caixa--select">
                          <select className="campo__entrada" aria-label={`Situação do problema ${p.id_problema}`}
                            value={p.situacao} onChange={(e) => mudarSituacao(p, e.target.value)}>
                            {Object.entries(SITUACAO_PROBLEMA).map(([id, s]) => <option key={id} value={id}>{s.rotulo}</option>)}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Conteudo>
      </section>
    </>
  );
}

function Checkins() {
  const [dia, setDia] = useState(hojeISO());
  const lista = useCarregar(() => get(`/checkins${query({ data_checkin: dia })}`), [dia]);
  return (
    <>
      <section className="cartao barra-filtros">
        <Filter size={17} className="texto--suave" aria-hidden="true" />
        <label className="texto--suave texto--p" htmlFor="dia-checkin">Dia</label>
        <div className="campo__caixa">
          <input id="dia-checkin" type="date" className="campo__entrada" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      </section>
      <section className="cartao cartao--sem-espaco">
        <Conteudo carregando={lista.carregando && !lista.dados} erro={lista.erro} tentar={lista.recarregar}>
          {lista.dados?.length === 0 ? (
            <Vazio icone={QrCode} titulo={`Nenhum check-in em ${data(dia)}.`} />
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Km informado</th><th>Estado geral</th><th>Observação</th></tr></thead>
                <tbody>
                  {lista.dados?.map((c) => (
                    <tr key={c.id_checkin}>
                      <td>{data(c.data_checkin)}</td>
                      <td><Link to={`/historico/${c.placa_veiculo}`}><Placa placa={c.placa_veiculo} /></Link></td>
                      <td>{c.nome_usuario}</td>
                      <td><strong>{km(c.km_informado)}</strong></td>
                      <td><Selo tom={ESTADO_GERAL[c.estado_geral]?.tom}>{ESTADO_GERAL[c.estado_geral]?.rotulo || c.estado_geral}</Selo></td>
                      <td>{c.observacao || <span className="texto--suave">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Conteudo>
      </section>
    </>
  );
}
