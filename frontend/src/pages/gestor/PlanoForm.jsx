import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { get, patch, post } from "../../api/client";
import { Aviso, Botao, Cabecalho, Campo, Cartao, Conteudo } from "../../components/ui";
import { useCarregar } from "../../lib/useCarregar";
import { useFormulario } from "../../lib/useFormulario";

/** Novo plano ou edição. Pelo menos um intervalo; com os dois, vence o que ocorrer primeiro (RN04, RN05). */
export default function PlanoForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const { dados: tipos } = useCarregar(() => get("/veiculos/tipos"), []);
  const atual = useCarregar(() => (editando ? get(`/planos-manutencao/${id}`) : Promise.resolve(null)), [id]);
  const f = useFormulario({ descricao: "", tipo_veiculo: "", intervalo_km: "", intervalo_meses: "", situacao: "ATIVO" });

  const { setValores } = f;
  useEffect(() => {
    if (atual.dados) {
      setValores({
        ...atual.dados,
        intervalo_km: atual.dados.intervalo_km ?? "",
        intervalo_meses: atual.dados.intervalo_meses ?? "",
      });
    }
  }, [atual.dados, setValores]);

  const salvar = async (v, situacao = v.situacao) => {
    const corpo = {
      descricao: v.descricao,
      tipo_veiculo: v.tipo_veiculo,
      intervalo_km: v.intervalo_km === "" ? null : Number(v.intervalo_km),
      intervalo_meses: v.intervalo_meses === "" ? null : Number(v.intervalo_meses),
      situacao,
    };
    if (editando) await patch(`/planos-manutencao/${id}`, corpo);
    else await post("/planos-manutencao", corpo);
  };

  const aoEnviar = f.enviar(async (v) => {
    await salvar(v);
    navegar("/planos", { state: { aviso: editando ? "Plano atualizado." : "Plano cadastrado." } });
  });

  const alternarSituacao = f.enviar(async (v) => {
    const nova = v.situacao === "ATIVO" ? "INATIVO" : "ATIVO";
    await salvar(v, nova);
    navegar("/planos", {
      state: { aviso: nova === "INATIVO" ? "Plano inativado. As ordens antigas continuam no histórico." : "Plano reativado." },
    });
  });

  return (
    <>
      <Cabecalho migalha="Cadastros / Planos de manutenção" titulo={editando ? "Editar plano" : "Novo plano"} voltar="/planos" />
      <Conteudo carregando={editando && atual.carregando} erro={atual.erro}>
        <Cartao>
          <form onSubmit={aoEnviar} className="formulario" noValidate>
            <Aviso tipo="erro">{f.erroGeral}</Aviso>
            <Campo rotulo="Serviço" placeholder="Ex.: Troca de óleo e filtro" value={f.valores.descricao}
              onChange={f.mudar("descricao")} erro={f.erros.descricao} />
            <Campo rotulo="Tipo de veículo" list="tipos-plano" value={f.valores.tipo_veiculo}
              onChange={f.mudar("tipo_veiculo")} erro={f.erros.tipo_veiculo}
              ajuda="Precisa ser igual ao tipo cadastrado no veículo." />
            <datalist id="tipos-plano">
              {tipos?.map((t) => <option key={t} value={t} />)}
            </datalist>
            <div className="grade grade--2">
              <Campo rotulo="Intervalo em quilômetros" type="number" inputMode="numeric" min="1"
                value={f.valores.intervalo_km} onChange={f.mudar("intervalo_km")} erro={f.erros.intervalo_km} />
              <Campo rotulo="Intervalo em meses" type="number" inputMode="numeric" min="1"
                value={f.valores.intervalo_meses} onChange={f.mudar("intervalo_meses")} erro={f.erros.intervalo_meses} />
            </div>
            <p className="campo__ajuda">Informe pelo menos um. Com os dois, vale o que vencer primeiro.</p>
            <div className="formulario__acoes">
              {editando && (
                <Botao variante="contorno" onClick={alternarSituacao} disabled={f.enviando}>
                  {f.valores.situacao === "ATIVO" ? "Inativar plano" : "Reativar plano"}
                </Botao>
              )}
              <Botao type="submit" carregando={f.enviando}>{editando ? "Salvar" : "Cadastrar plano"}</Botao>
            </div>
          </form>
        </Cartao>
      </Conteudo>
    </>
  );
}
