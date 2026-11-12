/**
 * Rotas do CarHealth. Login único; área do gestor com o menu do protótipo
 * (Painel, Veículos, Manutenções, Lembretes, Histórico) e área do motorista (/m/...).
 */
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { ExigePerfil, SoDeslogado, inicioDoPerfil, useAuth } from "./auth/AuthContext";
import { Carregando } from "./components/ui";
import LayoutGestor from "./layouts/LayoutGestor";
import LayoutMotorista from "./layouts/LayoutMotorista";
import CriarConta from "./pages/CriarConta";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import Historico, { HistoricoInicio } from "./pages/gestor/Historico";
import Lembretes from "./pages/gestor/Lembretes";
import Manutencoes from "./pages/gestor/Manutencoes";
import MotoristaForm from "./pages/gestor/MotoristaForm";
import Motoristas from "./pages/gestor/Motoristas";
import OrdemDetalhe from "./pages/gestor/OrdemDetalhe";
import Painel from "./pages/gestor/Painel";
import PlanoForm from "./pages/gestor/PlanoForm";
import Planos from "./pages/gestor/Planos";
import RegistrarManutencao from "./pages/gestor/RegistrarManutencao";
import Veiculos from "./pages/gestor/Veiculos";
import CheckinConfirmar from "./pages/motorista/CheckinConfirmar";
import CheckinDados from "./pages/motorista/CheckinDados";
import CheckinEscanear from "./pages/motorista/CheckinEscanear";
import CheckinFeito from "./pages/motorista/CheckinFeito";
import CheckinPlaca from "./pages/motorista/CheckinPlaca";
import MAvisarProblema from "./pages/motorista/MAvisarProblema";
import MAvisoEnviado from "./pages/motorista/MAvisoEnviado";
import MAvisos from "./pages/motorista/MAvisos";
import MHistorico from "./pages/motorista/MHistorico";
import MInformarKm from "./pages/motorista/MInformarKm";
import MInicio from "./pages/motorista/MInicio";

function Inicio() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <Carregando />;
  return <Navigate to={usuario ? inicioDoPerfil(usuario) : "/login"} replace />;
}

/** Endereço antigo da ficha do veículo: vai para o histórico dele. */
function ParaHistorico() {
  const { placa } = useParams();
  return <Navigate to={`/historico/${placa}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<SoDeslogado><Login /></SoDeslogado>} />
      <Route path="/criar-conta" element={<SoDeslogado><CriarConta /></SoDeslogado>} />

      {/* Área do gestor: acesso completo */}
      <Route element={<ExigePerfil perfil="GESTOR"><LayoutGestor /></ExigePerfil>}>
        <Route path="/painel" element={<Painel />} />
        <Route path="/veiculos" element={<Veiculos />} />
        <Route path="/veiculos/:placa/*" element={<ParaHistorico />} />
        <Route path="/manutencoes" element={<Manutencoes />} />
        <Route path="/manutencoes/nova" element={<RegistrarManutencao />} />
        <Route path="/lembretes" element={<Lembretes />} />
        <Route path="/historico" element={<HistoricoInicio />} />
        <Route path="/historico/:placa" element={<Historico />} />
        <Route path="/ordens/:numero" element={<OrdemDetalhe />} />
        <Route path="/motoristas" element={<Motoristas />} />
        <Route path="/motoristas/novo" element={<MotoristaForm />} />
        <Route path="/motoristas/:cpf" element={<MotoristaForm />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/planos/novo" element={<PlanoForm />} />
        <Route path="/planos/:id" element={<PlanoForm />} />
        <Route path="/perfil" element={<Perfil />} />
      </Route>

      {/* Área do motorista (celular), igual ao protótipo: primeiro o check-in do dia por QR code */}
      <Route element={<ExigePerfil perfil="MOTORISTA"><LayoutMotorista /></ExigePerfil>}>
        <Route path="/m/checkin" element={<CheckinEscanear />} />
        <Route path="/m/checkin/placa" element={<CheckinPlaca />} />
        <Route path="/m/checkin/feito" element={<CheckinFeito />} />
        <Route path="/m/checkin/:placa" element={<CheckinConfirmar />} />
        <Route path="/m/checkin/:placa/dados" element={<CheckinDados />} />
        <Route path="/m" element={<MInicio />} />
        <Route path="/m/avisos" element={<MAvisos />} />
        <Route path="/m/historico" element={<MHistorico />} />
        <Route path="/m/km" element={<MInformarKm />} />
        <Route path="/m/problema" element={<MAvisarProblema />} />
        <Route path="/m/problema/enviado" element={<MAvisoEnviado />} />
        <Route path="/m/*" element={<Navigate to="/m" replace />} />
      </Route>

      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}
