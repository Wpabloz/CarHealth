import { useNavigate, useParams } from "react-router-dom";
import { Check, Gauge } from "lucide-react";

import { get, post } from "../../api/client";
import Placa from "../../components/Placa";
import { Aviso, Botao, Cabecalho, Campo, Conteudo } from "../../components/ui";
import { km, marcaModelo, nomeVeiculo } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";
import { useFormulario } from "../../lib/useFormulario";

/**
 * Registrar quilometragem (motorista): repete placa e modelo para evitar o veículo errado (RF35).
 * Só um campo; a data é a de hoje. Sem ajuste de odômetro: valor menor é recusado (CA18).
 */
export default function MRegistrarKm() {
  const { placa } = useParams();
  const navegar = useNavigate();
  const veiculo = useCarregar(() => get(`/veiculos/${placa}`), [placa]);
  const f = useFormulario({ quilometragem: "" });

  const aoEnviar = f.enviar(async (v) => {
    await post("/leituras-odometro", { placa_veiculo: placa, quilometragem: Number(v.quilometragem) });
    navegar(`/m/veiculos/${placa}`, { replace: true, state: { aviso: "Quilometragem registrada." } });
  });

  const v = veiculo.dados;
  return (
    <>
      <Cabecalho voltar={`/m/veiculos/${placa}`} titulo="Registrar quilometragem" />
      <Conteudo carregando={veiculo.carregando} erro={veiculo.erro}>
        {v && (
          <form onSubmit={aoEnviar} className="pilha" noValidate>
            <div className="confira">
              <span className="confira__rotulo">Confira o veículo</span>
              <span className="confira__nome">{nomeVeiculo(v)}</span>
              <Placa placa={v.placa} />
              <span className="confira__modelo">{marcaModelo(v)}</span>
              <span className="confira__km">Última leitura: {km(v.km_atual)}</span>
            </div>
            <Aviso tipo="erro">{f.erroGeral}</Aviso>
            <Campo rotulo="Quilometragem no painel" type="number" inputMode="numeric" min="0" autoFocus
              className="campo--grande" icone={Gauge} sufixo="km" value={f.valores.quilometragem}
              onChange={f.mudar("quilometragem")} erro={f.erros.quilometragem} />
            <Botao type="submit" icone={Check} carregando={f.enviando} className="botao--largo botao--grande">
              Confirmar
            </Botao>
          </form>
        )}
      </Conteudo>
    </>
  );
}
