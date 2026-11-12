import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight, CircleCheck, Gauge, TriangleAlert, Truck } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import {
  BotaoLinkMo, CarregandoMo, Conteudo, IconeBloco, MenuInferior, PlacaMo, TopoMarca,
} from "../../components/motorista/ui";
import { useMotorista } from "../../layouts/motoristaContexto";
import { nomeVeiculo } from "../../lib/formato";
import { SITUACAO_DO_PROBLEMA, piorPendencia, primeiroNome, tituloDoAlerta } from "../../lib/motorista";

/** 01 — Início: o caminhão do dia, o alerta de manutenção, as duas ações e o último aviso. */
export default function MInicio() {
  const { usuario } = useAuth();
  const { veiculo, ultimoAviso, erro, recarregar } = useMotorista();
  const { state } = useLocation();
  const navegar = useNavigate();
  const [mensagem, setMensagem] = useState(state?.aviso || "");

  useEffect(() => {
    if (!state?.aviso) return undefined;
    navegar(".", { replace: true, state: null }); // a mensagem aparece uma vez só
    const t = setTimeout(() => setMensagem(""), 4000);
    return () => clearTimeout(t);
  }, [state, navegar]);

  if (!veiculo) {
    return (
      <>
        <TopoMarca />
        {erro ? (
          <Conteudo>
            <p className="mo-erro" role="alert">{erro.message}</p>
            <button type="button" className="mo-botao mo-botao--contorno" onClick={recarregar}>Tentar de novo</button>
          </Conteudo>
        ) : <CarregandoMo />}
        <MenuInferior />
      </>
    );
  }

  const pendencia = piorPendencia(veiculo.planos);
  const situacao = ultimoAviso && SITUACAO_DO_PROBLEMA[ultimoAviso.situacao];

  return (
    <>
      <TopoMarca />
      <Conteudo gap={20}>
        {mensagem && <p className="mo-toast" role="status"><CircleCheck size={20} aria-hidden="true" /> {mensagem}</p>}
        <h1 className="mo-titulo">Olá, {primeiroNome(usuario?.nome)}!</h1>

        <section className="mo-cartao" aria-label="Seu caminhão">
          <div className="mo-veiculo">
            <IconeBloco icone={Truck} tamanho={60} raio={16} iconeTamanho={32} strokeWidth={2} />
            <div className="mo-veiculo__textos">
              <span className="mo-rotulo-p">Seu caminhão</span>
              <span className="mo-nome-veiculo">{nomeVeiculo(veiculo)}</span>
              <PlacaMo placa={veiculo.placa} />
            </div>
          </div>
          {pendencia && (
            <Link to="/m/avisos" className={`mo-alerta${pendencia.situacao === "VENCIDA" ? "" : " mo-alerta--proxima"}`}>
              <IconeBloco icone={pendencia.situacao === "VENCIDA" ? TriangleAlert : CalendarClock} tamanho={44} raio={12}
                iconeTamanho={24} tom={pendencia.situacao === "VENCIDA" ? "vermelho" : "marrom"} />
              <span className="mo-alerta__textos">
                <span className="mo-alerta__titulo">{tituloDoAlerta(pendencia)}</span>
                <span className="mo-alerta__texto">
                  {pendencia.situacao === "VENCIDA" ? "O responsável já foi avisado" : "Fique atento ao prazo"}
                </span>
              </span>
              <ChevronRight size={24} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          )}
        </section>

        <div className="mo-botoes">
          <BotaoLinkMo alto icone={TriangleAlert} to="/m/problema">Avisar um problema</BotaoLinkMo>
          <BotaoLinkMo alto variante="contorno" icone={Gauge} to="/m/km">Informar quilometragem</BotaoLinkMo>
        </div>

        {ultimoAviso && (
          <section className="mo-cartao mo-cartao--aviso" aria-label="Seu último aviso">
            <span className="mo-rotulo-p">Seu último aviso</span>
            <span className="mo-titulo-aviso">{ultimoAviso.descricao || `Problema: ${ultimoAviso.componente_nome}`}</span>
            <span className={`mo-chip${situacao.tom ? ` mo-chip--${situacao.tom}` : ""}`}>{situacao.texto}</span>
          </section>
        )}
      </Conteudo>
      <MenuInferior />
    </>
  );
}
