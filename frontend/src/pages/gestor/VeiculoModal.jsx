import { useState } from "react";
import { Check, CirclePlus, Pencil, Trash2 } from "lucide-react";

import { get, patch, post, remover } from "../../api/client";
import Modal from "../../components/Modal";
import { Aviso, Botao, Campo } from "../../components/ui";
import { nomeVeiculo, somenteDigitos } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import { useFormulario } from "../../lib/useFormulario";

const VAZIO = {
  identificacao: "", placa: "", marca: "", modelo: "", ano: "", quilometragem_inicial: "",
  tipo: "", situacao: "ATIVO", observacoes: "",
};

/**
 * "Cadastrar Novo Veículo" do protótipo. Com veiculo, edita (a placa e a km não mudam por aqui)
 * e permite excluir o que foi cadastrado por engano, desde que não tenha histórico (RN15).
 */
export default function VeiculoModal({ aberto, ...props }) {
  // O formulário só existe com a janela aberta: cada abertura começa do zero, com os dados certos
  return aberto ? <JanelaVeiculo {...props} /> : null;
}

function JanelaVeiculo({ veiculo, aoFechar, aoSalvar, aoExcluir }) {
  const editando = Boolean(veiculo);
  const f = useFormulario(editando
    ? { ...VAZIO, ...veiculo, identificacao: veiculo.identificacao || "", observacoes: veiculo.observacoes || "" }
    : VAZIO);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const { dados: tipos } = useCarregar(() => get("/veiculos/tipos"), []);
  const { setErroGeral } = f;

  const aoEnviar = f.enviar(async (v) => {
    const corpo = {
      identificacao: v.identificacao, marca: v.marca, modelo: v.modelo, ano: v.ano === "" ? null : Number(v.ano),
      tipo: v.tipo, observacoes: v.observacoes || null, situacao: v.situacao,
    };
    let salvo;
    if (editando) {
      salvo = await patch(`/veiculos/${veiculo.placa}`, corpo);
    } else {
      corpo.placa = v.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (v.quilometragem_inicial !== "") corpo.quilometragem_inicial = Number(somenteDigitos(v.quilometragem_inicial));
      salvo = await post("/veiculos", corpo);
    }
    aoSalvar(salvo, editando);
  });

  const excluir = async () => {
    setExcluindo(true);
    setErroGeral("");
    try {
      await remover(`/veiculos/${veiculo.placa}`);
      aoExcluir(veiculo);
    } catch (erro) {
      setConfirmarExclusao(false);
      setErroGeral(erro.status === 409
        ? "Este veículo já tem histórico (leituras de odômetro ou ordens de serviço, inclusive a quilometragem "
          + "informada no cadastro) e por isso não pode ser excluído. Para tirá-lo de uso, mude a Situação para "
          + "Inativo e salve."
        : erro.message);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Modal aberto aoFechar={aoFechar} aoEnviar={aoEnviar}
      migalha={<>{editando ? <Pencil size={13} /> : <CirclePlus size={13} />} {editando ? "Editar registro" : "Novo registro"}</>}
      titulo={editando ? "Editar Veículo" : "Cadastrar Novo Veículo"}
      subtitulo={editando ? "Atualize os dados do veículo." : "Preencha os dados do novo veículo para iniciar o acompanhamento."}
      rodape={confirmarExclusao ? (
        <div className="confirmacao confirmacao--rodape" role="alert">
          <span>
            <strong>Excluir {nomeVeiculo(veiculo)} definitivamente?</strong> Só é possível se ele não tiver
            leituras de odômetro nem ordens de serviço.
          </span>
          <Botao variante="contorno" onClick={() => setConfirmarExclusao(false)}>Não</Botao>
          <Botao variante="perigo" icone={Trash2} carregando={excluindo} onClick={excluir}>Sim, excluir</Botao>
        </div>
      ) : (
        <>
          {editando && aoExcluir && (
            <Botao variante="perigo-suave" icone={Trash2} className="modal__rodape-esquerda"
              onClick={() => setConfirmarExclusao(true)}>
              Excluir veículo
            </Botao>
          )}
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" icone={Check} carregando={f.enviando}>Salvar veículo</Botao>
        </>
      )}>
      <Aviso tipo="erro">{f.erroGeral}</Aviso>
      <div className="grade grade--2">
        <Campo rotulo="Identificação do veículo" placeholder="Ex.: Guincho 04" value={f.valores.identificacao}
          onChange={f.mudar("identificacao")} erro={f.erros.identificacao} ajuda="Nome comum usado pela equipe" maxLength={30} />
        <Campo rotulo="Placa (Mercosul ou antiga)" obrigatorio placeholder="RBQ-9D82" value={f.valores.placa}
          disabled={editando} onChange={(e) => f.mudar("placa")({ target: { value: e.target.value.toUpperCase() } })}
          erro={f.erros.placa} ajuda={editando ? "A placa não pode ser alterada." : "Conforme documento do veículo"} />
        <Campo rotulo="Marca" obrigatorio placeholder="Volkswagen" value={f.valores.marca} onChange={f.mudar("marca")}
          erro={f.erros.marca} />
        <Campo rotulo="Modelo" obrigatorio placeholder="Delivery 9.170" value={f.valores.modelo} onChange={f.mudar("modelo")}
          erro={f.erros.modelo} />
        <Campo rotulo="Ano de fabricação" obrigatorio type="number" inputMode="numeric" placeholder="2023"
          value={f.valores.ano} onChange={f.mudar("ano")} erro={f.erros.ano} />
        {editando ? (
          <Campo rotulo="Situação" como="select" value={f.valores.situacao} onChange={f.mudar("situacao")}
            erro={f.erros.situacao} ajuda="Veículo inativo sai dos lembretes; o histórico é mantido.">
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </Campo>
        ) : (
          <Campo rotulo="Quilometragem atual (km)" inputMode="numeric" placeholder="45.200"
            value={f.valores.quilometragem_inicial} onChange={f.mudar("quilometragem_inicial")}
            erro={f.erros.quilometragem_inicial} ajuda="Vira a primeira leitura do odômetro" />
        )}
        <Campo rotulo="Tipo do veículo" obrigatorio list="tipos-veiculo" placeholder="GUINCHO" value={f.valores.tipo}
          onChange={f.mudar("tipo")} erro={f.erros.tipo} ajuda="O plano de manutenção vale para veículos do mesmo tipo" />
      </div>
      <datalist id="tipos-veiculo">{tipos?.map((t) => <option key={t} value={t} />)}</datalist>
      <Campo rotulo="Observações e Equipamentos Instalados" como="textarea" rows={3} maxLength={255}
        placeholder="Plataforma hidráulica asa-delta, guincho elétrico com controle remoto sem fio."
        value={f.valores.observacoes} onChange={f.mudar("observacoes")} erro={f.erros.observacoes}
        ajuda="Informações complementares úteis para os mecânicos e motoristas" />
    </Modal>
  );
}
