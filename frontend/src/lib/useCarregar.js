import { useCallback, useEffect, useState } from "react";

/**
 * Carrega dados da API quando a tela abre (e quando as dependências mudam).
 * Uso: const { dados, erro, carregando, recarregar } = useCarregar(() => get("/veiculos"), []);
 */
export function useCarregar(buscar, dependencias) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(buscar, dependencias);

  const recarregar = useCallback(async () => {
    setEstado((atual) => ({ ...atual, carregando: true }));
    try {
      setEstado({ dados: await executar(), erro: null, carregando: false });
    } catch (erro) {
      setEstado({ dados: null, erro, carregando: false });
    }
  }, [executar]);

  useEffect(() => {
    let ativo = true;
    setEstado((atual) => ({ ...atual, carregando: true }));
    executar()
      .then((dados) => ativo && setEstado({ dados, erro: null, carregando: false }))
      .catch((erro) => ativo && setEstado({ dados: null, erro, carregando: false }));
    return () => {
      ativo = false;
    };
  }, [executar]);

  return { ...estado, recarregar };
}
