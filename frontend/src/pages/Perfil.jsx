import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, LogOut, Pencil } from "lucide-react";

import { get } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Aviso, Botao, Cabecalho, Cartao, Dado } from "../components/ui";
import { cnpjFormatado } from "../lib/formato";
import { useCarregar } from "../lib/useCarregar";
import PerfilModal from "./PerfilModal";

/** Dados da própria conta, editar perfil e sair do sistema (RF38). Comum aos dois perfis. */
export default function Perfil() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState("");
  const { dados: empresa } = useCarregar(() => get(`/empresas/${usuario.cnpj_empresa}`), [usuario.cnpj_empresa]);

  const aoSair = () => {
    sair();
    navegar("/login", { replace: true });
  };
  const aoSalvar = (mensagem) => {
    setEditando(false);
    setAviso(mensagem);
  };

  return (
    <>
      <Cabecalho migalha="Minha conta" titulo="Perfil" subtitulo="Dados da sua conta"
        acoes={<Botao icone={Pencil} onClick={() => { setAviso(""); setEditando(true); }}>Editar perfil</Botao>} />
      <Aviso tipo="sucesso" icone={CircleCheck}>{aviso}</Aviso>
      <Cartao className="perfil">
        <div className="perfil__topo">
          <span className="avatar avatar--g" aria-hidden="true">{usuario.nome?.[0]?.toUpperCase() || "?"}</span>
          <div>
            <h2 className="perfil__nome">{usuario.nome}</h2>
            <span className="perfil__papel">{usuario.perfil === "GESTOR" ? "Gestor" : "Motorista"}</span>
          </div>
        </div>
        <dl className="dados dados--2">
          <Dado rotulo="E-mail">{usuario.email}</Dado>
          <Dado rotulo="Perfil">{usuario.perfil === "GESTOR" ? "Gestor" : "Motorista"}</Dado>
          <Dado rotulo="Empresa">
            {empresa ? `${empresa.razao_social} · ${cnpjFormatado(empresa.cnpj)}` : cnpjFormatado(usuario.cnpj_empresa)}
          </Dado>
        </dl>
      </Cartao>
      <Botao variante="contorno" icone={LogOut} onClick={aoSair} className="botao--largo-celular">
        Sair do sistema
      </Botao>
      <PerfilModal aberto={editando} aoFechar={() => setEditando(false)} aoSalvar={aoSalvar} />
    </>
  );
}
