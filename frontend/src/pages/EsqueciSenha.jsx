import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";

import { api } from "../api/client";
import Marca from "../components/Marca";
import { Aviso, Botao, Campo } from "../components/ui";
import { useFormulario } from "../lib/useFormulario";

/**
 * "Esqueci minha senha": pede o e-mail e a API envia um link para criar uma nova senha
 * (POST /api/auth/esqueci-senha). A mensagem é a mesma exista a conta ou não.
 */
export default function EsqueciSenha() {
  const f = useFormulario({ email: "" });
  const [enviado, setEnviado] = useState("");

  const aoEnviar = f.enviar(async ({ email }) => {
    const resp = await api("/auth/esqueci-senha", {
      metodo: "POST", corpo: { email: email.trim().toLowerCase() }, publica: true,
    });
    setEnviado(resp.detail);
  });

  return (
    <div className="entrada">
      <div className="entrada__marca">
        <Marca />
        <p className="entrada__frase">A saúde da sua frota em um só lugar.</p>
      </div>
      <form className="entrada__cartao" onSubmit={aoEnviar} noValidate>
        <h1 className="entrada__titulo">Esqueci minha senha</h1>
        {enviado ? (
          <>
            <Aviso tipo="sucesso" icone={MailCheck} titulo="Confira seu e-mail">{enviado}</Aviso>
            <p className="entrada__dica">O link vale por 1 hora. Não chegou? Veja a caixa de spam ou peça de novo.</p>
            <Botao type="button" variante="contorno" className="botao--largo" onClick={() => setEnviado("")}>
              Enviar de novo
            </Botao>
          </>
        ) : (
          <>
            <p className="entrada__dica">Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
            <Aviso tipo="erro">{f.erroGeral}</Aviso>
            <Campo rotulo="E-mail" type="email" autoComplete="email" required value={f.valores.email}
              onChange={f.mudar("email")} erro={f.erros.email} />
            <Botao type="submit" carregando={f.enviando} className="botao--largo">Enviar link</Botao>
          </>
        )}
        <p className="entrada__rodape"><Link to="/login">Voltar para o login</Link></p>
      </form>
    </div>
  );
}
