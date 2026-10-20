# Roteiro de apresentação: andamento do backend

> Pedido do professor: *"Quero saber o andamento geral do código da equipe, quero que me mostrem o que estão fazendo e no mínimo os modelos e as chamadas REST que já fizeram."*

Antes de começar: PostgreSQL ligado, `.venv` ativado, `python manage.py runserver` rodando, e o Thunder Client/Postman com a coleção importada.

## 1. Andamento geral (1 min)

| Etapa | Situação |
|---|---|
| Ambiente, projeto Django e conexão com PostgreSQL | ✅ pronto |
| Models das 7 tabelas, seguindo o modelo físico da Sprint 3 | ✅ pronto |
| Autenticação: registrar, login com JWT, rota protegida, senha com bcrypt | ✅ pronto |
| Perfis GESTOR e MOTORISTA, com as restrições do motorista conferidas no servidor | ✅ pronto |
| CRUD: empresa, usuários, motoristas, veículos, planos, leituras de odômetro, ordens de serviço | ✅ pronto |
| Ordem de serviço do MVP: número por empresa, concluir (gera a leitura) e cancelar | ✅ pronto |
| Testes automáticos (38) | ✅ passando |
| Documentação Swagger em `/api/docs` | ✅ pronto |
| Integração com o frontend | ⏳ próxima etapa (CORS já configurado) |
| Telas | 🎨 no Figma (outro integrante) |

## 2. Mostrar os modelos (2 min)

1. Abra `frota/models.py` e mostre a classe `Veiculo`:
   - `db_table = "veiculo"`: é a mesma tabela do script SQL.
   - `placa = CharField(max_length=8, primary_key=True)` corresponde a `placa varchar(8) PRIMARY KEY`.
   - `empresa = ForeignKey(Empresa, db_column="cnpj_empresa")` corresponde à chave estrangeira `fk_veiculo_empresa`.
2. Abra `contas/models.py` e mostre `Usuario` (a antiga tabela `admin`): o `perfil` separa gestor e motorista, `cpf_motorista` liga a conta ao cadastro do motorista e a coluna `senha` guarda um **hash bcrypt**.
3. Opcional: no pgAdmin, rode `SELECT email, perfil, senha FROM usuario;` para mostrar que a senha não aparece em texto puro.

## 3. Mostrar as chamadas REST (4 a 5 min)

Execute no Thunder Client/Postman, nesta ordem:

1. **GET /api/veiculos sem token** → **401**: a rota é protegida.
2. **POST /api/auth/registrar** → **201**: cria a empresa e o gestor e devolve o token.
3. **GET /api/auth/me** → **200**: o token funciona.
4. **POST /api/motoristas** com `email_acesso` e `senha_inicial` → **201**: cria o motorista e a conta dele.
5. **POST /api/veiculos** → **201**. Depois **GET /api/veiculos?placa=QWE** (busca pela placa).
6. **POST /api/veiculos com `"ano": 1800`** → **400** com a mensagem de erro (validação).
7. **POST /api/ordens-servico** → **201**. O `numero` é sequencial na empresa e o `email_emitente` vem do token.
8. **POST /api/ordens-servico/1/concluir** → **200**: a OS fica CONCLUIDA e a leitura de odômetro é gravada sozinha.
9. Pasta **9. Perfil motorista**: login como motorista, registrar leitura (**201**), tentar abrir OS (**403**) e ver o histórico sem o valor.
10. **DELETE /api/veiculos/QWE1A23** (com histórico) → **409**: o banco protege o histórico; o caminho é inativar.

Por fim, abra **http://127.0.0.1:8000/api/docs** e mostre que todas as rotas estão documentadas.

## 4. Explicar o fluxo de uma requisição (1 min)

`urls.py` → autenticação JWT → permissão → **view** (filtra pela empresa do usuário) → **serializer** (valida o JSON) → **model** → PostgreSQL.

## 5. Próximos passos

- Conectar o frontend à API.
- Situação de manutenção (vencida / próxima / em dia) por veículo e plano, e o painel do gestor (RF19 a RF22, RF32).
- Custo acumulado por veículo e filtro do histórico por período (RF30, RF31).
- Paginação nas listagens.
