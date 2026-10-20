import { useEffect } from "react";
import { Check, Gauge } from "lucide-react";

import { post } from "../../api/client";
import Modal from "../../components/Modal";
import { Aviso, Botao, Campo } from "../../components/ui";
import { km, nomeVeiculo } from "../../lib/formato";
import { useFormulario } from "../../lib/useFormulario";

/** Registrar quilometragem (gestor). Só o gestor pode marcar ajuste de odômetro (RN03, CA03). */
export default function LeituraModal({ aberto, veiculo, aoFechar, aoSalvar }) {
  const f = useFormulario({ quilometragem: "", ajuste: false });
  const { setValores, setErros, setErroGeral } = f;
  useEffect(() => {
    if (!aberto) return;
    setValores({ quilometragem: "", ajuste: false });
    setErros({});
    setErroGeral("");
  }, [aberto, setValores, setErros, setErroGeral]);

  const aoEnviar = f.enviar(async (v) => {
    await post("/leituras-odometro", {
      placa_veiculo: veiculo.placa,
      quilometragem: v.quilometragem === "" ? undefined : Number(String(v.quilometragem).replace(/\D/g, "")),
      origem: v.ajuste ? "AJUSTE_ODOMETRO" : "MANUAL",
    });
    aoSalvar();
  });

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} aoEnviar={aoEnviar} largura={520}
      migalha={<><Gauge size={13} /> Odômetro</>} titulo="Registrar quilometragem"
      subtitulo={veiculo && `${nomeVeiculo(veiculo)} · última leitura: ${km(veiculo.km_atual)}. A data é a de hoje.`}
      rodape={
        <>
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" icone={Check} carregando={f.enviando}>Registrar</Botao>
        </>
      }>
      <Aviso tipo="erro">{f.erroGeral}</Aviso>
      <Campo rotulo="Quilometragem lida no painel" obrigatorio inputMode="numeric" icone={Gauge} sufixo="km"
        value={f.valores.quilometragem} onChange={f.mudar("quilometragem")} erro={f.erros.quilometragem} />
      <label className="marcador">
        <input type="checkbox" checked={f.valores.ajuste} onChange={f.mudar("ajuste")} />
        <span>
          <strong>Ajuste de odômetro.</strong> O equipamento foi trocado ou zerado: aceita valor menor que a última leitura.
        </span>
      </label>
    </Modal>
  );
}
