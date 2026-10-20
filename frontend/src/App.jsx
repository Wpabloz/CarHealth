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
import MHistorico from "./pages/motorista/MHistorico";
import MRegistrarKm from "./pages/motorista/MRegistrarKm";
import MVeiculo from "./pages/motorista/MVeiculo";
import MVeiculos from "./pages/motorista/MVeiculos";

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

      {/* Área do motorista: veículos ativos, registrar quilometragem e consultar */}
      <Route element={<ExigePerfil perfil="MOTORISTA"><LayoutMotorista /></ExigePerfil>}>
        <Route path="/m/veiculos" element={<MVeiculos />} />
        <Route path="/m/veiculos/:placa" element={<MVeiculo />} />
        <Route path="/m/veiculos/:placa/registrar" element={<MRegistrarKm />} />
        <Route path="/m/veiculos/:placa/historico" element={<MHistorico />} />
        <Route path="/m/perfil" element={<Perfil />} />
      </Route>

      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}
