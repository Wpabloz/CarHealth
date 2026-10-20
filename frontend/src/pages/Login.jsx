import { Link, useLocation, useNavigate } from "react-router-dom";

import { inicioDoPerfil, useAuth } from "../auth/AuthContext";
import Marca from "../components/Marca";
import { Aviso, Botao, Campo } from "../components/ui";
import { useFormulario } from "../lib/useFormulario";

/** Login único: o sistema identifica o perfil pela conta e leva cada um à sua área (RF04). */
export default function Login() {
  const { entrar, motivoSaida } = useAuth();
  const navegar = useNavigate();
  const { state } = useLocation();
  const f = useFormulario({ email: "", senha: "" });

  const aoEnviar = f.enviar(async ({ email, senha }) => {
    const conta = await entrar(email.trim().toLowerCase(), senha);
    const destino = state?.voltarPara && conta.perfil === "GESTOR" ? state.voltarPara : inicioDoPerfil(conta);
    navegar(destino, { replace: true });
  });

  return (
    <div className="entrada">
      <div className="entrada__marca">
        <Marca />
        <p className="entrada__frase">A saúde da sua frota em um só lugar.</p>
      </div>
      <form className="entrada__cartao" onSubmit={aoEnviar} noValidate>
        <h1 className="entrada__titulo">Entrar</h1>
        {!f.erroGeral && <Aviso tipo="info">{motivoSaida}</Aviso>}
        <Aviso tipo="erro">{f.erroGeral}</Aviso>
        <Campo rotulo="E-mail" type="email" autoComplete="email" required value={f.valores.email}
          onChange={f.mudar("email")} erro={f.erros.email} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" required value={f.valores.senha}
          onChange={f.mudar("senha")} erro={f.erros.password} />
        <Botao type="submit" carregando={f.enviando} className="botao--largo">
          Entrar
        </Botao>
        <p className="entrada__rodape">
          Sua empresa ainda não usa o CarHealth? <Link to="/criar-conta">Criar conta</Link>
        </p>
        <p className="entrada__dica">Motorista: seu acesso é criado pelo gestor da empresa.</p>
      </form>
    </div>
  );
}
