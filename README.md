# CarHealth — Backend (API REST)

Sistema de manutenção de frotas. Este repositório é **só o backend**: uma API REST que recebe e responde **JSON**. As telas são feitas no Figma e o frontend vai consumir esta API.

**Tecnologias:** Python 3.11+ · Django 5.2 · Django REST Framework · PostgreSQL 16 · JWT (login por token) · bcrypt (senhas)

**Modelo de dados:** revisão da Sprint 3 (Capítulo 4 v2 do Dossiê): perfis gestor e motorista, rodízio de motoristas entre os veículos e número da ordem de serviço sequencial por empresa.

---

## 1. Como a API funciona

Toda requisição percorre este caminho:

```
Cliente (Postman / frontend)
   │  GET /api/veiculos   +  cabeçalho  Authorization: Bearer <token>
   ▼
urls.py ─────────► descobre qual view atende a rota
   ▼
Autenticação JWT ► confere o token. Sem token válido ou conta INATIVA → 401
   ▼
Permissão ───────► o perfil pode fazer isso? (motorista tem acesso restrito) → senão 403
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
│   ├── models.py              #   tabelas empresa e usuario
│   ├── serializers.py         #   JSON ⇄ model (+ validação)
│   ├── views.py               #   registrar, me, empresas, usuarios
│   ├── permissoes.py          #   regras por perfil (gestor / motorista)
│   ├── validators.py          #   valida CPF, CNPJ e placa
│   ├── urls.py                #   /api/auth/..., /api/empresas, /api/usuarios
│   ├── migrations/            #   SQL gerado pelo Django (cria as tabelas)
│   └── tests.py               #   testes automáticos
│
├── frota/                     # MÓDULO 2: frota
│   ├── models.py              #   motorista, veiculo, plano_manutencao,
│   │                          #   leitura_odometro, ordem_servico
│   ├── serializers.py
│   ├── views.py               #   um CRUD por tabela + concluir/cancelar OS
│   ├── urls.py                #   /api/motoristas, /api/veiculos, ...
│   ├── migrations/
│   └── tests.py
│
└── docs/
    ├── CarHealth.postman_collection.json   # todas as chamadas prontas (Postman/Thunder Client)
    ├── capitulo4_banco_de_dados.md         # texto do Dossiê da Sprint 2 (ver Capítulo 4 v2)
    └── modelo_fisico.sql                   # script do banco (igual às migrações)
```

### Models = tabelas do banco

Os models seguem **exatamente** o modelo físico da Sprint 3 (`docs/modelo_fisico.sql`), com os mesmos nomes de tabelas e colunas:

| Tabela | Model | Arquivo |
|---|---|---|
| empresa | `Empresa` | `contas/models.py` |
| usuario | `Usuario` (quem faz login: gestor ou motorista) | `contas/models.py` |
| motorista | `Motorista` | `frota/models.py` |
| veiculo | `Veiculo` | `frota/models.py` |
| plano_manutencao | `PlanoManutencao` | `frota/models.py` |
| leitura_odometro | `LeituraOdometro` | `frota/models.py` |
| ordem_servico | `OrdemServico` (as "manutenções") | `frota/models.py` |

### Perfis de acesso (RN16)

| Perfil | Pode |
|---|---|
| **GESTOR** | Tudo: cadastros, valores, ajuste de odômetro, abrir/concluir/cancelar ordens. |
| **MOTORISTA** | Ver os veículos **ativos**, registrar leitura de odômetro (sem ajuste) e consultar o histórico de manutenções **sem os valores**. Qualquer outra rota responde 403. |

A conta do motorista é ligada ao cadastro dele (`usuario.cpf_motorista`), e o nome exibido vem do cadastro do motorista. Conta ou motorista **INATIVO** não entra no sistema.

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
Cria o arquivo de configuração. Abra o `.env` e confira `DB_NAME`, `DB_USER` e `DB_PASSWORD` com o que você usou no passo 3. Esse arquivo **não vai para o GitHub**.

```powershell
python manage.py migrate
```
Cria as tabelas no PostgreSQL. Para conferir no pgAdmin: *Databases › carhealth › Schemas › public › Tables*.

> **Já criou as tabelas com o script SQL do grupo (`docs/modelo_fisico.sql`)?** Nesse caso o `migrate` acusa `relation "empresa" already exists`. Rode então:
> ```powershell
> python manage.py migrate --fake-initial
> ```
> O Django vê que as tabelas já existem, marca como "já feito" (FAKED) e cria só as tabelas internas dele (`django_migrations`, `auth_*`, `django_content_type`). Nenhum dado é apagado.

```powershell
python manage.py runserver
```
Liga a API em **http://127.0.0.1:8000**. Deixe esse terminal aberto. Para desligar, use `Ctrl + C`.

