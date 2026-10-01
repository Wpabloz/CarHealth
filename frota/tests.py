from rest_framework.test import APITestCase

from contas.models import Admin, Empresa

from .models import LeituraOdometro, Motorista, OrdemServico, Veiculo

SENHA = "SenhaForte#2026"


class BaseTest(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(cnpj="11222333000181", razao_social="A",
                                              telefone="1", email="a@a.com")
        self.outra = Empresa.objects.create(cnpj="45723174000110", razao_social="B",
                                            telefone="1", email="b@b.com")
        self.gestor = Admin.objects.create_user("g@a.com", "Gestor", self.empresa, SENHA, "GESTOR")
        self.operador = Admin.objects.create_user("op@a.com", "Op", self.empresa, SENHA)
        self.veiculo = Veiculo.objects.create(placa="ABC1D23", marca="VW", modelo="Delivery",
                                              ano=2020, tipo="CAMINHAO", empresa=self.empresa)
        self.client.force_authenticate(self.gestor)


class MotoristaTest(BaseTest):
    def test_crud_completo(self):
        dados = {"cpf": "52998224725", "nome": "João", "telefone": "83999990000",
                 "num_cnh": "12345678901", "validade_cnh": "2027-05-10"}
        resp = self.client.post("/api/motoristas", dados, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["cnpj_empresa"], "11222333000181")

        self.assertEqual(len(self.client.get("/api/motoristas").data), 1)
        self.assertEqual(self.client.get("/api/motoristas/52998224725").data["nome"], "João")

        dados["nome"] = "João Silva"
        resp = self.client.put("/api/motoristas/52998224725", dados, format="json")
        self.assertEqual(resp.data["nome"], "João Silva")

        resp = self.client.patch("/api/motoristas/52998224725", {"cpf": "11144477735"}, format="json")
        self.assertEqual(resp.status_code, 400)  # chave primária não muda

        self.assertEqual(self.client.delete("/api/motoristas/52998224725").status_code, 204)
        self.assertFalse(Motorista.objects.exists())

    def test_cpf_invalido_e_cnh_duplicada(self):
        resp = self.client.post("/api/motoristas", {"cpf": "12345678900", "nome": "X",
                                "telefone": "1", "num_cnh": "1", "validade_cnh": "2027-01-01"},
                                format="json")
        self.assertIn("cpf", resp.data)
        Motorista.objects.create(cpf="11144477735", nome="Y", telefone="1", num_cnh="999",
                                 validade_cnh="2027-01-01", empresa=self.empresa)
        resp = self.client.post("/api/motoristas", {"cpf": "52998224725", "nome": "X",
                                "telefone": "1", "num_cnh": "999", "validade_cnh": "2027-01-01"},
                                format="json")
        self.assertIn("num_cnh", resp.data)


class VeiculoTest(BaseTest):
    def test_cadastrar_listar_filtrar(self):
        resp = self.client.post("/api/veiculos", {"placa": "abc-1234", "marca": "Ford",
                                "modelo": "Cargo", "ano": 2019, "tipo": "CAMINHAO",
                                "situacao": "MANUTENCAO"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["placa"], "ABC1234")
        self.assertEqual(len(self.client.get("/api/veiculos").data), 2)
        resp = self.client.get("/api/veiculos?situacao=MANUTENCAO")
        self.assertEqual([v["placa"] for v in resp.data], ["ABC1234"])

    def test_ano_invalido(self):
        resp = self.client.post("/api/veiculos", {"placa": "AAA1111", "marca": "X", "modelo": "Y",
                                "ano": 1800, "tipo": "CARRO"}, format="json")
        self.assertIn("ano", resp.data)

    def test_isolamento_entre_empresas(self):
        Veiculo.objects.create(placa="XYZ9876", marca="VW", modelo="Gol", ano=2015,
                               tipo="CARRO", empresa=self.outra)
        alheio = Motorista.objects.create(cpf="11144477735", nome="Z", telefone="1",
                                          num_cnh="5", validade_cnh="2027-01-01", empresa=self.outra)
        placas = [v["placa"] for v in self.client.get("/api/veiculos").data]
        self.assertEqual(placas, ["ABC1D23"])
        self.assertEqual(self.client.get("/api/veiculos/XYZ9876").status_code, 404)
        self.assertEqual(self.client.delete("/api/veiculos/XYZ9876").status_code, 404)
        resp = self.client.patch("/api/veiculos/ABC1D23", {"cpf_motorista": alheio.cpf}, format="json")
        self.assertEqual(resp.status_code, 400)  # não aceita motorista de outra empresa

    def test_nao_exclui_veiculo_com_historico(self):
        LeituraOdometro.objects.create(veiculo=self.veiculo, data_leitura="2026-01-01",
                                       quilometragem=100)
        resp = self.client.delete("/api/veiculos/ABC1D23")
        self.assertEqual(resp.status_code, 409)
        self.assertTrue(Veiculo.objects.filter(pk="ABC1D23").exists())


class PlanoTest(BaseTest):
    def test_exige_algum_intervalo(self):
        resp = self.client.post("/api/planos-manutencao", {"descricao": "Óleo",
                                "tipo_veiculo": "CAMINHAO"}, format="json")
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post("/api/planos-manutencao", {"descricao": "Óleo",
                                "tipo_veiculo": "CAMINHAO", "intervalo_km": 10000}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertIsNotNone(resp.data["id_plano"])


class LeituraTest(BaseTest):
    def test_km_nao_pode_diminuir_e_filtro(self):
        url = "/api/leituras-odometro"
        resp = self.client.post(url, {"placa_veiculo": "ABC1D23", "data_leitura": "2026-01-01",
                                      "quilometragem": 5000, "origem": "MANUAL"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        resp = self.client.post(url, {"placa_veiculo": "ABC1D23", "data_leitura": "2026-02-01",
                                      "quilometragem": 4000}, format="json")
        self.assertIn("quilometragem", resp.data)
        self.assertEqual(len(self.client.get(url + "?veiculo=ABC1D23").data), 1)
        self.assertEqual(len(self.client.get(url + "?veiculo=OUTRA00").data), 0)
        resp = self.client.get("/api/veiculos/ABC1D23")
        self.assertEqual(resp.data["km_atual"], 5000)


class OrdemServicoTest(BaseTest):
    url = "/api/ordens-servico"

    def abrir(self):
        return self.client.post(self.url, {"placa_veiculo": "ABC1D23", "descricao": "Revisão",
                                           "data_abertura": "2026-09-01"}, format="json")

    def test_fluxo_completo(self):
        resp = self.abrir()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["status"], "ABERTA")
        self.assertEqual(resp.data["email_emitente"], "g@a.com")
        numero = resp.data["numero"]

        # não pode concluir sem aprovar
        resp = self.client.patch(f"{self.url}/{numero}", {"status": "CONCLUIDA",
                                 "data_conclusao": "2026-09-03"}, format="json")
        self.assertEqual(resp.status_code, 400)

        resp = self.client.post(f"{self.url}/{numero}/aprovar")
        self.assertEqual(resp.data["status"], "APROVADA")
        self.assertEqual(resp.data["email_aprovador"], "g@a.com")

        resp = self.client.patch(f"{self.url}/{numero}", {"status": "CONCLUIDA",
                                 "data_conclusao": "2026-09-03", "valor": "350.00"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(self.client.get(f"{self.url}?veiculo=ABC1D23&status=CONCLUIDA").data[0]["numero"],
                         numero)

    def test_operador_nao_aprova(self):
        numero = self.abrir().data["numero"]
        self.client.force_authenticate(self.operador)
        self.assertEqual(self.client.post(f"{self.url}/{numero}/aprovar").status_code, 403)

    def test_conclusao_antes_da_abertura(self):
        numero = self.abrir().data["numero"]
        OrdemServico.objects.filter(pk=numero).update(status="APROVADA", aprovador=self.gestor)
        resp = self.client.patch(f"{self.url}/{numero}", {"status": "CONCLUIDA",
                                 "data_conclusao": "2026-08-01"}, format="json")
        self.assertIn("data_conclusao", resp.data)
