import { createContext, useContext } from "react";

/**
 * Dados do dia do motorista, carregados uma vez no layout: o check-in de hoje, o caminhão
 * (com a situação das manutenções), os avisos para "Entendi" e o último problema avisado.
 */
export const MotoristaContexto = createContext({
  checkin: null, veiculo: null, avisos: [], ultimoAviso: null,
  recarregar: async () => {}, marcarVisto: async () => {},
});
export const useMotorista = () => useContext(MotoristaContexto);
