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


class MeuPerfilTest(BaseContas):
    """O próprio usuário edita o nome (gestor) e troca a senha (gestor e motorista)."""

    def test_gestor_muda_o_nome(self):
        resp = self.client.patch("/api/auth/me", {"nome": "  Gestor Novo ", "perfil": "MOTORISTA"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual((resp.data["nome"], resp.data["perfil"]), ("Gestor Novo", "GESTOR"))  # perfil não muda
        self.assertIn("nome", self.client.patch("/api/auth/me", {"nome": " "}, format="json").data)

    def test_motorista_nao_muda_o_nome_pela_conta(self):
        conta = Usuario.objects.create_user("m@a.com", SENHA, perfil="MOTORISTA", empresa=self.empresa,
                                            motorista=self.motorista)
        self.client.force_authenticate(conta)
        self.assertIn("nome", self.client.patch("/api/auth/me", {"nome": "Outro"}, format="json").data)

    def test_trocar_senha(self):
        url = "/api/auth/senha"
        self.assertIn("senha_atual", self.client.post(url, {"senha_atual": "errada", "nova_senha": "Nova#Senha2026"},
                                                      format="json").data)
        self.assertIn("nova_senha", self.client.post(url, {"senha_atual": SENHA, "nova_senha": "123"},
                                                     format="json").data)
        self.assertIn("nova_senha", self.client.post(url, {"senha_atual": SENHA, "nova_senha": SENHA},
                                                     format="json").data)
        resp = self.client.post(url, {"senha_atual": SENHA, "nova_senha": "Nova#Senha2026"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(set(resp.data), {"access", "refresh"})  # esta sessão continua com tokens novos
        self.client = self.client_class()  # sem login: entra só com e-mail e senha
        login = lambda senha: self.client.post("/api/auth/login", {"email": "g@a.com", "password": senha},  # noqa: E731
                                               format="json").status_code
        self.assertEqual((login(SENHA), login("Nova#Senha2026")), (401, 200))


class SessaoTest(BaseContas):
    """Tokens: sair revoga, renovar troca o refresh, trocar a senha derruba as sessões, inatividade (RF02)."""

    def setUp(self):
        super().setUp()
        self.client = self.client_class()  # aqui vale o token de verdade, sem force_authenticate

    def entrar(self, senha=SENHA):
        resp = self.client.post("/api/auth/login", {"email": "g@a.com", "password": senha}, format="json")
        self.assertEqual(resp.status_code, 200)
        return resp.data

    def me(self, access):
        return self.client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Bearer {access}").status_code

    def renovar(self, refresh):
        return self.client.post("/api/auth/refresh", {"refresh": refresh}, format="json")

    def test_sair_revoga_o_refresh(self):
        tokens = self.entrar()
        self.assertEqual(self.client.post("/api/auth/sair", {"refresh": tokens["refresh"]}, format="json").status_code, 200)
        self.assertEqual(self.renovar(tokens["refresh"]).status_code, 401)

    def test_renovar_troca_o_refresh(self):
        tokens = self.entrar()
        novo = self.renovar(tokens["refresh"])
        self.assertEqual(novo.status_code, 200)
        self.assertNotEqual(novo.data["refresh"], tokens["refresh"])
        self.assertEqual(self.renovar(tokens["refresh"]).status_code, 401)  # o antigo não vale mais
        self.assertEqual(self.me(novo.data["access"]), 200)

    def test_trocar_a_senha_derruba_as_outras_sessoes(self):
        celular, computador = self.entrar(), self.entrar()
        resp = self.client.post("/api/auth/senha", {"senha_atual": SENHA, "nova_senha": "Nova#Senha2026"},
                                format="json", HTTP_AUTHORIZATION=f"Bearer {computador['access']}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.me(celular["access"]), 401)  # o access da outra sessão caiu na hora
        self.assertEqual(self.me(computador["access"]), 401)
        self.assertEqual(self.renovar(celular["refresh"]).status_code, 401)
        self.assertEqual(self.me(resp.data["access"]), 200)  # quem trocou continua, com tokens novos

    def test_gestor_redefine_senha_e_a_sessao_do_usuario_cai(self):
        outro = Usuario.objects.create_user("o@a.com", SENHA, nome="Outro", empresa=self.empresa, perfil="GESTOR")
        sessao = self.client.post("/api/auth/login", {"email": "o@a.com", "password": SENHA}, format="json").data
        gestor = self.entrar()
        self.client.patch("/api/usuarios/o@a.com", {"password": "Redefinida#2026"}, format="json",
                          HTTP_AUTHORIZATION=f"Bearer {gestor['access']}")
        self.assertEqual(self.me(sessao["access"]), 401)
        self.assertEqual(self.renovar(sessao["refresh"]).status_code, 401)
        self.assertTrue(Usuario.objects.get(pk=outro.pk).check_password("Redefinida#2026"))

    def test_janela_de_inatividade(self):
        from django.conf import settings
        from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

        tokens = self.entrar()
        refresh, access = RefreshToken(tokens["refresh"]), AccessToken(tokens["access"])
        self.assertEqual(refresh["exp"] - refresh["iat"], settings.SESSAO_INATIVIDADE_MINUTOS * 60)
        self.assertEqual(access["exp"] - access["iat"], min(15, settings.SESSAO_INATIVIDADE_MINUTOS) * 60)
