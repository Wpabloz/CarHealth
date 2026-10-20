import { useNavigate } from "react-router-dom";
import { Plus, Users } from "lucide-react";

import { get } from "../../api/client";
import { AvisoDaNavegacao, BotaoLink, Cabecalho, Cartao, Conteudo, Selo, SeloCadastro, Vazio } from "../../components/ui";
import { cpfMascarado, data } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

/** Motoristas da empresa, com situação do acesso e validade da CNH (RF07, RF11). */
export default function Motoristas() {
  const navegar = useNavigate();
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/motoristas"), []);

  return (
    <>
      <Cabecalho migalha="Cadastros / Equipe" titulo="Motoristas"
        subtitulo="Os motoristas fazem rodízio entre os veículos; cada um pode ter acesso para registrar a quilometragem."
        acoes={<BotaoLink to="/motoristas/novo" icone={Plus}>Novo motorista</BotaoLink>} />
      <AvisoDaNavegacao />
      <Cartao>
        <Conteudo carregando={carregando} erro={erro} tentar={recarregar}>
          {dados?.length === 0 ? (
            <Vazio icone={Users} titulo="Nenhum motorista cadastrado.">
              No cadastro você já pode liberar o acesso dele ao sistema.
            </Vazio>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>CNH</th>
                    <th>Acesso ao sistema</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.map((m) => (
                    <tr key={m.cpf} className="tabela__linha-clicavel" tabIndex={0}
                      onClick={() => navegar(`/motoristas/${m.cpf}`)}
                      onKeyDown={(e) => e.key === "Enter" && navegar(`/motoristas/${m.cpf}`)}>
                      <td>{m.nome}</td>
                      <td>{cpfMascarado(m.cpf)}</td>
                      <td>
                        {data(m.validade_cnh)} {m.cnh_vencida && <Selo tom="perigo">CNH vencida</Selo>}
                      </td>
                      <td>{m.email_acesso || <span className="apagado">Sem acesso</span>}</td>
                      <td><SeloCadastro situacao={m.situacao} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Conteudo>
      </Cartao>
    </>
  );
}
