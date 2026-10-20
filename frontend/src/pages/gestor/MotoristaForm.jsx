import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { get, patch, post } from "../../api/client";
import { Aviso, Botao, Cabecalho, Campo, Cartao, Conteudo, Selo, SeloCadastro } from "../../components/ui";
import { somenteDigitos } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import { useFormulario } from "../../lib/useFormulario";

/**
 * Cadastro do motorista. O gestor libera o acesso no mesmo formulário, com e-mail
 * e senha inicial (RF33); o motorista não cria conta sozinho.
 */
export default function MotoristaForm() {
  const { cpf } = useParams();
  const editando = Boolean(cpf);
  const navegar = useNavigate();
  const atual = useCarregar(() => (editando ? get(`/motoristas/${cpf}`) : Promise.resolve(null)), [cpf]);
  const f = useFormulario({
    nome: "", cpf: "", telefone: "", num_cnh: "", validade_cnh: "", situacao: "ATIVO",
    email_acesso: "", senha_inicial: "",
  });

  const { setValores } = f;
  useEffect(() => {
    if (atual.dados) setValores({ ...atual.dados, email_acesso: "", senha_inicial: "" });
  }, [atual.dados, setValores]);

  const temAcesso = Boolean(atual.dados?.email_acesso);
  const aoEnviar = f.enviar(async (v) => {
    const corpo = {
      nome: v.nome, telefone: somenteDigitos(v.telefone), num_cnh: somenteDigitos(v.num_cnh),
      validade_cnh: v.validade_cnh, situacao: v.situacao,
    };
    if (!temAcesso && (v.email_acesso || v.senha_inicial)) {
      Object.assign(corpo, { email_acesso: v.email_acesso.trim().toLowerCase(), senha_inicial: v.senha_inicial });
    }
    if (editando) await patch(`/motoristas/${cpf}`, corpo);
    else await post("/motoristas", { ...corpo, cpf: somenteDigitos(v.cpf) });
    navegar("/motoristas", { state: { aviso: editando ? "Motorista atualizado." : "Motorista cadastrado." } });
  });

  return (
    <>
      <Cabecalho migalha="Cadastros / Motoristas" titulo={editando ? atual.dados?.nome || "Motorista" : "Novo motorista"} voltar="/motoristas" />
      <Conteudo carregando={editando && atual.carregando} erro={atual.erro}>
        <Cartao>
          <form onSubmit={aoEnviar} className="formulario" noValidate>
            <Aviso tipo="erro">{f.erroGeral}</Aviso>
            <fieldset className="grupo">
              <legend className="grupo__titulo">Dados do motorista</legend>
              <Campo rotulo="Nome completo" value={f.valores.nome} onChange={f.mudar("nome")} erro={f.erros.nome} />
              <div className="grade grade--2">
                <Campo rotulo="CPF" inputMode="numeric" placeholder="Somente números" value={f.valores.cpf}
                  disabled={editando} onChange={f.mudar("cpf")} erro={f.erros.cpf} />
                <Campo rotulo="Telefone" inputMode="tel" placeholder="Com DDD" value={f.valores.telefone}
                  onChange={f.mudar("telefone")} erro={f.erros.telefone} />
                <Campo rotulo="Número da CNH" inputMode="numeric" value={f.valores.num_cnh}
                  onChange={f.mudar("num_cnh")} erro={f.erros.num_cnh} />
                <Campo rotulo="Validade da CNH" type="date" value={f.valores.validade_cnh}
                  onChange={f.mudar("validade_cnh")} erro={f.erros.validade_cnh} />
              </div>
              {editando && (
                <Campo rotulo="Situação" como="select" value={f.valores.situacao} onChange={f.mudar("situacao")}
                  erro={f.erros.situacao} ajuda="Motorista inativo não entra no sistema; o histórico é mantido.">
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </Campo>
              )}
            </fieldset>

            <fieldset className="grupo">
              <legend className="grupo__titulo">Acesso ao sistema</legend>
              {temAcesso ? (
                <ContaDoMotorista email={atual.dados.email_acesso} />
              ) : (
                <>
                  <p className="grupo__texto">
                    Opcional. Com e-mail e senha inicial, o motorista entra pelo celular para registrar a quilometragem.
                  </p>
                  <div className="grade grade--2">
                    <Campo rotulo="E-mail de acesso" type="email" autoComplete="off" value={f.valores.email_acesso}
                      onChange={f.mudar("email_acesso")} erro={f.erros.email_acesso} />
                    <Campo rotulo="Senha inicial" type="password" autoComplete="new-password"
                      value={f.valores.senha_inicial} onChange={f.mudar("senha_inicial")} erro={f.erros.senha_inicial}
                      ajuda="Passe a senha ao motorista pessoalmente." />
                  </div>
                </>
              )}
            </fieldset>

            <div className="formulario__acoes">
              <Botao type="submit" carregando={f.enviando}>{editando ? "Salvar" : "Cadastrar motorista"}</Botao>
            </div>
          </form>
        </Cartao>
      </Conteudo>
    </>
  );
}

/** Conta já liberada: o gestor pode inativar ou reativar o acesso (RN18). */
function ContaDoMotorista({ email }) {
  const conta = useCarregar(() => get(`/usuarios/${encodeURIComponent(email)}`), [email]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ativa = conta.dados?.situacao === "ATIVO";

  const alternar = async () => {
    setEnviando(true);
    setErro("");
    try {
      await patch(`/usuarios/${encodeURIComponent(email)}`, { situacao: ativa ? "INATIVO" : "ATIVO" });
      conta.recarregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="conta">
      <div>
        <span className="conta__email">{email}</span>{" "}
        {conta.dados ? <SeloCadastro situacao={conta.dados.situacao} /> : <Selo>…</Selo>}
      </div>
      <Botao variante={ativa ? "secundario" : "primario"} carregando={enviando} onClick={alternar}>
        {ativa ? "Inativar acesso" : "Reativar acesso"}
      </Botao>
      <Aviso tipo="erro">{erro}</Aviso>
    </div>
  );
}
