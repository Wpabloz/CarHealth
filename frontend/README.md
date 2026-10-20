# CarHealth — Frontend (React)

Interface web do CarHealth. Fica na pasta `frontend/` do repositório, **separada do backend** (o Django está na raiz): este app só mostra as telas e conversa com a API REST, enviando e recebendo JSON.

**Tecnologias:** React 19 · React Router 7 · Vite · ícones lucide-react · CSS puro (sem biblioteca de componentes)

**Visual:** segue o protótipo do Figma (Painel, Veículos, Manutenções, Lembretes, Histórico e Registrar Manutenção), com as cores medidas nas telas do protótipo.

---

## 1. Como rodar

Pré-requisitos: **Node.js 20+** e o backend rodando (`python manage.py runserver` na raiz do repositório). Depois, dentro da pasta `frontend/`:

```powershell
npm install
npm run dev
```
Abra **http://localhost:5173**. Em desenvolvimento, o Vite repassa toda chamada `/api/...` para `http://127.0.0.1:8000`, então não há problema de CORS.

- Backend em outro endereço: `$env:API_PROXY="http://127.0.0.1:8001"; npm run dev`
- Versão de produção: `npm run build` gera a pasta `dist/`. Informe a URL da API em `VITE_API_URL` (veja `.env.example`).

## 2. Como funciona

```
Tela (pages/)  ──►  api/client.js  ──►  /api/...  ──►  Django
                    • coloca o token JWT em toda chamada
                    • renova o token vencido sozinho (refresh)
                    • transforma o erro do Django em mensagem por campo
```

- **Login único** (`/login`): o perfil vem da própria conta. O gestor vai para o **Painel** e o motorista para a **lista de veículos** (RF04).
- **Rotas protegidas por perfil:** o motorista que digitar uma rota do gestor é levado de volta à área dele. As permissões valem também no servidor (RNF08).
- **Situação sempre com texto:** vencida, próxima e em dia aparecem com rótulo, não só com cor (RNF03).
- **Mensagens de confirmação** aparecem na própria tela: "Quilometragem registrada", "Ordem de serviço aberta", "Ordem concluída. Próxima manutenção recalculada".

### Estrutura de pastas

```
src/
├── main.jsx                 # ponto de entrada
├── App.jsx                  # todas as rotas
├── api/client.js            # chamadas à API, token JWT e tratamento de erros
├── auth/AuthContext.jsx     # login, criar conta, sair, proteção das rotas por perfil
├── components/              # botões, campos, selos, avisos, cartões, marca
├── layouts/                 # LayoutGestor (menu lateral) e LayoutMotorista (celular)
├── lib/                     # formatação (km, datas, R$, CPF), useCarregar, useFormulario
├── pages/
│   ├── Login, CriarConta, Perfil        # comuns aos dois perfis
│   ├── gestor/                          # 16 telas do gestor
│   └── motorista/                       # 4 telas do motorista
└── styles/global.css        # cores e fontes ficam em variáveis no topo do arquivo
```

## 3. Telas

**Do protótipo do Figma** (menu do gestor):

| Tela do protótipo | Rota | Arquivo |
|---|---|---|
| Painel | `/painel` | `pages/gestor/Painel.jsx` |
| Veículos Cadastrados + Cadastrar Novo Veículo (janela) | `/veiculos` | `pages/gestor/Veiculos.jsx`, `VeiculoModal.jsx` |
| Controle de Manutenções | `/manutencoes` | `pages/gestor/Manutencoes.jsx` (+ `ConcluirModal.jsx`) |
| Registrar Manutenção | `/manutencoes/nova` | `pages/gestor/RegistrarManutencao.jsx` |
| Lembretes de Manutenção + Notificações (sino) | `/lembretes` | `pages/gestor/Lembretes.jsx`, `components/Notificacoes.jsx` |
| Histórico de Manutenções | `/historico/:placa` | `pages/gestor/Historico.jsx` (+ `LeituraModal.jsx`) |

**Que não estão no protótipo** (necessárias pelas regras da Sprint 3), no mesmo visual:

| Tela | Rota | Arquivo |
|---|---|---|
| Login / Criar conta | `/login` · `/criar-conta` | `pages/Login.jsx`, `pages/CriarConta.jsx` |
| Perfil | `/perfil` · `/m/perfil` | `pages/Perfil.jsx` |
| Detalhe da ordem de serviço | `/ordens/:numero` | `pages/gestor/OrdemDetalhe.jsx` |
| Motoristas (lista e cadastro com acesso) | `/motoristas` · `/motoristas/:cpf` | `pages/gestor/Motoristas.jsx`, `MotoristaForm.jsx` |
| Planos de manutenção | `/planos` · `/planos/:id` | `pages/gestor/Planos.jsx`, `PlanoForm.jsx` |
| Área do motorista (celular) | `/m/veiculos/...` | `pages/motorista/*` |

**Onde o frontend segue as regras, e não o desenho:**
- *Registrar Manutenção*: "Serviço já realizado" pede também **valor** e **oficina**, porque a conclusão exige data, km e valor (RN11). "Programar próxima revisão" mostra a próxima data e a km **calculadas pelo plano** (RN06), em vez de digitadas.
- O registro e as leituras de odômetro do gestor (com ajuste de odômetro) ficam no **Histórico**, botão "Registrar km".
- Os cartões de dica mostram só informação verdadeira do sistema (RNF13: nada de dado fictício no código).

## 4. Mudar o visual

As cores, fontes, raios e sombras ficam nas variáveis do topo de `src/styles/global.css`:

| Variável | Cor | Uso no protótipo |
|---|---|---|
| `--marinho` | `#1B365D` | menu ativo, títulos, números |
| `--laranja` | `#FD761A` | botões de ação ("Nova manutenção", "Registrar manutenção") |
| `--perigo` / `--perigo-claro` | `#BA1A1A` / `#FFDAD6` | atrasada |
| `--laranja-texto` / `--laranja-claro` | `#9D4300` / `#FFDBCA` | próxima do vencimento |
| `--azul-claro` | `#C9E4FA` | pendente |
| `--fundo` / `--superficie-baixa` / `--superficie-media` | `#F8F9FF` / `#EFF4FF` / `#E5EEFF` | fundo, campos e seções, chips e placas |

Fontes: **Manrope** nos títulos e **Inter** no texto (Google Fonts, carregadas no `index.html`). As classes seguem o nome do componente (`.cartao`, `.selo--perigo`, `.botao--primario`).
