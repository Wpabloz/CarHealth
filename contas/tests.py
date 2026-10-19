from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase

from frota.models import Motorista

from .models import Empresa, Usuario
from .validators import validar_cnpj, validar_cpf, validar_placa

SENHA = "SenhaForte#2026"


class ValidadoresTest(TestCase):
    def test_documentos(self):
        validar_cpf("52998224725")
        validar_cnpj("11222333000181")
        validar_placa("ABC1D23")
        validar_placa("ABC-1234")
        for funcao, valor in [(validar_cpf, "11111111111"), (validar_cpf, "52998224724"),
                              (validar_cnpj, "11222333000180"), (validar_placa, "AB12345")]:
            with self.assertRaises(ValidationError):
                funcao(valor)


class AuthTest(APITestCase):
    def registrar(self, **extra):
        dados = {
            "empresa": {"cnpj": "11222333000181", "razao_social": "Reboques Sueli",
                        "telefone": "83999990000", "email": "contato@sueli.com"},
            "nome": "Sueli Gomes", "email": "sueli@sueli.com", "password": SENHA,
        }
        dados.update(extra)
        return self.client.post("/api/auth/registrar", dados, format="json")

    def login(self, email, senha=SENHA):
        return self.client.post("/api/auth/login", {"email": email, "password": senha}, format="json")

    def test_registrar_login_e_me(self):
        resp = self.registrar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertIn("access", resp.data)
        self.assertNotIn("password", resp.data["usuario"])
        self.assertEqual(resp.data["usuario"]["perfil"], "GESTOR")
        self.assertEqual(resp.data["usuario"]["situacao"], "ATIVO")

        usuario = Usuario.objects.get(email="sueli@sueli.com")
        self.assertTrue(usuario.password.startswith("bcrypt_sha256$"))  # hash bcrypt

        resp = self.login("sueli@sueli.com")
        self.assertEqual(resp.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        resp = self.client.get("/api/auth/me")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["cnpj_empresa"], "11222333000181")

    def test_login_senha_errada(self):
        self.registrar()
        self.assertEqual(self.login("sueli@sueli.com", "errada").status_code, 401)

    def test_rota_protegida_sem_token(self):
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.assertEqual(self.client.get("/api/veiculos").status_code, 401)

    def test_registrar_valida_dados(self):
        resp = self.registrar(password="123")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("password", resp.data)
        resp = self.registrar(empresa={"cnpj": "11222333000180", "razao_social": "X",
                                       "telefone": "1", "email": "x@x.com"})
        self.assertIn("cnpj", resp.data["empresa"])

    def test_registrar_duplicado(self):
        self.registrar()
        resp = self.registrar(email="outro@sueli.com")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("cnpj", resp.data["empresa"])

    def test_conta_inativa_nao_entra(self):
        """CA28: conta inativada não faz login, e o token que já tinha deixa de valer."""
        token = self.registrar().data["access"]
        Usuario.objects.filter(email="sueli@sueli.com").update(situacao="INATIVO")
        self.assertEqual(self.login("sueli@sueli.com").status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)


class BaseContas(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(cnpj="11222333000181", razao_social="A",
                                              telefone="1", email="a@a.com")
        self.outra = Empresa.objects.create(cnpj="45723174000110", razao_social="B",
                                            telefone="1", email="b@b.com")
        self.gestor = Usuario.objects.create_user("g@a.com", SENHA, nome="Gestor",
                                                  empresa=self.empresa, perfil="GESTOR")
        self.motorista = Motorista.objects.create(cpf="52998224725", nome="João", telefone="1",
                                                  num_cnh="1", validade_cnh="2030-01-01",
                                                  empresa=self.empresa)
        self.client.force_authenticate(self.gestor)

    def criar_usuario(self, **dados):
        return self.client.post("/api/usuarios", {"password": SENHA, **dados}, format="json")


class EmpresaTest(BaseContas):
    def test_empresa_so_a_propria(self):
        resp = self.client.get("/api/empresas")
        self.assertEqual([e["cnpj"] for e in resp.data], ["11222333000181"])
        self.assertEqual(self.client.get("/api/empresas/45723174000110").status_code, 404)

    def test_editar_empresa(self):
        resp = self.client.patch("/api/empresas/11222333000181", {"telefone": "8333334444"}, format="json")
        self.assertEqual(resp.status_code, 200)
        conta = Usuario.objects.create_user("m@a.com", SENHA, perfil="MOTORISTA",
                                            empresa=self.empresa, motorista=self.motorista)
        self.client.force_authenticate(conta)
        resp = self.client.patch("/api/empresas/11222333000181", {"telefone": "1"}, format="json")
        self.assertEqual(resp.status_code, 403)


class UsuarioTest(BaseContas):
    def test_gestor_cria_edita_e_exclui_gestor(self):
        resp = self.criar_usuario(email="Novo@A.com", nome="Novo", perfil="GESTOR")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Usuario.objects.get(email="novo@a.com").empresa, self.empresa)
        resp = self.client.patch("/api/usuarios/novo@a.com", {"nome": "Novo Nome"}, format="json")
        self.assertEqual(resp.data["nome"], "Novo Nome")
        self.assertEqual(self.client.delete("/api/usuarios/novo@a.com").status_code, 204)

    def test_conta_de_motorista(self):
        """RN18: o perfil MOTORISTA exige o CPF de um motorista da empresa; o nome vem do cadastro."""
        self.assertIn("cpf_motorista", self.criar_usuario(email="m@a.com", perfil="MOTORISTA").data)
        resp = self.criar_usuario(email="m@a.com", perfil="MOTORISTA", cpf_motorista="52998224725",
                                  nome="Ignorado")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["nome"], "João")
        self.assertIsNone(Usuario.objects.get(email="m@a.com").nome)  # não copia o nome

        # cada motorista tem uma única conta
        resp = self.criar_usuario(email="m2@a.com", perfil="MOTORISTA", cpf_motorista="52998224725")
        self.assertIn("cpf_motorista", resp.data)

    def test_regras_do_vinculo(self):
        resp = self.criar_usuario(email="x@a.com", nome="X", perfil="GESTOR", cpf_motorista="52998224725")
        self.assertIn("cpf_motorista", resp.data)  # gestor não tem motorista vinculado
        alheio = Motorista.objects.create(cpf="11144477735", nome="Z", telefone="1", num_cnh="2",
                                          validade_cnh="2030-01-01", empresa=self.outra)
        resp = self.criar_usuario(email="y@a.com", perfil="MOTORISTA", cpf_motorista=alheio.cpf)
        self.assertIn("cpf_motorista", resp.data)  # motorista de outra empresa
        self.assertIn("nome", self.criar_usuario(email="z@a.com", perfil="GESTOR").data)

    def test_nao_inativa_a_si_mesmo(self):
        resp = self.client.patch("/api/usuarios/g@a.com", {"situacao": "INATIVO"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(self.client.delete("/api/usuarios/g@a.com").status_code, 400)

    def test_motorista_nao_gerencia_usuarios(self):
        conta = Usuario.objects.create_user("m@a.com", SENHA, perfil="MOTORISTA",
                                            empresa=self.empresa, motorista=self.motorista)
        self.client.force_authenticate(conta)
        self.assertEqual(self.client.get("/api/usuarios").status_code, 403)
        self.assertEqual(self.client.get("/api/auth/me").data["nome"], "João")
