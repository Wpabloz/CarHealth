from datetime import date

from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse

from contas.models import Admin, Empresa

from .models import LeituraOdometro, Motorista, OrdemServico, PlanoManutencao, Veiculo

SENHA = "SenhaForte#2026"


class BaseTest(TestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(
            cnpj="11222333000181", razao_social="Empresa A", telefone="1", email="a@a.com")
        self.outra = Empresa.objects.create(
            cnpj="45723174000110", razao_social="Empresa B", telefone="1", email="b@b.com")
        self.gestor = Admin.objects.create_user("gestor@a.com", "Gestor", self.empresa, SENHA, "GESTOR")
        self.operador = Admin.objects.create_user("op@a.com", "Operador", self.empresa, SENHA)
        self.veiculo = Veiculo.objects.create(
            placa="ABC1D23", marca="Fiat", modelo="Strada", ano=2022, tipo="UTILITARIO",
            empresa=self.empresa)
        self.client.login(username="gestor@a.com", password=SENHA)


class MotoristaCrudTest(BaseTest):
    def test_crud_completo(self):
        dados = {"cpf": "529.982.247-25", "nome": "João", "telefone": "83999990000",
                 "num_cnh": "12345678901", "validade_cnh": "2027-05-10"}
        resp = self.client.post(reverse("frota:motorista_novo"), dados)
        self.assertRedirects(resp, reverse("frota:motorista_lista"))
        m = Motorista.objects.get(pk="52998224725")
        self.assertEqual(m.empresa, self.empresa)

        resp = self.client.get(reverse("frota:motorista_lista") + "?q=João")
        self.assertContains(resp, "João")

        dados["nome"] = "João Silva"
        self.client.post(reverse("frota:motorista_editar", args=[m.pk]), dados)
        m.refresh_from_db()
        self.assertEqual(m.nome, "João Silva")

        self.client.post(reverse("frota:motorista_excluir", args=[m.pk]))
        self.assertFalse(Motorista.objects.exists())

    def test_cpf_invalido(self):
        resp = self.client.post(reverse("frota:motorista_novo"), {
            "cpf": "12345678900", "nome": "X", "telefone": "1", "num_cnh": "1",
            "validade_cnh": "2027-01-01"})
        self.assertContains(resp, "CPF inválido")


class IsolamentoEmpresaTest(BaseTest):
    def test_nao_ve_nem_edita_dados_de_outra_empresa(self):
        alheio = Veiculo.objects.create(placa="XYZ9876", marca="VW", modelo="Gol", ano=2015,
                                        tipo="CARRO", empresa=self.outra)
        resp = self.client.get(reverse("frota:veiculo_lista"))
        self.assertContains(resp, "ABC1D23")
        self.assertNotContains(resp, "XYZ9876")
        self.assertEqual(self.client.get(reverse("frota:veiculo_editar", args=[alheio.pk])).status_code, 404)
        self.assertEqual(self.client.post(reverse("frota:veiculo_excluir", args=[alheio.pk])).status_code, 404)


class VeiculoTest(BaseTest):
    def test_cria_veiculo_normalizando_placa(self):
        self.client.post(reverse("frota:veiculo_novo"), {
            "placa": "abc-1234", "marca": "Ford", "modelo": "Ka", "ano": 2019,
            "tipo": "CARRO", "situacao": "ATIVO"})
        self.assertTrue(Veiculo.objects.filter(placa="ABC1234").exists())

    def test_nao_exclui_veiculo_com_historico(self):
        LeituraOdometro.objects.create(veiculo=self.veiculo, data_leitura=date(2026, 1, 1),
                                       quilometragem=100)
        resp = self.client.post(reverse("frota:veiculo_excluir", args=[self.veiculo.pk]), follow=True)
        self.assertContains(resp, "Não é possível excluir")
        self.assertTrue(Veiculo.objects.filter(pk=self.veiculo.pk).exists())

    def test_check_no_banco(self):
        with self.assertRaises(IntegrityError):
            Veiculo.objects.create(placa="AAA1111", marca="X", modelo="Y", ano=1800,
                                   tipo="CARRO", empresa=self.empresa)


class LeituraTest(BaseTest):
    def test_km_nao_pode_diminuir(self):
        LeituraOdometro.objects.create(veiculo=self.veiculo, data_leitura=date(2026, 1, 1),
                                       quilometragem=5000)
        resp = self.client.post(reverse("frota:leitura_novo"), {
            "veiculo": "ABC1D23", "data_leitura": "2026-02-01", "quilometragem": 4000,
            "origem": "MANUAL"})
        self.assertContains(resp, "menor que a última leitura")
        self.assertEqual(LeituraOdometro.objects.count(), 1)


class PlanoTest(BaseTest):
    def test_exige_algum_intervalo(self):
        resp = self.client.post(reverse("frota:plano_novo"), {
            "descricao": "Troca de óleo", "tipo_veiculo": "CARRO"})
        self.assertContains(resp, "Informe o intervalo")
        self.client.post(reverse("frota:plano_novo"), {
            "descricao": "Troca de óleo", "tipo_veiculo": "CARRO", "intervalo_km": 10000})
        self.assertEqual(PlanoManutencao.objects.get().empresa, self.empresa)


class OrdemServicoTest(BaseTest):
    def dados(self, **extra):
        base = {"veiculo": "ABC1D23", "descricao": "Revisão", "data_abertura": "2026-09-01",
                "status": "ABERTA"}
        base.update(extra)
        return base

    def test_abre_os_com_emitente(self):
        self.client.post(reverse("frota:ordem_novo"), self.dados())
        os_ = OrdemServico.objects.get()
        self.assertEqual(os_.emitente, self.gestor)
        self.assertIsNone(os_.aprovador)

    def test_operador_nao_aprova(self):
        self.client.login(username="op@a.com", password=SENHA)
        resp = self.client.post(reverse("frota:ordem_novo"), self.dados(status="APROVADA"))
        self.assertContains(resp, "Somente um Gestor")

    def test_gestor_aprova_e_conclui_gerando_leitura(self):
        self.client.post(reverse("frota:ordem_novo"), self.dados())
        os_ = OrdemServico.objects.get()
        self.client.post(reverse("frota:ordem_editar", args=[os_.pk]), self.dados(
            status="CONCLUIDA", data_conclusao="2026-09-03", quilometragem=12000, valor="350.00"))
        os_.refresh_from_db()
        self.assertEqual(os_.status, "CONCLUIDA")
        self.assertEqual(os_.aprovador, self.gestor)
        leitura = LeituraOdometro.objects.get()
        self.assertEqual((leitura.quilometragem, leitura.origem), (12000, "ORDEM_SERVICO"))

    def test_conclusao_antes_da_abertura(self):
        resp = self.client.post(reverse("frota:ordem_novo"), self.dados(
            status="CONCLUIDA", data_conclusao="2026-08-01"))
        self.assertContains(resp, "não pode ser antes da abertura")
