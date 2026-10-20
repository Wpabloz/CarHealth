import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search, Truck } from "lucide-react";

import { get, query } from "../../api/client";
import Placa from "../../components/Placa";
import { Cabecalho, Conteudo, IconeQuadrado, Vazio } from "../../components/ui";
import { km, marcaModelo, nomeVeiculo } from "../../lib/formato";
import { useCarregar } from "../../lib/useCarregar";

/** O motorista escolhe pela placa o veículo que está conduzindo; só aparecem os ativos (RF34). */
export default function MVeiculos() {
  const [placa, setPlaca] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const espera = setTimeout(() => setBusca(placa.trim()), 300);
    return () => clearTimeout(espera);
  }, [placa]);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/veiculos${query({ placa: busca })}`), [busca]);

  return (
    <>
      <Cabecalho titulo="Veículos" subtitulo="Escolha o veículo que você está conduzindo" />
      <div className="campo campo--grande">
        <label htmlFor="m-busca" className="campo__rotulo">Placa</label>
        <div className="campo__caixa campo__caixa--icone">
          <Search className="campo__icone" size={18} aria-hidden="true" />
          <input id="m-busca" className="campo__entrada" type="search" placeholder="Digite a placa"
            autoCapitalize="characters" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
        </div>
      </div>
      <Conteudo carregando={carregando && !dados} erro={erro} tentar={recarregar}>
        {dados?.length === 0 ? (
          <Vazio titulo={busca ? "Nenhum veículo ativo tem essa placa." : "Nenhum veículo ativo na empresa."}>
            {busca && "Confira a placa digitada."}
          </Vazio>
        ) : (
          <ul className="cartoes">
            {dados?.map((v) => (
              <li key={v.placa}>
                <Link to={`/m/veiculos/${v.placa}`} className="m-veiculo">
                  <IconeQuadrado icone={Truck} tom="info" />
                  <span className="m-veiculo__textos">
                    <strong>{nomeVeiculo(v)}</strong>
                    <span>{marcaModelo(v)} · {km(v.km_atual)}</span>
                    <Placa placa={v.placa} />
                  </span>
                  <ChevronRight size={20} className="texto--suave" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Conteudo>
    </>
  );
}
