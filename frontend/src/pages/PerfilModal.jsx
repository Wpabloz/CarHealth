import { Check, KeyRound, Pencil, UserRound } from "lucide-react";

import { patch, post, tokens } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { Aviso, Botao, Campo } from "../components/ui";
import { useFormulario } from "../lib/useFormulario";

const VAZIO = { nome: "", senha_atual: "", nova_senha: "", confirmar: "" };

/**
 * "Editar perfil": o gestor muda o próprio nome; gestor e motorista trocam a senha.
 * O e-mail é o login e não muda. O nome do motorista vem do cadastro dele, mantido pelo gestor.
 */
export default function PerfilModal({ aberto, ...props }) {
  // O formulário só existe com a janela aberta: cada abertura começa do zero, com os dados certos
  return aberto ? <JanelaPerfil {...props} /> : null;
}

function JanelaPerfil({ aoFechar, aoSalvar }) {
  const { usuario, atualizarConta } = useAuth();
  const gestor = usuario?.perfil === "GESTOR";
  const f = useFormulario({ ...VAZIO, nome: usuario?.nome || "" });
  const { setErros, setErroGeral } = f;

  const trocandoSenha = Boolean(f.valores.senha_atual || f.valores.nova_senha || f.valores.confirmar);

  const aoEnviar = f.enviar(async (v) => {
    // Conferências que não precisam da API: assim nada é gravado pela metade
    const erros = {};
    if (gestor && !v.nome.trim()) erros.nome = "Informe o nome.";
    if (trocandoSenha) {
      if (!v.senha_atual) erros.senha_atual = "Informe a senha atual.";
      if (!v.nova_senha) erros.nova_senha = "Informe a nova senha.";
      else if (v.confirmar !== v.nova_senha) erros.confirmar = "As senhas não conferem.";
    }
    if (Object.keys(erros).length) {
      setErros(erros);
      setErroGeral("Confira os campos destacados.");
      return;
    }

    const mensagens = [];
    if (trocandoSenha) {
      // As outras sessões da conta caem; esta continua com os tokens novos que a API devolve
      tokens.salvar(await post("/auth/senha", { senha_atual: v.senha_atual, nova_senha: v.nova_senha }));
      mensagens.push("Senha alterada. Se você estava conectado em outro aparelho, terá de entrar de novo lá.");
    }
    if (gestor && v.nome.trim() !== usuario.nome) {
      atualizarConta(await patch("/auth/me", { nome: v.nome.trim() }));
      mensagens.push("Nome atualizado.");
    }
    aoSalvar(mensagens.length ? mensagens.join(" ") : "Nada foi alterado.");
  });

  return (
    <Modal aberto aoFechar={aoFechar} aoEnviar={aoEnviar} largura={560}
      migalha={<><Pencil size={13} /> Minha conta</>} titulo="Editar perfil"
      subtitulo="Atualize seus dados de acesso."
      rodape={
        <>
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" icone={Check} carregando={f.enviando}>Salvar alterações</Botao>
        </>
      }>
      <Aviso tipo="erro">{f.erroGeral}</Aviso>
      {gestor ? (
        <Campo rotulo="Nome" obrigatorio icone={UserRound} autoComplete="name" maxLength={120}
          value={f.valores.nome} onChange={f.mudar("nome")} erro={f.erros.nome} />
      ) : (
        <Aviso tipo="info">Seu nome vem do cadastro de motorista. Para corrigi-lo, fale com o gestor da empresa.</Aviso>
      )}
      <Campo rotulo="E-mail (login)" value={usuario?.email || ""} disabled
        ajuda="O e-mail é usado para entrar e não pode ser alterado." />

      <fieldset className="grupo">
        <legend className="grupo__titulo"><KeyRound size={16} aria-hidden="true" /> Alterar senha</legend>
        <p className="grupo__texto">Deixe em branco para manter a senha atual.</p>
        <Campo rotulo="Senha atual" type="password" autoComplete="current-password" value={f.valores.senha_atual}
          onChange={f.mudar("senha_atual")} erro={f.erros.senha_atual} />
        <div className="grade grade--2">
          <Campo rotulo="Nova senha" type="password" autoComplete="new-password" value={f.valores.nova_senha}
            onChange={f.mudar("nova_senha")} erro={f.erros.nova_senha}
            ajuda="Pelo menos 8 caracteres, sem ser só números." />
          <Campo rotulo="Confirmar nova senha" type="password" autoComplete="new-password" value={f.valores.confirmar}
            onChange={f.mudar("confirmar")} erro={f.erros.confirmar} />
        </div>
      </fieldset>
    </Modal>
  );
}