Abra **http://127.0.0.1:8000/api/docs** no navegador: é a documentação interativa (**Swagger**) com todas as rotas.

---

## 5. Rotas da API (base: `http://127.0.0.1:8000/api`)

🔓 = pública · 🔒 = gestor e motorista · 👑 = só GESTOR

### Autenticação
| Método | Rota | O que faz |
|---|---|---|
| POST 🔓 | `/auth/registrar` | Cria a **empresa** e o primeiro usuário (GESTOR). Já devolve o token. |
| POST 🔓 | `/auth/login` | `{"email", "password"}` → devolve `access` (token) e `refresh`. Conta INATIVA recebe 401. |
| POST 🔓 | `/auth/refresh` | `{"refresh"}` → novo `access` |
| GET 🔒 | `/auth/me` | Dados da conta logada, inclusive o `perfil` (o frontend usa para levar cada um à sua área) |

### CRUDs
Cada recurso tem as 5 rotas padrão:

| Método | Rota | Ação |
|---|---|---|
| GET | `/recurso` | listar |
| POST | `/recurso` | cadastrar |
| GET | `/recurso/{id}` | ver um |
| PUT / PATCH | `/recurso/{id}` | editar todos os campos / só alguns |
| DELETE | `/recurso/{id}` | excluir (com histórico → 409: mude a `situacao` para `INATIVO`) |

| Recurso | `{id}` é | Filtros na URL | Observação |
|---|---|---|---|
| `/empresas` 🔒 | CNPJ | — | Só a própria empresa. Listar e ver; editar é 👑. É criada no `/auth/registrar`. |
| `/usuarios` 👑 | e-mail | — | Gestor cadastra, edita e inativa contas (GESTOR ou MOTORISTA). |
| `/motoristas` 👑 | CPF | `?situacao=` | Devolve `cnh_vencida` e `email_acesso`. Pode criar a conta do motorista junto (ver exemplo). |
| `/veiculos` 🔒 | placa | `?placa=ABC` (busca) `?situacao=` `?tipo=` | Devolve `km_atual` (`null` = sem registro). Motorista: só listar/ver, e só os ativos. |
| `/veiculos/tipos` 👑 | — | — | GET: tipos já usados pela empresa, para sugerir no cadastro. |
| `/planos-manutencao` 👑 | id_plano | `?tipo_veiculo=` `?situacao=` | Exige `intervalo_km`, `intervalo_meses` ou ambos. |
| `/leituras-odometro` 🔒 | codigo | `?veiculo=<placa>` | Motorista: listar, ver e registrar. Data = hoje; responsável = quem está logado. |
| `/ordens-servico` 🔒 | numero | `?veiculo=<placa>` `?status=` | Abrir e editar é 👑. Motorista vê só as concluídas, sem `valor`. **Sem DELETE**: cancele. |
| `/ordens-servico/{numero}/concluir` 👑 | — | — | POST: conclui e gera a leitura de odômetro automaticamente. |
| `/ordens-servico/{numero}/cancelar` 👑 | — | — | POST: cancela uma ordem ainda não concluída. |

**Por que a empresa não tem POST/DELETE próprios?** No modelo de dados, todo `usuario` pertence a uma `empresa` (`usuario.cnpj_empresa NOT NULL`). Por isso a empresa nasce junto com o primeiro usuário em `/auth/registrar`.

### Regras de negócio que a API confere
- **Odômetro só avança (RN03):** a leitura não pode ser menor que a última registrada, a não ser com `"origem": "AJUSTE_ODOMETRO"` (troca ou zeragem do odômetro), que só o gestor pode lançar.
- **Número da OS (RF23):** sequencial dentro de cada empresa, começando em 1 e gerado na abertura. O `id_ordem` é interno e não aparece na API.
- **Plano da OS (RN10):** `id_plano` é opcional (ordem corretiva não tem plano). Quando informado, o plano precisa estar ATIVO e ser do mesmo tipo do veículo.
- **Inativar em vez de excluir (RN15):** veículo, motorista, plano ou usuário com histórico não é excluído (409); use `"situacao": "INATIVO"`.

