import { createContext, useContext } from "react";

/**
 * Resumo da frota (GET /api/painel) e dados da empresa, carregados uma vez no layout do gestor
 * e usados pelo menu (contador de lembretes), pelo sino e pelas telas.
 */
export const ResumoContext = createContext({ painel: null, empresa: null, recarregarPainel: () => {} });
export const useResumo = () => useContext(ResumoContext);
