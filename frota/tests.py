from django.utils import timezone
from rest_framework.test import APITestCase

from contas.models import Empresa, Usuario

from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo

SENHA = "SenhaForte#2026"


class BaseTest(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(cnpj="11222333000181", razao_social="A",
                                              telefone="1", email="a@a.com")
        self.outra = Empresa.objects.create(cnpj="45723174000110", razao_social="B",
                                            telefone="1", email="b@b.com")
        self.gestor = Usuario.objects.create_user("g@a.com", SENHA, nome="Gestor",
                                                  empresa=self.empresa, perfil="GESTOR")
        self.joao = Motorista.objects.create(cpf="52998224725", nome="João", telefone="1",
                                             num_cnh="1", validade_cnh="2030-01-01", empresa=self.empresa)
        self.conta_joao = Usuario.objects.create_user("joao@a.com", SENHA, perfil="MOTORISTA",
                                                      empresa=self.empresa, motorista=self.joao)
        self.veiculo = Veiculo.objects.create(placa="ABC1D23", marca="VW", modelo="Delivery",
                                              ano=2020, tipo="CAMINHAO", empresa=self.empresa)
        self.client.force_authenticate(self.gestor)

    def como_motorista(self):
        self.client.force_authenticate(self.conta_joao)

    def ler(self, km, **extra):
        return self.client.post("/api/leituras-odometro",
                                {"placa_veiculo": "ABC1D23", "quilometragem": km, **extra}, format="json")


class MotoristaTest(BaseTest):
    def test_crud_completo(self):
        dados = {"cpf": "11144477735", "nome": "Maria", "telefone": "83999990000",
                 "num_cnh": "12345678901", "validade_cnh": "2027-05-10"}
        resp = self.client.post("/api/motoristas", dados, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["cnpj_empresa"], "11222333000181")
        self.assertEqual(resp.data["situacao"], "ATIVO")
        self.assertIsNone(resp.data["email_acesso"])

        self.assertEqual(len(self.client.get("/api/motoristas").data), 2)
        dados["nome"] = "Maria Silva"
        resp = self.client.put("/api/motoristas/11144477735", dados, format="json")
        self.assertEqual(resp.data["nome"], "Maria Silva")
        resp = self.client.patch("/api/motoristas/11144477735", {"cpf": "52998224725"}, format="json")
        self.assertEqual(resp.status_code, 400)  # chave primária não muda
        self.assertEqual(self.client.delete("/api/motoristas/11144477735").status_code, 204)

    def test_cpf_invalido_cnh_duplicada_e_vencida(self):
        resp = self.client.post("/api/motoristas", {"cpf": "12345678900", "nome": "X", "telefone": "1",
                                "num_cnh": "9", "validade_cnh": "2027-01-01"}, format="json")
        self.assertIn("cpf", resp.data)
        resp = self.client.post("/api/motoristas", {"cpf": "11144477735", "nome": "X", "telefone": "1",
                                "num_cnh": "1", "validade_cnh": "2027-01-01"}, format="json")
        self.assertIn("num_cnh", resp.data)
        Motorista.objects.filter(pk="52998224725").update(validade_cnh="2020-01-01")
        self.assertTrue(self.client.get("/api/motoristas/52998224725").data["cnh_vencida"])

    def test_liberar_acesso_no_cadastro(self):
        """CA27: o gestor informa e-mail e senha inicial, e o motorista consegue entrar."""
        resp = self.client.post("/api/motoristas", {"cpf": "11144477735", "nome": "Maria", "telefone": "1",
                                "num_cnh": "2", "validade_cnh": "2030-01-01",
                                "email_acesso": "Maria@A.com", "senha_inicial": SENHA}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["email_acesso"], "maria@a.com")
        self.assertNotIn("senha_inicial", resp.data)
        self.client = self.client_class()  # sem login: entra só com o e-mail e a senha novos
        resp = self.client.post("/api/auth/login", {"email": "maria@a.com", "password": SENHA}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        me = self.client.get("/api/auth/me").data
        self.assertEqual((me["perfil"], me["nome"], me["cpf_motorista"]), ("MOTORISTA", "Maria", "11144477735"))

    def test_motorista_inativo_nao_entra(self):
        Motorista.objects.filter(pk="52998224725").update(situacao="INATIVO")
        resp = self.client.post("/api/auth/login", {"email": "joao@a.com", "password": SENHA}, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_nao_exclui_com_historico(self):
        resp = self.client.delete("/api/motoristas/52998224725")  # tem conta de acesso
        self.assertEqual(resp.status_code, 409)
        self.assertIn("INATIVO", resp.data["detail"])

    def test_perfil_motorista_nao_ve_cadastro(self):
        self.como_motorista()
        self.assertEqual(self.client.get("/api/motoristas").status_code, 403)


class VeiculoTest(BaseTest):
    def test_cadastrar_listar_filtrar(self):
        resp = self.client.post("/api/veiculos", {"placa": "abc-1234", "marca": "Ford", "modelo": "Cargo",
                                "ano": 2019, "tipo": " guincho "}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual((resp.data["placa"], resp.data["tipo"], resp.data["situacao"]),
                         ("ABC1234", "GUINCHO", "ATIVO"))
        self.assertIsNone(resp.data["km_atual"])  # sem registro (RN19)
        self.assertEqual(len(self.client.get("/api/veiculos").data), 2)
        self.assertEqual([v["placa"] for v in self.client.get("/api/veiculos?placa=1d2").data], ["ABC1D23"])
        self.assertEqual([v["placa"] for v in self.client.get("/api/veiculos?tipo=guincho").data], ["ABC1234"])
        self.assertEqual(self.client.get("/api/veiculos/tipos").data, ["CAMINHAO", "GUINCHO"])

    def test_ano_invalido(self):
        resp = self.client.post("/api/veiculos", {"placa": "AAA1111", "marca": "X", "modelo": "Y",
                                "ano": 1800, "tipo": "CARRO"}, format="json")
        self.assertIn("ano", resp.data)

    def test_isolamento_entre_empresas(self):
        Veiculo.objects.create(placa="XYZ9876", marca="VW", modelo="Gol", ano=2015,
                               tipo="CARRO", empresa=self.outra)
        self.assertEqual([v["placa"] for v in self.client.get("/api/veiculos").data], ["ABC1D23"])
        self.assertEqual(self.client.get("/api/veiculos/XYZ9876").status_code, 404)
        self.assertEqual(self.client.delete("/api/veiculos/XYZ9876").status_code, 404)

    def test_nao_exclui_veiculo_com_historico(self):
        self.ler(100)
        self.assertEqual(self.client.delete("/api/veiculos/ABC1D23").status_code, 409)
        resp = self.client.patch("/api/veiculos/ABC1D23", {"situacao": "INATIVO"}, format="json")
        self.assertEqual(resp.status_code, 200)

    def test_motorista_so_ve_ativos_e_nao_cadastra(self):
        """CA23 e CA26."""
        Veiculo.objects.create(placa="INA0000", marca="VW", modelo="Gol", ano=2015, tipo="CARRO",
                               situacao="INATIVO", empresa=self.empresa)
        self.como_motorista()
        self.assertEqual([v["placa"] for v in self.client.get("/api/veiculos").data], ["ABC1D23"])
        self.assertEqual(self.client.get("/api/veiculos/INA0000").status_code, 404)
        resp = self.client.post("/api/veiculos", {"placa": "AAA1111", "marca": "X", "modelo": "Y",
                                "ano": 2020, "tipo": "CARRO"}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(self.client.patch("/api/veiculos/ABC1D23", {"marca": "X"}, format="json").status_code, 403)


class PlanoTest(BaseTest):
    def test_exige_algum_intervalo(self):
        resp = self.client.post("/api/planos-manutencao", {"descricao": "Óleo",
                                "tipo_veiculo": "CAMINHAO"}, format="json")
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post("/api/planos-manutencao", {"descricao": "Óleo", "tipo_veiculo": "caminhao",
                                "intervalo_km": 10000}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual((resp.data["tipo_veiculo"], resp.data["situacao"]), ("CAMINHAO", "ATIVO"))

    def test_motorista_nao_acessa(self):
        self.como_motorista()
        self.assertEqual(self.client.get("/api/planos-manutencao").status_code, 403)


class LeituraTest(BaseTest):
    def test_registro_manual(self):
        """CA01: data de hoje, origem manual e o usuário logado como responsável."""
        self.como_motorista()
        resp = self.ler(5000)
        self.assertEqual(resp.status_code, 201, resp.data)
        leitura = LeituraOdometro.objects.get(pk=resp.data["codigo"])
        self.assertEqual((leitura.origem, leitura.usuario, leitura.data_leitura),
                         ("MANUAL", self.conta_joao, timezone.localdate()))
        self.assertNotIn("email_usuario", resp.data)  # o motorista não vê quem lançou
        self.client.force_authenticate(self.gestor)
        self.assertEqual(self.client.get(f"/api/leituras-odometro/{leitura.pk}").data["email_usuario"],
                         "joao@a.com")
        self.assertEqual(self.client.get("/api/veiculos/ABC1D23").data["km_atual"], 5000)

    def test_km_nao_pode_diminuir_e_filtro(self):
        """CA02 e CA03: só o ajuste de odômetro aceita valor menor."""
        self.ler(91200)
        resp = self.ler(90000)
        self.assertIn("91200 km", resp.data["quilometragem"][0])
        resp = self.ler(400, origem="AJUSTE_ODOMETRO")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(self.client.get("/api/veiculos/ABC1D23").data["km_atual"], 400)
        self.assertEqual(len(self.client.get("/api/leituras-odometro?veiculo=abc1d23").data), 2)
        self.assertEqual(len(self.client.get("/api/leituras-odometro?veiculo=OUTRA00").data), 0)

    def test_motorista_nao_ajusta_odometro(self):
        """CA18: a recusa orienta a avisar o gestor."""
        self.ler(91200)
        self.como_motorista()
        self.assertIn("avise o gestor", self.ler(90000).data["quilometragem"][0])
        self.assertIn("origem", self.ler(400, origem="AJUSTE_ODOMETRO").data)

    def test_origem_ordem_servico_so_pelo_sistema(self):
        self.assertIn("origem", self.ler(100, origem="ORDEM_SERVICO").data)

    def test_motorista_e_veiculo_inativo(self):
        Veiculo.objects.filter(pk="ABC1D23").update(situacao="INATIVO")
        self.como_motorista()
        self.assertIn("placa_veiculo", self.ler(100).data)


class OrdemServicoTest(BaseTest):
    url = "/api/ordens-servico"

    def abrir(self, **extra):
        return self.client.post(self.url, {"placa_veiculo": "ABC1D23", "descricao": "Revisão",
                                           "data_abertura": "2026-09-01", **extra}, format="json")

    def concluir(self, numero, **dados):
        return self.client.post(f"{self.url}/{numero}/concluir", dados, format="json")

    def test_numero_sequencial_por_empresa(self):
        self.assertEqual([self.abrir().data["numero"] for _ in range(2)], [1, 2])
        gestor_b = Usuario.objects.create_user("g@b.com", SENHA, nome="B", empresa=self.outra, perfil="GESTOR")
        Veiculo.objects.create(placa="XYZ9876", marca="VW", modelo="Gol", ano=2015, tipo="CARRO",
                               empresa=self.outra)
        self.client.force_authenticate(gestor_b)
        resp = self.client.post(self.url, {"placa_veiculo": "XYZ9876", "descricao": "X"}, format="json")
        self.assertEqual((resp.data["numero"], resp.data["data_abertura"]), (1, str(timezone.localdate())))
        self.assertEqual(self.client.get(f"{self.url}/2").status_code, 404)  # a nº 2 é da outra empresa

    def test_fluxo_concluir(self):
        """CA10, CA12 e CA13."""
        resp = self.abrir()
        self.assertEqual((resp.data["status"], resp.data["email_emitente"]), ("ABERTA", "g@a.com"))
        self.ler(91200)

        resp = self.concluir(1)
        self.assertEqual(set(resp.data), {"data_conclusao", "quilometragem", "valor"})
        resp = self.concluir(1, data_conclusao="2026-09-03", quilometragem=90000, valor="350.00")
        self.assertIn("91200 km", resp.data["quilometragem"][0])

        resp = self.concluir(1, data_conclusao="2026-09-03", quilometragem=91500,
                             valor="350.00", oficina="Oficina do Zé")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], "CONCLUIDA")
        self.assertIsNone(resp.data["email_aprovador"])  # sem aprovação no MVP
        leitura = LeituraOdometro.objects.order_by("-codigo").first()
        self.assertEqual((leitura.quilometragem, leitura.origem, leitura.usuario),
                         (91500, "ORDEM_SERVICO", self.gestor))

        self.assertEqual(self.concluir(1, data_conclusao="2026-09-04", quilometragem=91600,
                                       valor="1").status_code, 400)  # já concluída
        self.assertEqual(self.client.post(f"{self.url}/1/cancelar").status_code, 400)
        self.assertEqual(self.client.patch(f"{self.url}/1", {"descricao": "X"}, format="json").status_code, 400)

    def test_cancelar_e_sem_delete(self):
        self.abrir()
        resp = self.client.post(f"{self.url}/1/cancelar")
        self.assertEqual(resp.data["status"], "CANCELADA")
        self.assertEqual(self.client.delete(f"{self.url}/1").status_code, 405)
        self.assertTrue(OrdemServico.objects.exists())

    def test_status_so_muda_pelas_acoes(self):
        self.abrir()
        self.client.patch(f"{self.url}/1", {"status": "CONCLUIDA"}, format="json")
        self.assertEqual(OrdemServico.objects.get().status, "ABERTA")

    def test_plano_da_ordem(self):
        plano = PlanoManutencao.objects.create(descricao="Óleo", tipo_veiculo="CARRO", intervalo_km=1000,
                                               empresa=self.empresa)
        self.assertIn("id_plano", self.abrir(id_plano=plano.pk).data)  # plano de outro tipo
        PlanoManutencao.objects.filter(pk=plano.pk).update(tipo_veiculo="CAMINHAO", situacao="INATIVO")
        self.assertIn("id_plano", self.abrir(id_plano=plano.pk).data)  # plano inativo
        PlanoManutencao.objects.filter(pk=plano.pk).update(situacao="ATIVO")
        self.assertEqual(self.abrir(id_plano=plano.pk).status_code, 201)

    def test_motorista_so_consulta_historico(self):
        """CA11 e CA25: não abre, conclui nem cancela; vê só as concluídas, sem o valor."""
        self.abrir()
        self.abrir()
        self.concluir(1, data_conclusao="2026-09-03", quilometragem=100, valor="350.00")
        self.como_motorista()
        resp = self.client.get(self.url)
        self.assertEqual([o["numero"] for o in resp.data], [1])
        self.assertNotIn("valor", resp.data[0])
        self.assertEqual(self.abrir().status_code, 403)
        self.assertEqual(self.client.post(f"{self.url}/2/cancelar").status_code, 403)
        self.assertEqual(self.concluir(2, data_conclusao="2026-09-03", quilometragem=100,
                                       valor="1").status_code, 403)
