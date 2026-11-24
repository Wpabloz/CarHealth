import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleCheck } from "lucide-react";

import { api } from "../api/client";
import Marca from "../components/Marca";
import { Aviso, Botao, BotaoLink, Campo } from "../components/ui";
import { useFormulario } from "../lib/useFormulario";

/**
 * Tela aberta pelo link do e-mail: /redefinir-senha?uid=...&token=...
 * Envia a nova senha para POST /api/auth/redefinir-senha.
 */
export default function RedefinirSenha() {
  const [busca] = useSearchParams();
  const uid = busca.get("uid") || "";
  const token = busca.get("token") || "";
  const f = useFormulario({ nova_senha: "", confirmacao: "" });
  const [pronto, setPronto] = useState(false);

  const aoEnviar = f.enviar(async ({ nova_senha, confirmacao }) => {
    if (nova_senha !== confirmacao) {
      f.setErros({ confirmacao: "As senhas não são iguais." });
      return;
    }
    await api("/auth/redefinir-senha", { metodo: "POST", corpo: { uid, token, nova_senha }, publica: true });
    setPronto(true);
  });

  const linkInvalido = !uid || !token || f.erros.token;
  return (
    <div className="entrada">
      <div className="entrada__marca">
        <Marca />
        <p className="entrada__frase">A saúde da sua frota em um só lugar.</p>
      </div>
      <form className="entrada__cartao" onSubmit={aoEnviar} noValidate>
        <h1 className="entrada__titulo">Criar nova senha</h1>
        {pronto ? (
          <>
            <Aviso tipo="sucesso" icone={CircleCheck} titulo="Senha alterada">Agora é só entrar com a nova senha.</Aviso>
            <BotaoLink to="/login" className="botao--largo">Ir para o login</BotaoLink>
          </>
        ) : linkInvalido ? (
          <>
            <Aviso tipo="erro" titulo="Link inválido ou expirado">
              {f.erros.token || "Abra o link exatamente como chegou no e-mail."}
            </Aviso>
            <BotaoLink to="/esqueci-senha" className="botao--largo">Pedir um novo link</BotaoLink>
          </>
        ) : (
          <>
            <Aviso tipo="erro">{f.erroGeral !== "Confira os campos destacados." && f.erroGeral}</Aviso>
            <Campo rotulo="Nova senha" type="password" autoComplete="new-password" required value={f.valores.nova_senha}
              onChange={f.mudar("nova_senha")} erro={f.erros.nova_senha}
              ajuda="Pelo menos 8 caracteres; não pode ser só números nem uma senha comum." />
            <Campo rotulo="Repita a nova senha" type="password" autoComplete="new-password" required
              value={f.valores.confirmacao} onChange={f.mudar("confirmacao")} erro={f.erros.confirmacao} />
            <Botao type="submit" carregando={f.enviando} className="botao--largo">Salvar nova senha</Botao>
          </>
        )}
        <p className="entrada__rodape"><Link to="/login">Voltar para o login</Link></p>
      </form>
    </div>
  );
}
