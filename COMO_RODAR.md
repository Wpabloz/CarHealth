# Como rodar o CarHealth no notebook (Windows)

Versão para demonstração: usa **SQLite** (um arquivo `db.sqlite3` na pasta do projeto), então **não precisa instalar o PostgreSQL**. O sistema já sobe com uma frota de exemplo.

## 1. Instalar (uma vez só)

1. **Python 3.13** — <https://www.python.org/downloads/> (role até a 3.13). Na instalação, marque **"Add Python to PATH"**.
2. **Node.js LTS** — <https://nodejs.org/> (botão "LTS").

Depois de instalar, feche e abra de novo qualquer janela de terminal.

## 2. Rodar

1. Dê dois cliques em **`iniciar_backend.bat`**. Na primeira vez ele baixa as bibliotecas (1 a 3 minutos). Espere aparecer `API rodando em http://127.0.0.1:8000`. **Não feche essa janela.**
2. Dê dois cliques em **`iniciar_frontend.bat`**. Na primeira vez roda o `npm install`. O navegador abre sozinho em <http://localhost:5173>. **Não feche essa janela também.**

Para parar: feche as duas janelas. Para rodar de novo outro dia: os mesmos dois cliques (vai ser bem mais rápido).

**Já rodava a versão anterior?** Pode extrair esta por cima ou numa pasta nova e usar os mesmos dois cliques. O `iniciar_backend.bat` cria as tabelas novas e refaz os dados de demonstração sozinho, e o `iniciar_frontend.bat` instala as bibliotecas novas (leitura de QR code e fontes).

## 3. Logins da demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Gestor | `silvana@reboquessilva.com.br` | `carhealth2026` |
| Motorista | `marcos@reboquessilva.com.br` | `carhealth2026` |

Empresa: **Reboques Silva Ltda**, com 3 guinchos ativos e 1 inativo:

- **Guincho 01** — tudo em dia
- **Guincho 02** (placa **RSV-2B47**, a mesma das telas do Figma) — troca de óleo **atrasada** (passou 715 km), alinhamento dos pneus próximo, uma OS aberta na oficina e o aviso "Barulho ao frear" do Marcos, que o gestor está vendo
- **Guincho 03** — revisão do guincho vence em **20 dias**
- **Guincho 04** — inativo (some do painel, mas mantém o histórico)

As datas são calculadas a partir do dia em que os dados foram criados, então o painel sempre mostra essa mistura.

## 4. Roteiro sugerido para a apresentação

**Gestor** (janela normal do navegador):

1. **Painel**: os cartões (1 atrasada, 2 próximas) e os lembretes em ordem de urgência.
2. **Veículos → ícone de QR code** do Guincho 02: a etiqueta do check-in. "Imprimir etiqueta" abre a impressão; "Baixar imagem" salva o PNG. Deixe a janela aberta: o QR vai ser lido no passo 5.
3. **Lembretes → "Registrar como realizado"** no Guincho 02: conclui a troca de óleo e o painel recalcula na hora.

**Motorista** (abra uma janela anônima com Ctrl+Shift+N, aperte F12 e ative o modo celular com Ctrl+Shift+M):

4. Entre como Marcos. Sem check-in, o app abre na câmera: **"Escaneie o QR code do seu caminhão"**.
5. Aponte a webcam para a etiqueta (na tela do gestor ou impressa) — ou toque em **"Digitar a placa"** e digite `RSV-2B47`.
6. **"Este é o seu caminhão?"** → "Sim, é este" → **check-in do dia**: km do painel (182.615 ou mais) e o estado do caminhão. Escolha "Regular" para mostrar a observação obrigatória.
7. **Início**: o Guincho 02, o alerta da troca de óleo e o último aviso. Mostre **Avisos** (toque em "Entendi" — o gestor vê "Marcos já viu este aviso" em Lembretes), **Histórico** (sem valores), **Informar quilometragem** (tente um valor menor: é recusado) e **Avisar um problema**.

O check-in vale um por caminhão por dia. Para trocar de caminhão, toque no avatar **MO** → "Trocar de caminhão". Para mostrar o check-in do Guincho 02 desde o começo outra vez, volte os dados ao estado inicial (seção 5): isso apaga o check-in de hoje.

## 4.1. Testar o check-in com a câmera do celular

O navegador só libera a câmera em conexão segura (https) ou no próprio computador. Para usar o celular:

1. Deixe o `iniciar_backend.bat` aberto e, **no lugar** do `iniciar_frontend.bat`, abra o **`iniciar_celular.bat`**.
2. Celular e computador no **mesmo Wi-Fi**. Abra no celular o endereço **`Network: https://...`** que aparece na janela (não o `localhost`).
3. O celular avisa que a conexão não é segura (o certificado é gerado na hora): toque em **Avançado → Continuar**. Se o Windows perguntar, permita o acesso do Node.js à rede.
4. Entre como Marcos e aponte a câmera para a etiqueta. Se o celular tiver flash, aparece o botão **"Ligar lanterna"**.

Imprima a etiqueta **com o sistema aberto pelo mesmo endereço** que o celular vai usar: o QR code guarda o endereço do site. (Pelo app, a leitura funciona de qualquer jeito, porque ele usa só a placa.)

## 5. Voltar os dados ao estado inicial

Depois de testar, para deixar tudo como no começo, abra um terminal na pasta do projeto e rode:

```
.venv\Scripts\python.exe manage.py popular_demo --recriar
```

## 6. Se algo der errado

| Sintoma | O que fazer |
|---|---|
| `Python nao encontrado` | Reinstale o Python marcando "Add Python to PATH" e abra o `.bat` de novo. |
| Erro ao instalar as bibliotecas | Instale o Python **3.13** (não a versão mais nova de todas), apague a pasta `.venv` e abra o `iniciar_backend.bat` de novo. |
| `Node.js nao encontrado` | Instale o Node LTS e abra o `iniciar_frontend.bat` de novo. |
| A tela de login dá erro ao entrar | A janela do backend foi fechada ou deu erro: abra o `iniciar_backend.bat` de novo. |
| `That port is already in use` / porta 8000 ou 5173 ocupada | Já tem uma cópia rodando. Feche as janelas antigas ou reinicie o notebook. |
| A câmera não abre no check-in | Permita a câmera no navegador (ícone de cadeado ao lado do endereço). No celular, use o `iniciar_celular.bat` (seção 4.1). Sem câmera, use "Digitar a placa". |
| O motorista cai direto no Início, sem a câmera | Ele já fez o check-in hoje. Para mostrar a câmera de novo, volte os dados ao estado inicial (seção 5). |

## 7. Rodar sem os .bat (ou no Mac/Linux)

```
# backend (na pasta do projeto)
python -m venv .venv
.venv\Scripts\activate            # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
echo DB_ENGINE=sqlite> .env       # Mac/Linux: echo "DB_ENGINE=sqlite" > .env
python manage.py migrate
python manage.py popular_demo
python manage.py runserver

# frontend (outro terminal)
cd frontend
npm install
npm run dev
```

## Usar o PostgreSQL (banco oficial do projeto)

Siga as seções 2 e 3 do `README.md` para criar o banco e, no `.env`, troque para `DB_ENGINE=postgresql` com os dados de acesso (veja o `.env.example`). O resto é igual.
