import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QrScanner from "qr-scanner";
import { Flashlight, Info, Keyboard } from "lucide-react";

import { BarraInferior, BotaoLinkMo, Conteudo, TopoMarca } from "../../components/motorista/ui";
import { placaDoCodigo } from "../../lib/motorista";

const MENSAGENS = {
  abrindo: "Abrindo a câmera…",
  negado: "Para ler o QR code, permita o uso da câmera no navegador. Ou use “Digitar a placa”.",
  "sem-camera": "Não encontramos uma câmera neste aparelho. Use “Digitar a placa”.",
  inseguro: "A câmera só abre em conexão segura (https) ou no próprio computador. Use “Digitar a placa”.",
};

/** 00a — Check-in do dia: o motorista aponta a câmera para o QR code colado no painel. */
export default function CheckinEscanear() {
  const navegar = useNavigate();
  const video = useRef(null);
  const leitor = useRef(null);
  const [estado, setEstado] = useState(window.isSecureContext ? "abrindo" : "inseguro");
  const [codigoInvalido, setCodigoInvalido] = useState(false);
  const [lanterna, setLanterna] = useState({ tem: false, ligada: false });

  useEffect(() => {
    if (!window.isSecureContext || !video.current) return undefined;
    let ativo = true;
    let aviso;
    const scanner = new QrScanner(video.current, (resultado) => {
      const placa = placaDoCodigo(resultado.data);
      if (!placa) {
        setCodigoInvalido(true);
        clearTimeout(aviso);
        aviso = setTimeout(() => setCodigoInvalido(false), 2500);
        return;
      }
      scanner.stop();
      navegar(`/m/checkin/${placa}`);
    }, { returnDetailedScanResult: true, preferredCamera: "environment", maxScansPerSecond: 8 });
    leitor.current = scanner;
    scanner.start()
      .then(async () => {
        if (!ativo) return;
        setEstado("lendo");
        setLanterna({ tem: await scanner.hasFlash().catch(() => false), ligada: false });
      })
      .catch((erro) => {
        if (!ativo) return;
        const texto = String(erro?.name || erro);
        setEstado(/NotAllowed|ermission|denied/i.test(texto) ? "negado" : "sem-camera");
      });
    return () => {
      ativo = false;
      clearTimeout(aviso);
      scanner.destroy();
      leitor.current = null;
    };
  }, [navegar]);

  const alternarLanterna = async () => {
    const scanner = leitor.current;
    if (!scanner) return;
    await scanner.toggleFlash().catch(() => {});
    setLanterna({ tem: true, ligada: scanner.isFlashOn() });
  };

  return (
    <>
      <TopoMarca />
      <Conteudo gap={20}>
        <div className="mo-grupo">
          <p className="mo-sobretitulo">Check-in do dia</p>
          <h1 className="mo-titulo mo-titulo--26">Escaneie o QR code do seu caminhão</h1>
          <p className="mo-texto mo-texto--16">O código fica colado no painel, do lado do volante.</p>
        </div>

        <div className="mo-camera">
          <video ref={video} muted playsInline aria-label="Imagem da câmera" />
          {estado === "lendo" ? (
            <>
              <svg className="mo-camera__moldura" viewBox="0 0 236 236" fill="none" stroke="#fd761a" strokeWidth="5"
                strokeLinecap="round" aria-hidden="true">
                <path d="M3 48V19a16 16 0 0 1 16-16h29" /><path d="M188 3h29a16 16 0 0 1 16 16v29" />
                <path d="M233 188v29a16 16 0 0 1-16 16h-29" /><path d="M48 233H19a16 16 0 0 1-16-16v-29" />
              </svg>
              <span className="mo-camera__linha" aria-hidden="true" />
            </>
          ) : (
            <p className="mo-camera__mensagem" role="status">{MENSAGENS[estado]}</p>
          )}
          {codigoInvalido && <p className="mo-camera__alerta" role="alert">Esse QR code não é de um caminhão do CarHealth.</p>}
          {lanterna.tem && (
            <button type="button" className={`mo-camera__lanterna${lanterna.ligada ? " mo-camera__lanterna--ligada" : ""}`}
              aria-pressed={lanterna.ligada} onClick={alternarLanterna}>
              <Flashlight size={18} strokeWidth={2} aria-hidden="true" />
              {lanterna.ligada ? "Desligar lanterna" : "Ligar lanterna"}
            </button>
          )}
        </div>

        <div className="mo-info">
          <Info size={22} strokeWidth={2} aria-hidden="true" />
          <p>Faça o check-in uma vez por dia, antes de sair. Até lá, as outras funções ficam bloqueadas.</p>
        </div>
      </Conteudo>
      <BarraInferior>
        <BotaoLinkMo variante="contorno" icone={Keyboard} to="/m/checkin/placa">Digitar a placa</BotaoLinkMo>
      </BarraInferior>
    </>
  );
}
