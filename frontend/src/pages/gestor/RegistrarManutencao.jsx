import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar, CalendarClock, CalendarPlus, Check, CircleCheck, CircleDollarSign, Gauge, Lightbulb, Sparkles, Store,
  Truck, Wrench,
} from "lucide-react";

import { get, post, query } from "../../api/client";
import { Aviso, Botao, Cabecalho, Campo, IconeQuadrado, Selo } from "../../components/ui";
import { useResumo } from "../../layouts/resumo";
import {
  data, haQuanto, hojeISO, intervalo, km, marcaModelo, nomeVeiculo, placaFormatada, plural, somarMeses,
} from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import { useFormulario } from "../../lib/useFormulario";

const CORRETIVA = "CORRETIVA";
const PONTO = { VENCIDA: "perigo", PROXIMA: "laranja", EM_DIA: "verde", SEM_BASE: "neutro", SEM_PLANO: "neutro" };

/**
 * "Registrar Manutenção" do protótipo. Serviço já realizado: abre e conclui a ordem de uma vez
 * (POST /ordens-servico/realizada). Agendar: abre a ordem, que fica Pendente até ser concluída.
 */
export default function RegistrarManutencao() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { painel, empresa, recarregarPainel } = useResumo();
  const veiculos = useCarregar(() => get(`/veiculos${query({ situacao: "ATIVO" })}`), []);
  const planos = useCarregar(() => get(`/planos-manutencao${query({ situacao: "ATIVO" })}`), []);
  const recentes = useCarregar(() => get(`/ordens-servico${query({ status: "CONCLUIDA" })}`), []);
  const [modo, setModo] = useState("REALIZADO");
  const f = useFormulario({
    placa_veiculo: params.get("veiculo") || "", id_plano: params.get("plano") || "", descricao: "",
    data_conclusao: hojeISO(), data_abertura: hojeISO(), quilometragem: "", valor: "", oficina: "", observacoes: "",
  });

  const pronto = Boolean(veiculos.dados && planos.dados); // o nome do serviço vem do plano: espera carregar
  const veiculo = veiculos.dados?.find((v) => v.placa === f.valores.placa_veiculo);
  const planosDoTipo = useMemo(
    () => (planos.dados || []).filter((p) => !veiculo || p.tipo_veiculo === veiculo.tipo), [planos.dados, veiculo]);
  const plano = planosDoTipo.find((p) => String(p.id_plano) === String(f.valores.id_plano));

  // Trocou para um veículo de outro tipo: o plano escolhido não vale mais
  const { setValores } = f;
  useEffect(() => {
    if (planos.dados && f.valores.id_plano && f.valores.id_plano !== CORRETIVA && !plano) {
      setValores((v) => ({ ...v, id_plano: "" }));
    }
  }, [planos.dados, plano, f.valores.id_plano, setValores]);

  const kmInformado = Number(String(f.valores.quilometragem).replace(/\D/g, "")) || null;
  const proxima = plano && modo === "REALIZADO" && {
    data: plano.intervalo_meses && f.valores.data_conclusao ? somarMeses(f.valores.data_conclusao, plano.intervalo_meses) : null,
    km: plano.intervalo_km && kmInformado ? kmInformado + plano.intervalo_km : null,
  };

  const aoEnviar = f.enviar(async (v) => {
    const servico = v.id_plano === CORRETIVA ? v.descricao.trim() : plano?.descricao || "";
    const descricao = [servico, v.observacoes.trim()].filter(Boolean).join(" — ").slice(0, 255);
    const base = {
      placa_veiculo: v.placa_veiculo || undefined,
      id_plano: v.id_plano === CORRETIVA ? null : Number(v.id_plano),
      descricao, oficina: v.oficina.trim() || null,
    };
    if (modo === "REALIZADO") {
      const corpo = { ...base, data_conclusao: v.data_conclusao || undefined };
      if (v.quilometragem !== "") corpo.quilometragem = kmInformado;
      if (v.valor !== "") corpo.valor = String(v.valor).replace(/\./g, "").replace(",", ".");
      await post("/ordens-servico/realizada", corpo);
      recarregarPainel();
      navegar(`/historico/${v.placa_veiculo}`, { state: { aviso: "Manutenção registrada. Próxima manutenção recalculada." } });
    } else {
      const ordem = await post("/ordens-servico", { ...base, data_abertura: v.data_abertura || undefined });
      navegar("/manutencoes", { state: { aviso: `Ordem de serviço nº ${ordem.numero} aberta. Ela fica Pendente até ser concluída.` } });
    }
  });
  const enviar = (e) => {
    if (!f.valores.id_plano) {  // o serviço é escolhido numa lista: confere antes de chamar a API
      e.preventDefault();
      f.setErros({ id_plano: "Escolha o serviço." });
      f.setErroGeral("Confira os campos destacados.");
      return undefined;
    }
    return aoEnviar(e);
  };

  const frota = painel?.veiculos || [];
  const ultimas = [...(recentes.dados || [])].sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao)).slice(0, 3);
  const emDia = frota.filter((v) => !["VENCIDA", "PROXIMA"].includes(v.situacao)).length;
  const percentual = frota.length ? Math.round((emDia / frota.length) * 100) : 100;
  const nomePorPlaca = new Map(frota.map((v) => [v.placa, nomeVeiculo(v)]));

  return (
    <>
      <Cabecalho migalha={<><Wrench size={13} aria-hidden="true" /> Manutenções / Nova manutenção</>}
        titulo="Registrar Manutenção"
        subtitulo="Cadastre uma revisão realizada ou agende uma manutenção futura para a sua frota."
        acoes={empresa && <span className="chip-suave"><i className="ponto ponto--laranja" />Operação {empresa.razao_social}</span>} />

      <div className="duas-colunas">
        <form className="cartao cartao--destaque formulario" onSubmit={enviar} noValidate>
          <div className="aviso-inteligente">
            <IconeQuadrado icone={Sparkles} tom="info" />
            <div>
              <strong>Acompanhamento Inteligente</strong>
              <p>Manutenções com plano geram lembretes automáticos para você nunca perder o prazo de cada veículo.</p>
            </div>
          </div>
          <Aviso tipo="erro">{f.erroGeral}</Aviso>

          <Campo rotulo="Veículo da frota" dica="Obrigatório" como="select" icone={Truck} value={f.valores.placa_veiculo}
            onChange={f.mudar("placa_veiculo")} erro={f.erros.placa_veiculo}>
            <option value="">Selecione o veículo da frota…</option>
            {veiculos.dados?.map((v) => (
              <option key={v.placa} value={v.placa}>{nomeVeiculo(v)} — {marcaModelo(v)} ({placaFormatada(v.placa)})</option>
            ))}
          </Campo>

          <Campo rotulo="Tipo de serviço" dica="Selecione o procedimento" como="select" icone={Wrench}
            value={f.valores.id_plano} onChange={f.mudar("id_plano")}
            erro={f.erros.id_plano || (f.valores.id_plano !== CORRETIVA ? f.erros.descricao : undefined)}>
            <option value="">Qual serviço será realizado?</option>
            {planosDoTipo.map((p) => <option key={p.id_plano} value={p.id_plano}>{p.descricao} — {intervalo(p)}</option>)}
            <option value={CORRETIVA}>Outro serviço (corretiva, sem plano)</option>
          </Campo>
          {f.valores.id_plano === CORRETIVA && (
            <Campo rotulo="Descrição do serviço" obrigatorio placeholder="Ex.: Troca do farol dianteiro" maxLength={200}
              value={f.valores.descricao} onChange={f.mudar("descricao")} erro={f.erros.descricao} />
          )}

          <div className="campo">
            <span className="campo__rotulo">Situação da manutenção</span>
            <div className="alternador" role="radiogroup" aria-label="Situação da manutenção">
              {[
                { id: "REALIZADO", rotulo: "Serviço já realizado", icone: CircleCheck },
                { id: "AGENDAR", rotulo: "Agendar / Prevista", icone: CalendarClock },
              ].map(({ id, rotulo, icone: Icone }) => (
                <button key={id} type="button" role="radio" aria-checked={modo === id}
                  className={`alternador__item ${modo === id ? "alternador__item--ativo" : ""}`} onClick={() => setModo(id)}>
                  <Icone size={16} aria-hidden="true" /> {rotulo}
                </button>
              ))}
            </div>
          </div>

          {modo === "REALIZADO" ? (
            <div className="grade grade--2">
              <Campo rotulo="Data da realização" type="date" icone={Calendar} value={f.valores.data_conclusao}
                onChange={f.mudar("data_conclusao")} erro={f.erros.data_conclusao} />
              <Campo rotulo="Quilometragem (odômetro)" inputMode="numeric" icone={Gauge} sufixo="km"
                placeholder={veiculo?.km_atual ? String(veiculo.km_atual) : "0"} value={f.valores.quilometragem}
                onChange={f.mudar("quilometragem")} erro={f.erros.quilometragem}
                ajuda={veiculo && `Última leitura: ${km(veiculo.km_atual)}`} />
              <Campo rotulo="Valor do serviço (R$)" inputMode="decimal" icone={CircleDollarSign} placeholder="0,00"
                value={f.valores.valor} onChange={f.mudar("valor")} erro={f.erros.valor} />
              <Campo rotulo="Oficina" icone={Store} placeholder="Onde o serviço foi feito" value={f.valores.oficina}
                onChange={f.mudar("oficina")} erro={f.erros.oficina} />
            </div>
          ) : (
            <div className="grade grade--2">
              <Campo rotulo="Data de abertura" type="date" icone={Calendar} value={f.valores.data_abertura}
                onChange={f.mudar("data_abertura")} erro={f.erros.data_abertura}
                ajuda="A ordem fica Pendente; ao concluir, informe data, km e valor." />
              <Campo rotulo="Oficina" icone={Store} placeholder="Para onde o veículo vai" value={f.valores.oficina}
                onChange={f.mudar("oficina")} erro={f.erros.oficina} />
            </div>
          )}

          {proxima && (
            <div className="proxima-revisao">
              <div className="proxima-revisao__topo">
                <span className="proxima-revisao__titulo"><CalendarPlus size={17} aria-hidden="true" /> Próxima revisão</span>
                <Selo tom="info" ponto={false}>Automático</Selo>
              </div>
              <p className="proxima-revisao__texto">Calculada pelo plano “{plano.descricao}” ({intervalo(plano)}).</p>
              <div className="grade grade--2">
                <div className="proxima-revisao__valor"><span>Data prevista da próxima</span><strong>{proxima.data ? data(proxima.data) : "—"}</strong></div>
                <div className="proxima-revisao__valor"><span>Odômetro previsto</span><strong>{proxima.km ? km(proxima.km) : "—"}</strong></div>
              </div>
            </div>
          )}

          <Campo rotulo="Observações e detalhes" dica="Informações operacionais" como="textarea" rows={3} maxLength={150}
            placeholder="Anote peças trocadas, condições encontradas e recomendações do mecânico…"
            value={f.valores.observacoes} onChange={f.mudar("observacoes")} />

          <div className="formulario__acoes">
            <Botao variante="contorno" onClick={() => navegar(-1)}>Cancelar</Botao>
            <Botao type="submit" icone={Check} carregando={f.enviando} disabled={!pronto}>Salvar manutenção</Botao>
          </div>
        </form>

        <aside className="coluna-lateral">
          <section className="cartao">
            <header className="cartao__topo cartao__topo--compacto">
              <h2 className="cartao__titulo cartao__titulo--p">Estado da Frota Ativa</h2>
              <span className="texto--suave texto--p">{plural(frota.length, "veículo")}</span>
            </header>
            <ul className="frota-mini">
              {frota.map((v) => (
                <li key={v.placa} className="frota-mini__item">
                  <IconeQuadrado icone={Truck} tom="info" tamanho="p" />
                  <span className="frota-mini__textos">
                    <strong>{nomeVeiculo(v)} — {v.modelo}</strong>
                    <span>{placaFormatada(v.placa)} • {km(v.km_atual)}</span>
                  </span>
                  <i className={`ponto ponto--${PONTO[v.situacao]}`} title={v.situacao} />
                </li>
              ))}
            </ul>
            <p className="dica-mini"><Lightbulb size={15} aria-hidden="true" /> Ao salvar, o próximo vencimento do plano é recalculado.</p>
          </section>

          <section className="cartao">
            <header className="cartao__topo cartao__topo--compacto">
              <h2 className="cartao__titulo cartao__titulo--p">Histórico Imediato</h2>
              <span className="texto--suave texto--p">Últimos registros</span>
            </header>
            {ultimas.length === 0 ? (
              <p className="texto--suave texto--p">Nenhuma manutenção concluída ainda.</p>
            ) : (
              <ul className="historico-mini">
                {ultimas.map((o) => (
                  <li key={o.numero}>
                    <i className="ponto ponto--verde" />
                    <span>
                      <strong>{o.descricao}</strong>
                      <span>{nomePorPlaca.get(o.placa_veiculo) || placaFormatada(o.placa_veiculo)} • {haQuanto(o.data_conclusao)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cartao-escuro">
            <span className="cartao-escuro__marca" aria-hidden="true">Health</span>
            <strong>Frota {percentual}% em dia</strong>
            <p>Manutenções em dia evitam paradas inesperadas no meio de um chamado.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
