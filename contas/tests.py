from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from .models import Admin, Empresa
from .validators import validar_cnpj, validar_cpf, validar_placa


class ValidadoresTest(TestCase):
    def test_documentos(self):
        validar_cpf("529.982.247-25")
        validar_cnpj("11.222.333/0001-81")
        validar_placa("ABC1D23")
        validar_placa("ABC-1234")
        for funcao, valor in [(validar_cpf, "11111111111"), (validar_cpf, "52998224724"),
                              (validar_cnpj, "11222333000180"), (validar_placa, "AB12345")]:
            with self.assertRaises(ValidationError):
                funcao(valor)


class AutenticacaoTest(TestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(
            cnpj="11222333000181", razao_social="Transportes X", telefone="8399999999",
            email="contato@x.com",
        )
        self.gestor = Admin.objects.create_user(
            "gestor@x.com", "Gestor", self.empresa, "SenhaForte#2026", perfil="GESTOR"
        )

    def test_senha_gravada_como_hash(self):
        self.assertNotEqual(self.gestor.password, "SenhaForte#2026")
        self.assertTrue(self.gestor.password.startswith("pbkdf2_sha256$"))

    def test_login_e_logout(self):
        resp = self.client.post(reverse("contas:login"),
                                {"username": "GESTOR@x.com", "password": "SenhaForte#2026"})
        self.assertRedirects(resp, reverse("frota:dashboard"))
        self.client.post(reverse("contas:logout"))
        resp = self.client.get(reverse("frota:dashboard"))
        self.assertEqual(resp.status_code, 302)

    def test_login_senha_errada(self):
        resp = self.client.post(reverse("contas:login"),
                                {"username": "gestor@x.com", "password": "errada"})
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_paginas_exigem_login(self):
        resp = self.client.get(reverse("frota:veiculo_lista"))
        self.assertRedirects(resp, reverse("contas:login") + "?next=/veiculos/")

    def test_cadastro_empresa_cria_gestor_e_loga(self):
        resp = self.client.post(reverse("contas:cadastro"), {
            "cnpj": "45.723.174/0001-10", "razao_social": "Nova Frota", "telefone": "83988887777",
            "email": "frota@nova.com", "nome": "Ana", "email_usuario": "ana@nova.com",
            "senha": "OutraSenha#99", "confirmar_senha": "OutraSenha#99",
        })
        self.assertRedirects(resp, reverse("frota:dashboard"))
        ana = Admin.objects.get(email="ana@nova.com")
        self.assertEqual(ana.perfil, "GESTOR")
        self.assertEqual(ana.empresa_id, "45723174000110")

    def test_operador_nao_gerencia_usuarios(self):
        Admin.objects.create_user("op@x.com", "Op", self.empresa, "SenhaForte#2026")
        self.client.login(username="op@x.com", password="SenhaForte#2026")
        self.assertEqual(self.client.get(reverse("contas:usuarios")).status_code, 403)
