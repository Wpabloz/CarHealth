import { NavLink, Outlet } from "react-router-dom";
import { Truck, UserRound } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import Marca from "../components/Marca";

/** Área do motorista: pensada para o celular, com navegação na parte de baixo (RNF04). */
export default function LayoutMotorista() {
  const { usuario } = useAuth();
  return (
    <div className="app-motorista">
      <header className="m-topo">
        <Marca compacta />
        <span className="m-topo__conta">
          <span className="avatar avatar--p" aria-hidden="true">{usuario?.nome?.[0]?.toUpperCase() || "?"}</span>
          <span className="m-topo__nome">{usuario?.nome}</span>
        </span>
      </header>
      <main className="m-principal">
        <Outlet />
      </main>
      <nav className="m-inferior" aria-label="Menu do motorista">
        <NavLink to="/m/veiculos" className="m-inferior__item"><Truck size={20} aria-hidden="true" />Veículos</NavLink>
        <NavLink to="/m/perfil" className="m-inferior__item"><UserRound size={20} aria-hidden="true" />Perfil</NavLink>
      </nav>
    </div>
  );
}
