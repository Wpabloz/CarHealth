/** Componentes de interface usados em todas as telas (seguem o protótipo do Figma). */
import { useId } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleCheck } from "lucide-react";

import { ROTULO_MANUTENCAO, SITUACAO_CADASTRO, STATUS_ORDEM, TOM_MANUTENCAO, prazo } from "../lib/formato";

const juntar = (...classes) => classes.filter(Boolean).join(" ");

export function Botao({ variante = "primario", tamanho, icone: Icone, carregando = false, children, className, ...props }) {
  return (
    <button type="button" className={juntar("botao", `botao--${variante}`, tamanho && `botao--${tamanho}`, className)}
      disabled={carregando || props.disabled} aria-busy={carregando || undefined} {...props}>
      {Icone && <Icone size={tamanho === "p" ? 14 : 17} aria-hidden="true" />}
      {children && <span>{carregando ? "Aguarde…" : children}</span>}
    </button>
  );
}

export function BotaoLink({ variante = "primario", tamanho, icone: Icone, children, className, ...props }) {
  return (
    <Link className={juntar("botao", `botao--${variante}`, tamanho && `botao--${tamanho}`, className)} {...props}>
      {Icone && <Icone size={tamanho === "p" ? 14 : 17} aria-hidden="true" />}
      {children && <span>{children}</span>}
    </Link>
  );
}

/** Campo com rótulo associado (RNF11), dica à direita, ícone, sufixo e a mensagem de erro da API. */
export function Campo({
  rotulo, obrigatorio, dica, icone: Icone, sufixo, ajuda, erro, como = "input", children, className, ...props
}) {
  const id = useId();
  const Elemento = como;
  const descricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined;
  return (
    <div className={juntar("campo", erro && "campo--erro", className)}>
      <div className="campo__topo">
        <label htmlFor={id} className="campo__rotulo">
          {rotulo}
          {obrigatorio && <span className="campo__obrigatorio" aria-hidden="true"> *</span>}
        </label>
        {dica && <span className="campo__dica">{dica}</span>}
      </div>
      <div className={juntar("campo__caixa", Icone && "campo__caixa--icone", como === "select" && "campo__caixa--select")}>
        {Icone && <Icone className="campo__icone" size={17} aria-hidden="true" />}
        <Elemento id={id} className="campo__entrada" aria-invalid={erro ? true : undefined}
          aria-describedby={descricao} aria-required={obrigatorio || undefined} {...props}>
          {children}
        </Elemento>
        {sufixo && <span className="campo__sufixo">{sufixo}</span>}
      </div>
      {erro ? (
        <span id={`${id}-erro`} className="campo__erro">{erro}</span>
      ) : (
        ajuda && <span id={`${id}-ajuda`} className="campo__ajuda">{ajuda}</span>
      )}
    </div>
  );
}

