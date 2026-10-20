import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";

import { get } from "../../api/client";
import { AvisoDaNavegacao, BotaoLink, Cabecalho, Cartao, Conteudo, SeloCadastro, Vazio } from "../../components/ui";
import { intervalo } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

/** Regras de manutenção preventiva da empresa (RF16, RF17, RF18). */
export default function Planos() {
  const navegar = useNavigate();
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/planos-manutencao"), []);

  return (
    <>
      <Cabecalho migalha="Cadastros / Regras preventivas" titulo="Planos de manutenção"
        subtitulo="O plano vale para todos os veículos do mesmo tipo. É dele que saem os lembretes."
        acoes={<BotaoLink to="/planos/novo" icone={Plus}>Novo plano</BotaoLink>} />
      <AvisoDaNavegacao />
      <Cartao>
        <Conteudo carregando={carregando} erro={erro} tentar={recarregar}>
          {dados?.length === 0 ? (
            <Vazio icone={ClipboardList} titulo="Nenhum plano cadastrado.">
              Ex.: troca de óleo a cada 10.000 km ou 6 meses, para veículos do tipo CAMINHAO.
            </Vazio>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Tipo de veículo</th>
                    <th>Intervalo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.map((p) => (
                    <tr key={p.id_plano} className="tabela__linha-clicavel" tabIndex={0}
                      onClick={() => navegar(`/planos/${p.id_plano}`)}
                      onKeyDown={(e) => e.key === "Enter" && navegar(`/planos/${p.id_plano}`)}>
                      <td>{p.descricao}</td>
                      <td>{p.tipo_veiculo}</td>
                      <td>{intervalo(p)}</td>
                      <td><SeloCadastro situacao={p.situacao} /></td>
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
