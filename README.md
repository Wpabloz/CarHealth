# CarHealth — Backend (API REST)

Sistema de manutenção de frotas. Este repositório é **só o backend**: uma API REST que recebe e responde **JSON**. As telas são feitas no Figma e o frontend vai consumir esta API.

**Tecnologias:** Python 3.11+ · Django 5.2 · Django REST Framework · PostgreSQL 16 · JWT (login por token) · bcrypt (senhas)

---

## 1. Como a API funciona (para explicar na apresentação)

Toda requisição percorre este caminho:

```
Cliente (Postman / frontend)
   │  GET /api/veiculos   +  cabeçalho  Authorization: Bearer <token>
   ▼
urls.py ─────────► descobre qual view atende a rota
   ▼
Autenticação JWT ► confere o token. Sem token válido → 401
   ▼
Permissão ───────► é Gestor? (só em algumas rotas) → senão 403
   ▼
View (controller)► filtra pela EMPRESA do usuário e chama o serializer
   ▼
Serializer ──────► valida o JSON e converte JSON ⇄ model
   ▼
Model ───────────► Django ORM gera o SQL
   ▼
PostgreSQL
```

### Estrutura de pastas

```
CarHealth/
├── manage.py                  # "controle remoto" do Django (migrate, runserver, test...)
├── requirements.txt           # bibliotecas do projeto
├── .env.example               # modelo das configurações secretas (copie para .env)
│
├── carhealth/                 # CONFIGURAÇÃO do projeto
│   ├── settings.py            #   banco, JWT, bcrypt, apps instalados
│   ├── urls.py                #   rotas principais (/api/...)
│   └── erros.py               #   transforma erros do banco em JSON (400/409)
│
├── contas/                    # MÓDULO 1: autenticação, empresa e usuários
│   ├── models.py              #   tabelas empresa e admin
│   ├── serializers.py         #   JSON ⇄ model (+ validação)
│   ├── views.py               #   registrar, me, empresas, usuarios
│   ├── permissoes.py          #   regra "somente Gestor"
│   ├── validators.py          #   valida CPF, CNPJ e placa
│   ├── urls.py                #   /api/auth/..., /api/empresas, /api/usuarios
│   ├── migrations/            #   SQL gerado pelo Django (cria as tabelas)
│   └── tests.py               #   testes automáticos
│
├── frota/                     # MÓDULO 2: frota
│   ├── models.py              #   motorista, veiculo, plano_manutencao,
│   │                          #   leitura_odometro, ordem_servico
│   ├── serializers.py
│   ├── views.py               #   um CRUD por tabela
│   ├── urls.py                #   /api/motoristas, /api/veiculos, ...
│   ├── migrations/
│   └── tests.py
│
└── docs/
    ├── CarHealth.postman_collection.json   # todas as chamadas prontas (Postman/Thunder Client)
    ├── apresentacao.md                     # roteiro para mostrar ao professor
    ├── capitulo4_banco_de_dados.md         # texto do Dossiê (4.3 a 4.7)
    └── modelo_fisico.sql                   # SQL equivalente às tabelas
```

### Models = tabelas do banco

Os models seguem **exatamente** o script SQL do grupo, com os mesmos nomes de tabelas e colunas:

| Tabela | Model | Arquivo |
|---|---|---|
| empresa | `Empresa` | `contas/models.py` |
| admin | `Admin` (é o usuário que faz login) | `contas/models.py` |
| motorista | `Motorista` | `frota/models.py` |
| veiculo | `Veiculo` | `frota/models.py` |
| plano_manutencao | `PlanoManutencao` | `frota/models.py` |
| leitura_odometro | `LeituraOdometro` | `frota/models.py` |
| ordem_servico | `OrdemServico` (as "manutenções") | `frota/models.py` |

---

## 2. Preparar o ambiente (Windows) — uma vez só

