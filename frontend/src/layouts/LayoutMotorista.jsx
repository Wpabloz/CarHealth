import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { get, post } from "../api/client";
import { CarregandoMo } from "../components/motorista/ui";
import { MotoristaContexto } from "./motoristaContexto";
import "../styles/motorista.css";

const VAZIO = { checkin: null, veiculo: null, avisos: [], ultimoAviso: null };

/**
 * Área do motorista (celular). Antes de tudo, o check-in do dia (Sprint 5): sem ele, qualquer
 * tela leva à leitura do QR code — a API também recusa as outras ações (ExigeCheckinDoDia).
 * Com o check-in, carrega o caminhão do dia, os avisos e o último problema avisado.
 */
export default function LayoutMotorista() {
  const local = useLocation();
  const [estado, setEstado] = useState({ ...VAZIO, carregando: true, erro: null });

  const recarregar = useCallback(async () => {
    try {
      let checkin = null;
      try {
        checkin = await get("/checkins/hoje");
      } catch (erro) {
        if (erro.status !== 404) throw erro;
      }
      if (!checkin) {
        setEstado({ ...VAZIO, carregando: false, erro: null });
        return;
      }
      const placa = checkin.placa_veiculo;
      const [veiculo, avisos, problemas] = await Promise.all([
        get(`/veiculos/${placa}/situacao`), get(`/veiculos/${placa}/avisos`), get("/problemas"),
      ]);
      setEstado({ checkin, veiculo, avisos, ultimoAviso: problemas[0] || null, carregando: false, erro: null });
    } catch (erro) {
      setEstado((atual) => ({ ...atual, carregando: false, erro }));
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  /** "Entendi" num aviso: grava na API e atualiza a lista e o número do menu na hora. */
  const marcarVisto = useCallback(async (idPlano) => {
    const placa = estado.checkin?.placa_veiculo;
    const atualizado = await post(`/veiculos/${placa}/avisos/${idPlano}/entendi`);
    setEstado((atual) => ({
      ...atual, avisos: atual.avisos.map((a) => (a.id_plano === idPlano ? { ...a, visto: atualizado.visto } : a)),
    }));
  }, [estado.checkin]);

  const valor = useMemo(() => ({ ...estado, recarregar, marcarVisto }), [estado, recarregar, marcarVisto]);
  const naAreaDoCheckin = local.pathname.startsWith("/m/checkin");

  let conteudo;
  if (estado.carregando) conteudo = <CarregandoMo />;
  else if (!estado.checkin && !naAreaDoCheckin) return <Navigate to="/m/checkin" replace />;
  else conteudo = <Outlet />;

  return (
    <MotoristaContexto.Provider value={valor}>
      <div className="mo-fundo">
        <div className="mo-app">{conteudo}</div>
      </div>
    </MotoristaContexto.Provider>
  );
}
