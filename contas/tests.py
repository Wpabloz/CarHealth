from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import Admin, Empresa
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

    def test_registrar_login_e_me(self):
        resp = self.registrar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertIn("access", resp.data)
        self.assertNotIn("password", resp.data["usuario"])
        self.assertEqual(resp.data["usuario"]["perfil"], "GESTOR")

        usuario = Admin.objects.get(email="sueli@sueli.com")
        self.assertTrue(usuario.password.startswith("bcrypt_sha256$"))  # hash bcrypt

        resp = self.client.post("/api/auth/login",
                                {"email": "sueli@sueli.com", "password": SENHA}, format="json")
        self.assertEqual(resp.status_code, 200)
        token = resp.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        resp = self.client.get("/api/auth/me")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["cnpj_empresa"], "11222333000181")

    def test_login_senha_errada(self):
        self.registrar()
        resp = self.client.post("/api/auth/login",
                                {"email": "sueli@sueli.com", "password": "errada"}, format="json")
        self.assertEqual(resp.status_code, 401)

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


class EmpresaUsuarioTest(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(cnpj="11222333000181", razao_social="A",
                                              telefone="1", email="a@a.com")
        Empresa.objects.create(cnpj="45723174000110", razao_social="B", telefone="1", email="b@b.com")
        self.gestor = Admin.objects.create_user("g@a.com", "Gestor", self.empresa, SENHA, "GESTOR")
        self.operador = Admin.objects.create_user("op@a.com", "Op", self.empresa, SENHA)
        self.client.force_authenticate(self.gestor)

    def test_empresa_so_a_propria(self):
        resp = self.client.get("/api/empresas")
        self.assertEqual([e["cnpj"] for e in resp.data], ["11222333000181"])
        self.assertEqual(self.client.get("/api/empresas/45723174000110").status_code, 404)

    def test_editar_empresa(self):
        resp = self.client.patch("/api/empresas/11222333000181",
                                 {"telefone": "8333334444"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.client.force_authenticate(self.operador)
        resp = self.client.patch("/api/empresas/11222333000181", {"telefone": "1"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_gestor_cria_usuario(self):
        resp = self.client.post("/api/usuarios", {"email": "Novo@A.com", "nome": "Novo",
                                                  "perfil": "OPERADOR", "password": SENHA},
                                format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Admin.objects.get(email="novo@a.com").empresa, self.empresa)
        self.assertEqual(self.client.delete("/api/usuarios/novo@a.com").status_code, 204)

    def test_operador_nao_gerencia_usuarios(self):
        self.client.force_authenticate(self.operador)
        self.assertEqual(self.client.get("/api/usuarios").status_code, 403)