1. **Python 3.11 ou mais novo**: <https://www.python.org/downloads/>. Na instalação, marque **"Add Python to PATH"**.
2. **PostgreSQL 16**: <https://www.postgresql.org/download/windows/>. Anote a senha do usuário `postgres` que o instalador pedir. O instalador já traz o **pgAdmin**.
3. **Git** (<https://git-scm.com>) e **VS Code**.
4. No VS Code, instale a extensão **Thunder Client** (ou instale o **Postman**).

## 3. Criar o banco de dados

Abra o **pgAdmin** → *Servers › PostgreSQL 16* → botão direito em **Databases** → **Query Tool** → cole e execute (F5):

```sql
CREATE USER carhealth WITH PASSWORD 'carhealth' CREATEDB;
CREATE DATABASE carhealth OWNER carhealth;
```

- A 1ª linha cria um usuário só para o sistema (mais seguro que usar o `postgres`). O `CREATEDB` permite que os testes criem um banco temporário.
- A 2ª linha cria o banco vazio. **Não precisa rodar os `CREATE TABLE`**: o Django cria as tabelas no passo 4.

## 4. Baixar e rodar o projeto

Abra o terminal do VS Code (**Terminal › New Terminal**) e rode um comando por vez:

```powershell
git clone https://github.com/Wpabloz/CarHealth.git
cd CarHealth
git checkout claude/django-postgresql-schema-7s9hq1
```
Baixa o código e entra na branch do backend.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```
Cria um **ambiente virtual**: uma pasta `.venv` com as bibliotecas só deste projeto. Depois de ativar, aparece `(.venv)` no início da linha.
> Se der erro de "execução de scripts desabilitada", rode uma vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e tente de novo.

```powershell
pip install -r requirements.txt
```
Instala Django, DRF, JWT, bcrypt e o driver do PostgreSQL.

```powershell
copy .env.example .env
```
Cria o arquivo de configuração. Abra o `.env` e confira se `DB_PASSWORD` é a senha que você usou no passo 3. Esse arquivo **não vai para o GitHub**.

```powershell
python manage.py migrate
```
Cria as tabelas no PostgreSQL. Para conferir no pgAdmin: *Databases › carhealth › Schemas › public › Tables*.

```powershell
python manage.py runserver
```
Liga a API em **http://127.0.0.1:8000**. Deixe esse terminal aberto. Para desligar, use `Ctrl + C`.

Abra **http://127.0.0.1:8000/api/docs** no navegador: é a documentação interativa (**Swagger**) com todas as rotas.

---

## 5. Rotas da API (base: `http://127.0.0.1:8000/api`)

🔓 = pública · 🔒 = exige token · 👑 = exige perfil GESTOR

### Autenticação
| Método | Rota | O que faz |
|---|---|---|
| POST 🔓 | `/auth/registrar` | Cria a **empresa** e o primeiro usuário (GESTOR). Já devolve o token. |
| POST 🔓 | `/auth/login` | `{"email", "password"}` → devolve `access` (token) e `refresh` |
| POST 🔓 | `/auth/refresh` | `{"refresh"}` → novo `access` |
| GET 🔒 | `/auth/me` | Dados do usuário dono do token (serve para testar o token) |

### CRUDs
Cada recurso tem as 5 rotas padrão:

| Método | Rota | Ação |
|---|---|---|
| GET | `/recurso` | listar |
| POST | `/recurso` | cadastrar |
| GET | `/recurso/{id}` | ver um |
| PUT / PATCH | `/recurso/{id}` | editar todos os campos / só alguns |
| DELETE | `/recurso/{id}` | excluir |

| Recurso | `{id}` é | Filtros na URL | Observação |
|---|---|---|---|
| `/empresas` 🔒 | CNPJ | — | Só a própria empresa. Listar, ver e editar (👑). É criada no `/auth/registrar`. |
| `/usuarios` 👑 | e-mail | — | Gestor cadastra/remove usuários da empresa |
| `/motoristas` 🔒 | CPF | — | |
| `/veiculos` 🔒 | placa | `?situacao=ATIVO` `?tipo=CAMINHAO` `?motorista=<cpf>` | Devolve `km_atual` |
| `/planos-manutencao` 🔒 | id_plano | `?tipo_veiculo=` | |
| `/leituras-odometro` 🔒 | codigo | `?veiculo=<placa>` | km nunca pode diminuir |
| `/ordens-servico` 🔒 | numero | `?veiculo=<placa>` `?status=` | **Histórico de manutenções** do veículo |
| `/ordens-servico/{numero}/aprovar` 👑 | — | — | POST: aprova a OS |

**Por que a empresa não tem POST/DELETE próprios?** No modelo de dados, todo `admin` pertence a uma `empresa` (`admin.cnpj_empresa NOT NULL`). Por isso a empresa nasce junto com o primeiro usuário em `/auth/registrar`.

### Fluxo da ordem de serviço
```
ABERTA ──(POST /aprovar, Gestor)──► APROVADA ──► EM_EXECUCAO ──► CONCLUIDA
   └──────────────► CANCELADA
```

### Exemplos de JSON

Registrar:
```json
{
  "empresa": {"cnpj": "11222333000181", "razao_social": "Reboques Sueli LTDA",
              "telefone": "83999990000", "email": "contato@sueli.com"},
  "nome": "Sueli Gomes",
  "email": "sueli@sueli.com",
  "password": "CarHealth#2026"
}
```
Veículo:
```json
{"placa": "QWE1A23", "marca": "Mercedes-Benz", "modelo": "Accelo 1016", "ano": 2021,
 "tipo": "CAMINHAO", "situacao": "ATIVO", "cpf_motorista": "52998224725"}
```
Abrir OS:
```json
{"placa_veiculo": "QWE1A23", "descricao": "Revisão dos 45.000 km", "data_abertura": "2026-10-01"}
```

Valores aceitos:
- `tipo`: CARRO, MOTO, UTILITARIO, VAN, CAMINHAO, ONIBUS
- `situacao`: ATIVO, MANUTENCAO, INATIVO
- `origem` da leitura: MANUAL, MOTORISTA, ORDEM_SERVICO
- `status` da OS: ABERTA, APROVADA, EM_EXECUCAO, CONCLUIDA, CANCELADA
- `perfil`: GESTOR, OPERADOR

CPF e CNPJ devem ser enviados **só com números** e com dígitos verificadores válidos. Exemplos válidos para testes: CNPJ `11222333000181`, CPF `52998224725`.

### Respostas de erro
| Código | Quando |
|---|---|
| 400 | Dado inválido. O JSON mostra o campo e o motivo, ex.: `{"cpf": ["CPF inválido."]}` |
| 401 | Sem token ou token vencido |
| 403 | Sem permissão (ex.: Operador tentando aprovar OS) |
| 404 | Não existe, ou é de outra empresa |
| 409 | Não pode excluir porque há registros vinculados |

---

## 6. Testar sozinho (Thunder Client ou Postman)

1. Com o `runserver` ligado, abra o Thunder Client (ícone de raio no VS Code) → **Collections** → menu **☰** → **Import** → escolha `docs/CarHealth.postman_collection.json`. No Postman: **Import** → mesmo arquivo.
2. Rode **1. Auth › Registrar** (só na primeira vez) ou **Login**. O token é **salvo sozinho** e usado em todas as outras chamadas.
3. Rode as pastas na ordem: 2, 3, 4… até 8. A pasta **9. Exclusões** apaga tudo no final, na ordem certa.

Para testar à mão, sem a coleção: faça o login, copie o `access` da resposta e, nas outras chamadas, vá em **Auth › Bearer** e cole o token.

## 7. Testes automáticos

```powershell
python manage.py test
```
Roda 21 testes: login, token, bcrypt, isolamento entre empresas, CRUDs e regras de negócio. Rode antes de cada `git push`.

## 8. Integração com o frontend

- O frontend chama `http://127.0.0.1:8000/api/...` enviando e recebendo JSON.
- Depois do login, guarde o `access` e envie em toda chamada: `Authorization: Bearer <token>`.
- Os endereços do frontend que podem chamar a API ficam em `CORS_ALLOWED_ORIGINS` no `.env`. Já estão liberados `http://localhost:5173` (Vite) e `http://localhost:3000`.
- O contrato completo da API (para gerar tipos ou clientes) fica em `http://127.0.0.1:8000/api/schema`.

## 9. Adicionar um CRUD novo (ex.: oficina)

1. `frota/models.py`: crie a classe com `db_table = "oficina"` e um campo `empresa`.
2. `python manage.py makemigrations` e depois `python manage.py migrate`.
3. `frota/serializers.py`: crie `OficinaSerializer`.
4. `frota/views.py`: crie `OficinaViewSet(DaEmpresaViewSet)` com `queryset` e `serializer_class`.
5. `frota/urls.py`: `router.register("oficinas", views.OficinaViewSet, basename="oficina")`.