export function Aviso({ tipo = "info", titulo, icone: Icone, children, className }) {
  if (!children && !titulo) return null;
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={juntar("aviso", `aviso--${tipo}`, className)}>
      {Icone && <Icone size={18} className="aviso__icone" aria-hidden="true" />}
      <div>
        {titulo && <strong className="aviso__titulo">{titulo}</strong>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

/** Mensagem passada pela navegação: navigate(..., { state: { aviso: "Ordem de serviço aberta" } }). */
export function AvisoDaNavegacao() {
  const { state } = useLocation();
  return state?.aviso ? <Aviso tipo="sucesso" icone={CircleCheck}>{state.aviso}</Aviso> : null;
}

export function Selo({ tom = "neutro", solido = false, ponto = true, icone: Icone, children, className }) {
  return (
    <span className={juntar("selo", `selo--${tom}`, solido && "selo--solido", ponto && !Icone && "selo--ponto", className)}>
      {Icone && <Icone size={13} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Situação de uma manutenção prevista: "Atrasado há 3 dias", "Vence em 5 dias"... (RNF03: sempre com texto). */
export function SeloPrazo({ item, tolerancia, curto = false, ...props }) {
  const texto = prazo(item, tolerancia);
  return <Selo tom={TOM_MANUTENCAO[item.situacao]} {...props}>{curto ? texto.curto : texto.selo}</Selo>;
}

export function SeloManutencao({ situacao }) {
  return <Selo tom={TOM_MANUTENCAO[situacao] || "neutro"}>{ROTULO_MANUTENCAO[situacao] || situacao}</Selo>;
}

export function SeloStatus({ status }) {
  const s = STATUS_ORDEM[status] || { rotulo: status, tom: "neutro" };
  return <Selo tom={s.tom}>{s.rotulo}</Selo>;
}

export function SeloCadastro({ situacao }) {
  const s = SITUACAO_CADASTRO[situacao] || { rotulo: situacao, tom: "neutro" };
  return <Selo tom={s.tom}>{s.rotulo}</Selo>;
}

/** Quadrado colorido com ícone, usado nos cartões. */
export function IconeQuadrado({ icone: Icone, tom = "info", tamanho = "m" }) {
  return (
    <span className={juntar("icone-quadrado", `icone-quadrado--${tom}`, `icone-quadrado--${tamanho}`)} aria-hidden="true">
      <Icone size={tamanho === "g" ? 26 : tamanho === "p" ? 15 : 19} />
    </span>
  );
}

export function Cartao({ titulo, subtitulo, icone, acoes, children, className, ...props }) {
  return (
    <section className={juntar("cartao", className)} {...props}>
      {(titulo || acoes) && (
        <header className="cartao__topo">
          <div className="cartao__titulos">
            {icone}
            <div>
              {titulo && <h2 className="cartao__titulo">{titulo}</h2>}
              {subtitulo && <p className="cartao__subtitulo">{subtitulo}</p>}
            </div>
          </div>
          {acoes && <div className="cartao__acoes">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Cartão de indicador do painel: rótulo, número grande, ícone e uma nota. */
export function Indicador({ rotulo, valor, icone, tom = "info", nota, notaTom, selo, faixa = false }) {
  return (
    <div className={juntar("indicador", faixa && `indicador--faixa indicador--${tom}`)}>
      <div className="indicador__topo">
        <span className="indicador__rotulo">{rotulo}</span>
        <IconeQuadrado icone={icone} tom={tom} />
      </div>
      <div className="indicador__valor-linha">
        <span className={juntar("indicador__valor", `texto--${notaTom || "marinho"}`)}>{valor}</span>
        {selo}
      </div>
      {nota && <span className={juntar("indicador__nota", notaTom && `texto--${notaTom}`)}>{nota}</span>}
    </div>
  );
}

/** Cabeçalho da página: migalha (em laranja), título, subtítulo e ações à direita. */
export function Cabecalho({ migalha, titulo, subtitulo, acoes, voltar }) {
  const navegar = useNavigate();
  return (
    <header className="cabecalho">
      {voltar && (
        <button type="button" className="cabecalho__voltar" onClick={() => navegar(voltar)}>
          <ArrowLeft size={15} aria-hidden="true" /> Voltar
        </button>
      )}
      <div className="cabecalho__linha">
        <div>
          {migalha && <p className="migalha">{migalha}</p>}
          <h1 className="cabecalho__titulo">{titulo}</h1>
          {subtitulo && <p className="cabecalho__subtitulo">{subtitulo}</p>}
        </div>
        {acoes && <div className="cabecalho__acoes">{acoes}</div>}
      </div>
    </header>
  );
}

export function Vazio({ icone: Icone, titulo, children }) {
  return (
    <div className="vazio">
      {Icone && <Icone size={28} className="vazio__icone" aria-hidden="true" />}
      <p className="vazio__titulo">{titulo}</p>
      {children && <div className="vazio__texto">{children}</div>}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }) {
  return (
    <div className="carregando" role="status">
      <span className="carregando__roda" aria-hidden="true" />
      {texto}
    </div>
  );
}

/** Estado padrão de uma tela que busca dados: carregando, erro ou conteúdo. */
export function Conteudo({ carregando, erro, tentar, children }) {
  if (carregando) return <Carregando />;
  if (erro) {
    return (
      <Aviso tipo="erro">
        {erro.message}{" "}
        {tentar && <button type="button" className="link" onClick={tentar}>Tentar de novo</button>}
      </Aviso>
    );
  }
  return children;
}

export function Dado({ rotulo, children }) {
  return (
    <div className="dado">
      <dt className="dado__rotulo">{rotulo}</dt>
      <dd className="dado__valor">{children}</dd>
    </div>
  );
}
