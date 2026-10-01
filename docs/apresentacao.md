# Roteiro de apresentação: andamento do backend

> Pedido do professor: *"Quero saber o andamento geral do código da equipe, quero que me mostrem o que estão fazendo e no mínimo os modelos e as chamadas REST que já fizeram."*

Antes de começar: PostgreSQL ligado, `.venv` ativado, `python manage.py runserver` rodando, e o Thunder Client/Postman com a coleção importada.

## 1. Andamento geral (1 min)

| Etapa | Situação |
|---|---|
| Ambiente, projeto Django e conexão com PostgreSQL | ✅ pronto |
| Models das 7 tabelas, seguindo o script SQL do grupo | ✅ pronto |
| Autenticação: registrar, login com JWT, rota protegida, senha com bcrypt | ✅ pronto |
| CRUD: empresa, usuários, motoristas, veículos, planos, leituras de odômetro, ordens de serviço | ✅ pronto |
| Testes automáticos (21) | ✅ passando |
| Documentação Swagger em `/api/docs` | ✅ pronto |
| Integração com o frontend | ⏳ próxima etapa (CORS já configurado) |
| Telas | 🎨 no Figma (outro integrante) |

## 2. Mostrar os modelos (2 min)

1. Abra `frota/models.py` e mostre a classe `Veiculo`:
   - `db_table = "veiculo"`: é a mesma tabela do script SQL.
   - `placa = CharField(max_length=8, primary_key=True)` corresponde a `placa varchar(8) PRIMARY KEY`.
   - `empresa = ForeignKey(Empresa, db_column="cnpj_empresa")` corresponde à chave estrangeira `fk_veiculo_empresa`.
2. Abra `contas/models.py` e mostre `Admin`: a coluna `senha` guarda um **hash bcrypt**.
3. Opcional: no pgAdmin, rode `SELECT email, senha FROM admin;` para mostrar que a senha não aparece em texto puro.

## 3. Mostrar as chamadas REST (4 a 5 min)

Execute no Thunder Client/Postman, nesta ordem:

1. **GET /api/veiculos sem token** → **401**: a rota é protegida.
2. **POST /api/auth/registrar** → **201**: cria a empresa e o gestor e devolve o token.
3. **GET /api/auth/me** → **200**: o token funciona.
4. **POST /api/motoristas** → **201**.
5. **POST /api/veiculos** → **201**. Depois **GET /api/veiculos?situacao=ATIVO**.
6. **POST /api/veiculos com `"ano": 1800`** → **400** com a mensagem de erro (validação).
7. **POST /api/ordens-servico** → **201**. O `email_emitente` é preenchido sozinho pelo token.
8. **POST /api/ordens-servico/1/aprovar** → **200**: só o Gestor consegue.
9. **GET /api/ordens-servico?veiculo=QWE1A23** → histórico de manutenções do veículo.
10. **DELETE /api/veiculos/QWE1A23** (com OS vinculada) → **409**: o banco protege o histórico.

Por fim, abra **http://127.0.0.1:8000/api/docs** e mostre que todas as rotas estão documentadas.

## 4. Explicar o fluxo de uma requisição (1 min)

`urls.py` → autenticação JWT → permissão → **view** (filtra pela empresa do usuário) → **serializer** (valida o JSON) → **model** → PostgreSQL.

## 5. Próximos passos

- Conectar o frontend à API.
- Rotas de relatório/alertas: CNH vencendo e manutenção preventiva por km/tempo.
- Paginação nas listagens.
