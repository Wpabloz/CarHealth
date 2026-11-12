import { useParams } from "react-router-dom";
import { Check, Keyboard, QrCode, RotateCcw, Truck } from "lucide-react";

import { get } from "../../api/client";
import { useMotorista } from "../../layouts/motoristaContexto";
import {
  BarraInferior, BotaoLinkMo, CarregandoMo, Conteudo, IconeBloco, PlacaMo, TopoVoltar,
} from "../../components/motorista/ui";
import { km, marcaModelo, nomeVeiculo, placaFormatada } from "../../lib/formato";
import { piorPendencia, tituloDoAlerta, tomDoAviso } from "../../lib/motorista";
import { useCarregar } from "../../lib/useCarregar";

function SeloManutencao({ planos }) {
  const pior = piorPendencia(planos);
  if (pior) {
    const tom = tomDoAviso(pior) === "vermelho" ? "vermelho" : "marrom";
    return <span className={`mo-selo mo-selo--${tom}`}>{tituloDoAlerta(pior)}</span>;
  }
  if (planos.some((p) => p.situacao === "EM_DIA")) return <span className="mo-selo mo-selo--verde">Em dia</span>;
  return <span className="mo-selo mo-selo--neutro">Sem manutenção prevista</span>;
}

/** 00b — "Este é o seu caminhão?": confirma a placa lida no QR code antes do check-in. */
export default function CheckinConfirmar() {
  const { placa } = useParams();
  const { checkin } = useMotorista();
  const veiculo = useCarregar(() => get(`/veiculos/${placa}/situacao`), [placa]);
  const v = veiculo.dados;

  if (veiculo.carregando && !v) return <><TopoVoltar para="/m/checkin" /><CarregandoMo /></>;

  if (!v) {
    const naoAchou = veiculo.erro?.status === 404;
    return (
      <>
        <TopoVoltar para="/m/checkin" />
        <Conteudo gap={24}>
          <IconeBloco icone={QrCode} tamanho={64} raio={18} iconeTamanho={34} tom="vermelho" />
          <div className="mo-grupo">
            <h1 className="mo-titulo mo-titulo--26">
              {naoAchou ? "Não encontramos esse caminhão" : "Não foi possível abrir o caminhão"}
            </h1>
            <p className="mo-texto mo-texto--16">
              {naoAchou
                ? `A placa ${placaFormatada(placa)} não é de um caminhão ativo da sua empresa. Confira a etiqueta ou avise o responsável pela frota.`
                : veiculo.erro?.message}
            </p>
          </div>
        </Conteudo>
        <BarraInferior>
          <BotaoLinkMo icone={RotateCcw} to="/m/checkin">Escanear de novo</BotaoLinkMo>
          <BotaoLinkMo variante="contorno" icone={Keyboard} to="/m/checkin/placa">Digitar a placa</BotaoLinkMo>
        </BarraInferior>
      </>
    );
  }

  // Leu de novo o caminhão em que já fez o check-in hoje: não há o que registrar, volta ao Início
  const jaFez = checkin?.placa_veiculo === v.placa;

  return (
    <>
      <TopoVoltar para="/m/checkin" />
      <Conteudo gap={24}>
        <IconeBloco icone={QrCode} tamanho={64} raio={18} iconeTamanho={34} />
        <div className="mo-grupo">
          <h1 className="mo-titulo mo-titulo--26">Este é o seu caminhão?</h1>
          <p className="mo-texto mo-texto--16">
            {jaFez
              ? "Você já fez o check-in deste caminhão hoje."
              : "Confira a placa antes de continuar. Se não for este, escaneie de novo."}
          </p>
        </div>
        <section className="mo-cartao" style={{ paddingBottom: 12, boxShadow: "0 2px 10px rgba(0, 32, 70, 0.05)" }}>
          <div className="mo-veiculo">
            <IconeBloco icone={Truck} tamanho={60} raio={16} iconeTamanho={30} strokeWidth={2.2} />
            <div className="mo-veiculo__textos mo-veiculo__textos--4">
              <span className="mo-nome-veiculo">{nomeVeiculo(v)}</span>
              <span className="mo-modelo">{marcaModelo(v)}</span>
              <PlacaMo placa={v.placa} clara />
            </div>
          </div>
          <div className="mo-resumo mo-resumo--interno">
            <div className="mo-resumo__linha"><span>Última quilometragem</span><strong>{km(v.km_atual)}</strong></div>
            <div className="mo-resumo__linha"><span>Manutenção</span><SeloManutencao planos={v.planos} /></div>
          </div>
        </section>
      </Conteudo>
      <BarraInferior>
        <BotaoLinkMo icone={Check} to={jaFez ? "/m" : `/m/checkin/${v.placa}/dados`}>Sim, é este</BotaoLinkMo>
        <BotaoLinkMo variante="contorno" icone={RotateCcw} to="/m/checkin">Escanear de novo</BotaoLinkMo>
      </BarraInferior>
    </>
  );
}
