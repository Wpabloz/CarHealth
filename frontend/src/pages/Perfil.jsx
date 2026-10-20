import { useNavigate } from "react-router-dom";

import { get } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Botao, Cabecalho, Cartao, Dado } from "../components/ui";
import { cnpjFormatado } from "../lib/formato";
import { useCarregar } from "../lib/useCarregar";

/** Dados da própria conta e sair do sistema (RF38). Comum aos dois perfis. */
export default function Perfil() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const { dados: empresa } = useCarregar(() => get(`/empresas/${usuario.cnpj_empresa}`), [usuario.cnpj_empresa]);

  const aoSair = () => {
    sair();
    navegar("/login", { replace: true });
  };

  return (
    <>
      <Cabecalho migalha="Minha conta" titulo="Perfil" subtitulo="Dados da sua conta" />
      <Cartao>
        <dl className="dados">
          <Dado rotulo="Nome">{usuario.nome}</Dado>
          <Dado rotulo="E-mail">{usuario.email}</Dado>
          <Dado rotulo="Perfil">{usuario.perfil === "GESTOR" ? "Gestor" : "Motorista"}</Dado>
          <Dado rotulo="Empresa">
            {empresa ? `${empresa.razao_social} · ${cnpjFormatado(empresa.cnpj)}` : cnpjFormatado(usuario.cnpj_empresa)}
          </Dado>
        </dl>
      </Cartao>
      <Botao variante="contorno" onClick={aoSair} className="botao--largo-celular">
        Sair do sistema
      </Botao>
    </>
  );
}
