import { useState } from "react";

import { ErroApi } from "../api/client";

/**
 * Estado de um formulário: valores, erros por campo (vindos da API) e envio.
 *
 *   const f = useFormulario({ placa: "", marca: "" });
 *   <Campo rotulo="Placa" value={f.valores.placa} onChange={f.mudar("placa")} erro={f.erros.placa} />
 *   <form onSubmit={f.enviar(async (valores) => { await post("/veiculos", valores); })}>
 */
export function useFormulario(inicial) {
  const [valores, setValores] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo) => (evento) => {
    const alvo = evento.target;
    const valor = alvo.type === "checkbox" ? alvo.checked : alvo.value;
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    if (erros[campo]) setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  };

  const enviar = (acao) => async (evento) => {
    evento?.preventDefault();
    setEnviando(true);
    setErros({});
    setErroGeral("");
    try {
      await acao(valores);
    } catch (erro) {
      if (erro instanceof ErroApi) {
        setErros(erro.campos);
        // Erro de um campo que não está na tela (ex.: senha_inicial) vai para a mensagem geral
        const naTela = (chave) => chave in valores || chave.split(".").pop() in valores;
        const fora = Object.entries(erro.campos).filter(([chave]) => !naTela(chave)).map(([, msg]) => msg);
        if (fora.length) setErroGeral(fora.join(" "));
        else setErroGeral(Object.keys(erro.campos).length ? "Confira os campos destacados." : erro.message);
      } else {
        setErroGeral("Algo deu errado. Tente de novo.");
        throw erro;
      }
    } finally {
      setEnviando(false);
    }
  };

  return { valores, setValores, mudar, erros, setErros, erroGeral, setErroGeral, enviando, enviar };
}
