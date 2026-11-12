import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Info, Printer, QrCode } from "lucide-react";

import Modal from "../../components/Modal";
import { Aviso, Botao } from "../../components/ui";
import { marcaModelo, nomeVeiculo, placaFormatada } from "../../lib/formato";

/**
 * Conteúdo do QR code da etiqueta: o endereço do check-in deste caminhão no CarHealth.
 * Lido pela câmera do app, leva direto à confirmação do veículo (tela 00b).
 */
export const conteudoDoQr = (placa) => `${window.location.origin}/m/checkin/${placa}`;

const CORES = { dark: "#0b1c30", light: "#ffffff" };
const escapar = (texto) => String(texto ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** "QR code do Guincho 02" (protótipo do gestor): a etiqueta para colar no painel do caminhão. */
export default function QrCodeModal({ veiculo, aoFechar }) {
  const [svg, setSvg] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!veiculo) return;
    setSvg("");
    QRCode.toString(conteudoDoQr(veiculo.placa), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: CORES })
      .then(setSvg)
      .catch(() => setErro("Não foi possível gerar o QR code."));
  }, [veiculo]);

  if (!veiculo) return null;
  const nome = nomeVeiculo(veiculo);
  const placa = placaFormatada(veiculo.placa);
  const modelo = marcaModelo(veiculo);
  const imagem = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";

  /** PNG da etiqueta: QR code, placa e nome, pronto para mandar para a gráfica ou imprimir depois. */
  const baixar = async () => {
    const largura = 900;
    const etiqueta = document.createElement("canvas");
    etiqueta.width = largura;
    etiqueta.height = 1130;
    const ctx = etiqueta.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, etiqueta.width, etiqueta.height);
    const qr = document.createElement("canvas");
    await QRCode.toCanvas(qr, conteudoDoQr(veiculo.placa), { width: 760, margin: 0, errorCorrectionLevel: "M", color: CORES });
    ctx.drawImage(qr, 70, 70);
    ctx.textAlign = "center";
    ctx.fillStyle = "#002046";
    ctx.font = "800 92px Manrope, Inter, sans-serif";
    ctx.fillText(placa, largura / 2, 945);
    ctx.fillStyle = "#44474e";
    ctx.font = "600 40px Inter, sans-serif";
    ctx.fillText(`${nome} · ${modelo}`, largura / 2, 1010);
    ctx.font = "400 30px Inter, sans-serif";
    ctx.fillText("Escaneie no app CarHealth para fazer o check-in do dia", largura / 2, 1070);
    const link = document.createElement("a");
    link.href = etiqueta.toDataURL("image/png");
    link.download = `qrcode-${veiculo.placa}.png`;
    link.click();
  };

  /** Abre a etiqueta (8 cm) numa janela própria e chama a impressão. */
  const imprimir = () => {
    const janela = window.open("", "_blank", "width=520,height=720");
    if (!janela) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up deste site e tente de novo.");
      return;
    }
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Etiqueta ${escapar(placa)}</title>
<style>
  @page { margin: 12mm; }
  body { margin: 0; font-family: Inter, Arial, sans-serif; display: flex; justify-content: center; }
  .etiqueta { width: 8cm; padding: 6mm; border: 1px dashed #c4c6cf; border-radius: 12px; text-align: center; }
  img { display: block; width: 100%; height: auto; }
  .placa { margin: 4mm 0 1mm; font: 800 26pt Manrope, Arial, sans-serif; letter-spacing: 1px; color: #002046; }
  .modelo { font-size: 11pt; color: #44474e; }
  .dica { margin-top: 2mm; font-size: 9pt; color: #5b6170; }
</style></head><body>
<div class="etiqueta">
  <img src="${imagem}" alt="QR code do ${escapar(nome)}">
  <div class="placa">${escapar(placa)}</div>
  <div class="modelo">${escapar(nome)} · ${escapar(modelo)}</div>
  <div class="dica">Escaneie no app CarHealth para fazer o check-in do dia</div>
</div>
<script>window.onload = function () { window.focus(); window.print(); };<\/script>
</body></html>`);
    janela.document.close();
  };

  return (
    <Modal aberto aoFechar={aoFechar} largura={672}
      migalha={<><QrCode size={13} /> Etiqueta do veículo</>}
      titulo={`QR code do ${nome}`}
      subtitulo="Imprima e cole no painel do caminhão, do lado do volante."
      rodape={(
        <>
          <Botao variante="contorno" onClick={aoFechar}>Fechar</Botao>
          <Botao variante="contorno" icone={Download} onClick={baixar} disabled={!svg}>Baixar imagem</Botao>
          <Botao icone={Printer} onClick={imprimir} disabled={!svg}>Imprimir etiqueta</Botao>
        </>
      )}>
      <Aviso tipo="erro">{erro}</Aviso>
      <div className="qr-etiqueta">
        <div className="qr-etiqueta__cartao">
          {imagem ? <img src={imagem} alt={`QR code do check-in do ${nome}`} /> : <span style={{ width: 196, height: 196 }} />}
          <span className="qr-etiqueta__placa">{placa}</span>
          <span className="qr-etiqueta__modelo">{nome} · {modelo}</span>
        </div>
        <div className="qr-etiqueta__uso">
          <h3 className="qr-etiqueta__titulo">Como usar</h3>
          <ol className="qr-etiqueta__passos">
            <li>Imprima a etiqueta, de preferência em papel adesivo.</li>
            <li>Cole no painel, num lugar que o motorista alcance com o celular.</li>
            <li>No começo do dia, o motorista escaneia o código para fazer o check-in.</li>
          </ol>
          <p className="qr-etiqueta__aviso">
            <Info size={18} aria-hidden="true" />
            O código guarda só a placa. Sem entrar no CarHealth com a própria conta, ninguém consegue usá-lo.
          </p>
        </div>
      </div>
    </Modal>
  );
}