### Fluxo da ordem de serviço (MVP)
```
ABERTA ──(POST /concluir: data, km e valor)──► CONCLUIDA  + leitura de odômetro automática
   └────(POST /cancelar)─────────────────────► CANCELADA
```
O status não muda por PUT/PATCH, só por essas duas ações. A aprovação (status `APROVADA`) fica reservada para depois do MVP (RN12).

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
Motorista, já liberando o acesso dele ao sistema (`email_acesso` e `senha_inicial` são opcionais):
```json
{"cpf": "52998224725", "nome": "João Silva", "telefone": "83988887777",
 "num_cnh": "12345678901", "validade_cnh": "2030-01-01",
 "email_acesso": "joao@sueli.com", "senha_inicial": "CarHealth#2026"}
```
Conta de motorista pela rota de usuários (alternativa):
```json
{"email": "joao@sueli.com", "perfil": "MOTORISTA", "cpf_motorista": "52998224725", "password": "CarHealth#2026"}
```
Veículo:
```json
{"placa": "QWE1A23", "marca": "Mercedes-Benz", "modelo": "Accelo 1016", "ano": 2021, "tipo": "GUINCHO"}
```
Leitura de odômetro (gestor ou motorista):
```json
{"placa_veiculo": "QWE1A23", "quilometragem": 45000}
```
Abrir OS (sem `data_abertura`, vale a de hoje):
```json
{"placa_veiculo": "QWE1A23", "id_plano": 1, "descricao": "Revisão dos 45.000 km"}
```
Concluir OS:
```json
{"data_conclusao": "2026-10-20", "quilometragem": 45100, "valor": "350.00", "oficina": "Oficina do Zé"}
```

Valores aceitos:
- `perfil`: GESTOR, MOTORISTA
- `situacao` (usuário, motorista, veículo e plano): ATIVO, INATIVO
- `origem` da leitura: MANUAL, AJUSTE_ODOMETRO (ORDEM_SERVICO é gerada pelo sistema na conclusão)
- `status` da OS: ABERTA, CONCLUIDA, CANCELADA (APROVADA reservado)
- `tipo` do veículo / `tipo_veiculo` do plano: texto livre, gravado em maiúsculas (ex.: GUINCHO, CAMINHAO). Precisam ser iguais para o plano valer para o veículo.

CPF e CNPJ devem ser enviados **só com números** e com dígitos verificadores válidos. Exemplos válidos para testes: CNPJ `11222333000181`, CPF `52998224725`.

### Respostas de erro
| Código | Quando |
|---|---|
| 400 | Dado inválido. O JSON mostra o campo e o motivo, ex.: `{"cpf": ["CPF inválido."]}` |
| 401 | Sem token, token vencido ou conta INATIVA |
| 403 | O perfil não pode fazer isso (ex.: motorista tentando abrir OS) |
| 404 | Não existe, é de outra empresa ou (para o motorista) o veículo está inativo |
| 405 | Método não existe na rota (ex.: DELETE em ordem de serviço) |
| 409 | Não pode excluir porque há histórico vinculado: inative em vez de excluir |

---

## 6. Testar sozinho (Thunder Client ou Postman)

1. Com o `runserver` ligado, abra o Thunder Client (ícone de raio no VS Code) → **Collections** → menu **☰** → **Import** → escolha `docs/CarHealth.postman_collection.json`. No Postman: **Import** → mesmo arquivo.
2. Rode **1. Auth › Registrar** (só na primeira vez) ou **Login**. O token é **salvo sozinho** e usado em todas as outras chamadas.
3. Rode as pastas na ordem: 2, 3, 4… até 8. A pasta **9. Perfil motorista** faz login como motorista e mostra o que ele pode e não pode fazer. A pasta **10. Inativar e excluir** fica para o final.

Para testar à mão, sem a coleção: faça o login, copie o `access` da resposta e, nas outras chamadas, vá em **Auth › Bearer** e cole o token.

## 7. Testes automáticos

```powershell
python manage.py test
```
Roda 38 testes: login, token, bcrypt, conta inativa, isolamento entre empresas, permissões de cada perfil, CRUDs e as regras de negócio (odômetro, numeração e conclusão da OS). Rode antes de cada `git push`.

## 8. Integração com o frontend

- O frontend chama `http://127.0.0.1:8000/api/...` enviando e recebendo JSON.
- Depois do login, guarde o `access` e envie em toda chamada: `Authorization: Bearer <token>`.
- Use o `perfil` de `GET /api/auth/me` para levar o gestor ao painel e o motorista à lista de veículos (RF04). As restrições valem no servidor de qualquer jeito.
- Os endereços do frontend que podem chamar a API ficam em `CORS_ALLOWED_ORIGINS` no `.env`. Já estão liberados `http://localhost:5173` (Vite) e `http://localhost:3000`.
- O contrato completo da API (para gerar tipos ou clientes) fica em `http://127.0.0.1:8000/api/schema`.

## 9. Adicionar um CRUD novo (ex.: oficina)

1. `frota/models.py`: crie a classe com `db_table = "oficina"` e um campo `empresa`.
2. `python manage.py makemigrations` e depois `python manage.py migrate`.
3. `frota/serializers.py`: crie `OficinaSerializer`.
4. `frota/views.py`: crie `OficinaViewSet(DaEmpresaViewSet)` com `queryset` e `serializer_class`. Por padrão só o GESTOR acessa; para liberar ações ao motorista, use `acoes_motorista = ("list", "retrieve")`.
5. `frota/urls.py`: `router.register("oficinas", views.OficinaViewSet, basename="oficina")`.
