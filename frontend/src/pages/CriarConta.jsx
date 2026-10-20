import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Marca from "../components/Marca";
import { Aviso, Botao, Campo } from "../components/ui";
import { somenteDigitos } from "../lib/formato";
import { useFormulario } from "../lib/useFormulario";

/** Cadastra a empresa e o primeiro gestor (US01 — cadastro). */
export default function CriarConta() {
  const { criarConta } = useAuth();
  const navegar = useNavigate();
  const f = useFormulario({
    cnpj: "", razao_social: "", telefone: "", email_empresa: "", nome: "", email: "", password: "",
  });

  const aoEnviar = f.enviar(async (v) => {
    await criarConta({
      empresa: {
        cnpj: somenteDigitos(v.cnpj),
        razao_social: v.razao_social,
        telefone: somenteDigitos(v.telefone),
        email: v.email_empresa,
      },
      nome: v.nome,
      email: v.email.trim().toLowerCase(),
      password: v.password,
    });
    navegar("/painel", { replace: true, state: { aviso: "Conta criada. Bem-vindo ao CarHealth!" } });
  });

  const e = f.erros;
  return (
    <div className="entrada">
      <div className="entrada__marca">
        <Marca />
        <p className="entrada__frase">Cadastre a sua empresa. Quem cria a conta é o primeiro gestor.</p>
      </div>
      <form className="entrada__cartao entrada__cartao--largo" onSubmit={aoEnviar} noValidate>
        <h1 className="entrada__titulo">Criar conta</h1>
        <Aviso tipo="erro">{f.erroGeral}</Aviso>

        <fieldset className="grupo">
          <legend className="grupo__titulo">Empresa</legend>
          <div className="grade grade--2">
            <Campo rotulo="CNPJ" inputMode="numeric" placeholder="Somente números" value={f.valores.cnpj}
              onChange={f.mudar("cnpj")} erro={e["empresa.cnpj"]} />
            <Campo rotulo="Telefone" inputMode="tel" placeholder="Com DDD" value={f.valores.telefone}
              onChange={f.mudar("telefone")} erro={e["empresa.telefone"]} />
          </div>
          <Campo rotulo="Razão social" value={f.valores.razao_social} onChange={f.mudar("razao_social")}
            erro={e["empresa.razao_social"]} />
          <Campo rotulo="E-mail da empresa" type="email" value={f.valores.email_empresa}
            onChange={f.mudar("email_empresa")} erro={e["empresa.email"]} />
        </fieldset>

        <fieldset className="grupo">
          <legend className="grupo__titulo">Gestor</legend>
          <Campo rotulo="Seu nome" autoComplete="name" value={f.valores.nome} onChange={f.mudar("nome")}
            erro={e.nome} />
          <Campo rotulo="Seu e-mail (login)" type="email" autoComplete="email" value={f.valores.email}
            onChange={f.mudar("email")} erro={e.email} />
          <Campo rotulo="Senha" type="password" autoComplete="new-password" value={f.valores.password}
            onChange={f.mudar("password")} erro={e.password}
            ajuda="Pelo menos 8 caracteres, sem ser só números." />
        </fieldset>

        <Botao type="submit" carregando={f.enviando} className="botao--largo">
          Criar conta
        </Botao>
        <p className="entrada__rodape">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
