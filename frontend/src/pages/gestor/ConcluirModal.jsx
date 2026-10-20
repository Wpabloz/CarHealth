import { useEffect } from "react";
import { Calendar, Check, CircleDollarSign, Gauge, Store, Wrench } from "lucide-react";

import { post } from "../../api/client";
import Modal from "../../components/Modal";
import { Aviso, Botao, Campo } from "../../components/ui";
import { hojeISO, km, nomeVeiculo } from "../../lib/formato";
import { useFormulario } from "../../lib/useFormulario";

/**
 * Concluir uma ordem aberta: data, quilometragem e valor são obrigatórios (RN11);
 * a leitura de odômetro é gravada junto, com origem ordem de serviço (RN09).
 */
export default function ConcluirModal({ ordem, veiculo, aoFechar, aoConcluir }) {
  const f = useFormulario({ data_conclusao: hojeISO(), quilometragem: "", valor: "", oficina: "" });
  const { setValores, setErros, setErroGeral } = f;
  useEffect(() => {
    if (!ordem) return;
    setErros({});
    setErroGeral("");
    setValores({ data_conclusao: hojeISO(), quilometragem: "", valor: "", oficina: ordem.oficina || "" });
  }, [ordem, setValores, setErros, setErroGeral]);

  const aoEnviar = f.enviar(async (v) => {
    // Campo vazio não é enviado: a API responde "Este campo é obrigatório." (CA10)
    const corpo = { oficina: v.oficina || null };
    if (v.data_conclusao) corpo.data_conclusao = v.data_conclusao;
    if (v.quilometragem !== "") corpo.quilometragem = Number(String(v.quilometragem).replace(/\D/g, ""));
    if (v.valor !== "") corpo.valor = String(v.valor).replace(/\./g, "").replace(",", ".");
    const concluida = await post(`/ordens-servico/${ordem.numero}/concluir`, corpo);
    aoConcluir(concluida);
  });

  return (
    <Modal aberto={Boolean(ordem)} aoFechar={aoFechar} aoEnviar={aoEnviar} largura={620}
      migalha={<><Wrench size={13} /> Ordem de serviço nº {ordem?.numero}</>}
      titulo="Concluir manutenção"
      subtitulo={ordem && `${ordem.descricao} · ${veiculo ? nomeVeiculo(veiculo) : ordem.placa_veiculo}`}
      rodape={
        <>
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" icone={Check} carregando={f.enviando}>Concluir manutenção</Botao>
        </>
      }>
      <Aviso tipo="erro">{f.erroGeral}</Aviso>
      <div className="grade grade--2">
        <Campo rotulo="Data da realização" obrigatorio type="date" icone={Calendar} value={f.valores.data_conclusao}
          onChange={f.mudar("data_conclusao")} erro={f.erros.data_conclusao} />
        <Campo rotulo="Quilometragem (odômetro)" obrigatorio inputMode="numeric" icone={Gauge} sufixo="km"
          value={f.valores.quilometragem} onChange={f.mudar("quilometragem")} erro={f.erros.quilometragem}
          ajuda={veiculo && `Última leitura: ${km(veiculo.km_atual)}`} />
        <Campo rotulo="Valor do serviço (R$)" obrigatorio inputMode="decimal" icone={CircleDollarSign} placeholder="0,00"
          value={f.valores.valor} onChange={f.mudar("valor")} erro={f.erros.valor} />
        <Campo rotulo="Oficina" icone={Store} value={f.valores.oficina} onChange={f.mudar("oficina")} erro={f.erros.oficina} />
      </div>
    </Modal>
  );
}
