"""
python manage.py popular_demo

Cria uma empresa de demonstração (Reboques Silva) com gestor, motoristas,
guinchos, planos, leituras de odômetro e ordens de serviço, para apresentar o
sistema sem precisar cadastrar tudo à mão. As datas são calculadas a partir de
hoje, então o painel sempre mostra a mesma mistura de situações:

  Guincho 01 -> EM DIA
  Guincho 02 -> VENCIDA (troca de óleo passou da km) e PRÓXIMA (alinhamento); placa RSV-2B47,
                como nas telas do motorista no Figma, com o aviso "Barulho ao frear" do Marcos
  Guincho 03 -> PRÓXIMA (revisão do guincho vence em ~20 dias)
  Guincho 04 -> INATIVO (fora do painel, mas com histórico)

Para apagar a demonstração e criar de novo: python manage.py popular_demo --recriar
Para criar só se ainda não existir:          python manage.py popular_demo --manter
"""
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from contas.models import Empresa, Situacao, Usuario
from frota.manutencao import somar_meses
from frota.models import (Checkin, CienciaAviso, LeituraOdometro, Motorista, OrdemServico, PlanoManutencao,
                          Problema, Veiculo)

CNPJ = "12345678000195"
SENHA = "carhealth2026"
GESTOR = "silvana@reboquessilva.com.br"
MOTORISTA = "marcos@reboquessilva.com.br"


class Command(BaseCommand):
    help = "Cria dados de demonstração (empresa Reboques Silva, guinchos, planos e ordens de serviço)."

    def add_arguments(self, parser):
        parser.add_argument("--recriar", action="store_true",
                            help="Apaga a empresa de demonstração (e tudo dela) antes de criar de novo.")
        parser.add_argument("--manter", action="store_true",
                            help="Se a demonstração já existir, não faz nada (usado pelo iniciar_backend.bat).")

    @transaction.atomic
    def handle(self, *args, **opcoes):
        if Empresa.objects.filter(pk=CNPJ).exists():
            # Demonstração de uma versão anterior (antes das telas do Figma): recria sozinha
            antiga = not Veiculo.objects.filter(pk="RSV2B47", empresa_id=CNPJ).exists()
            if opcoes["manter"] and not opcoes["recriar"] and not antiga:
                self.stdout.write("Demonstração já existe; mantida como está.")
                return
            if antiga and opcoes["manter"]:
                self.stdout.write("Demonstração de uma versão anterior: criando de novo.")
                opcoes["recriar"] = True
            if not opcoes["recriar"]:
                raise CommandError("A demonstração já existe. Use --recriar para apagar e criar de novo.")
            self.apagar()

        hoje = timezone.localdate()
        self.hoje = hoje
        self.leituras = []  # (data, veiculo, km, origem, usuario) — gravadas no fim, em ordem de data
        self.ordens = []    # ordens de serviço — numeradas no fim, em ordem de abertura (RF23)

        empresa = Empresa.objects.create(cnpj=CNPJ, razao_social="Reboques Silva Ltda",
                                         telefone="11987654321", email="contato@reboquessilva.com.br")
        gestor = Usuario.objects.create_user(GESTOR, SENHA, nome="Silvana Silva",
                                             perfil=Usuario.Perfil.GESTOR, empresa=empresa)
        self.gestor = gestor

        marcos = Motorista.objects.create(cpf="52998224725", nome="Marcos Oliveira", telefone="11991234567",
                                          num_cnh="04512378901", validade_cnh=hoje + timedelta(days=730),
                                          empresa=empresa)
        Motorista.objects.create(cpf="34786512044", nome="Paulo Henrique Santos", telefone="11998765432",
                                 num_cnh="07788990011", validade_cnh=hoje + timedelta(days=400), empresa=empresa)
        Motorista.objects.create(cpf="71829345664", nome="Rafael Lima", telefone="11993456789",
                                 num_cnh="03344556677", validade_cnh=hoje + timedelta(days=200),
                                 situacao=Situacao.INATIVO, empresa=empresa)
        conta_marcos = Usuario.objects.create_user(MOTORISTA, SENHA, nome="Marcos Oliveira",
                                                   perfil=Usuario.Perfil.MOTORISTA, empresa=empresa,
                                                   motorista=marcos)
        self.marcos = conta_marcos

        def veiculo(placa, ident, marca, modelo, ano, obs, situacao=Situacao.ATIVO):
            return Veiculo.objects.create(placa=placa, identificacao=ident, marca=marca, modelo=modelo, ano=ano,
                                          tipo="GUINCHO", observacoes=obs, situacao=situacao, empresa=empresa)

        g1 = veiculo("RHG1A23", "Guincho 01", "Volkswagen", "Delivery 11.180", 2021, "Plataforma hidráulica")
        g2 = veiculo("RSV2B47", "Guincho 02", "Ford", "Cargo 816", 2019, "Asa-delta com lança")
        g3 = veiculo("PLK3C67", "Guincho 03", "Mercedes-Benz", "Accelo 815", 2020, "Plataforma hidráulica")
        g4 = veiculo("KMB4521", "Guincho 04", "Ford", "F-4000", 2008, "Vendido; mantido pelo histórico",
                     situacao=Situacao.INATIVO)

        def plano(descricao, km, meses):
            return PlanoManutencao.objects.create(descricao=descricao, tipo_veiculo="GUINCHO", intervalo_km=km,
                                                  intervalo_meses=meses, empresa=empresa)

        oleo = plano("Troca de óleo", 10000, 6)
        freios = plano("Revisão de freios", 20000, 12)
        hidraulico = plano("Revisão do guincho", None, 12)
        alinhamento = plano("Alinhamento dos pneus", 10000, None)

        dias = lambda n: hoje - timedelta(days=n)  # noqa: E731
        meses = lambda n: somar_meses(hoje, -n)  # noqa: E731

        # Guincho 01 — tudo em dia
        self.concluida(g1, freios, "Revisão de freios", meses(4), 55000, "1980.00", "Freios & Cia")
        self.concluida(g1, hidraulico, "Revisão do guincho", meses(5), 53200, "1750.00", "HidroPeças")
        self.concluida(g1, oleo, "Troca de óleo", meses(2), 60000, "820.00", "Diesel Center")
        self.concluida(g1, alinhamento, "Alinhamento dos pneus", meses(2), 60000, "310.00", "Diesel Center")
        self.concluida(g1, None, "Troca da bateria (descarregando de manhã)", dias(2), 63100, "690.00",
                       "Auto Elétrica Brasil")
        self.leitura(g1, dias(1), 63500, conta_marcos)

        # Guincho 02 — troca de óleo VENCIDA por km, alinhamento PRÓXIMO, OS aberta para o óleo
        self.concluida(g2, freios, "Revisão de freios", meses(8), 165000, "2350.00", "Freios & Cia")
        self.concluida(g2, oleo, "Troca de óleo", meses(5), 171900, "860.00", "Diesel Center")
        self.concluida(g2, alinhamento, "Alinhamento dos pneus", meses(4), 173000, "320.00", "Diesel Center")
        self.concluida(g2, hidraulico, "Revisão do guincho", meses(3), 175400, "1820.00", "HidroPeças")
        self.leitura(g2, dias(12), 180200, gestor)
        self.leitura(g2, dias(0), 182615, conta_marcos)
        self.aberta(g2, oleo, "Troca de óleo (agendada)", dias(0), "Diesel Center")

        # Guincho 03 — revisão do hidráulico PRÓXIMA (vence em ~20 dias); alinhamento sem execução
        self.concluida(g3, hidraulico, "Revisão do guincho", somar_meses(hoje + timedelta(days=20), -12),
                       81000, "1690.00", "HidroPeças")
        self.concluida(g3, freios, "Revisão de freios", meses(3), 90000, "2210.00", "Freios & Cia")
        self.concluida(g3, oleo, "Troca de óleo", meses(1), 95000, "840.00", "Diesel Center")
        self.cancelada(g3, None, "Troca do para-brisa", dias(40), "Vidros Express")
        self.leitura(g3, dias(3), 98240, conta_marcos)

        # Guincho 04 — inativo, com histórico
        self.concluida(g4, oleo, "Troca de óleo", meses(14), 301500, "780.00", "Diesel Center")
        self.leitura(g4, meses(13), 302900, gestor)

        for numero, ordem in enumerate(sorted(self.ordens, key=lambda o: o.data_abertura), start=1):
            ordem.numero = numero
            ordem.save()

        # Leituras gravadas em ordem de data: a km atual é a da última leitura registrada (RN02)
        for data, v, km, origem, usuario in sorted(self.leituras, key=lambda x: (x[0], x[2])):
            LeituraOdometro.objects.create(veiculo=v, data_leitura=data, quilometragem=km, origem=origem,
                                           usuario=usuario)

        # Último aviso do Marcos, como na tela Início do protótipo: "Barulho ao frear",
        # que o gestor já está vendo
        aviso = Problema.objects.create(veiculo=g2, usuario=conta_marcos, componente=Problema.Componente.FREIO,
                                        pode_rodar=True, descricao="Barulho ao frear",
                                        situacao=Problema.Situacao.EM_ANALISE)
        Problema.objects.filter(pk=aviso.pk).update(data_hora=timezone.now() - timedelta(days=2, hours=3))

        self.stdout.write(self.style.SUCCESS("Demonstração criada: Reboques Silva Ltda"))
        self.stdout.write(f"  Gestor:    {GESTOR}  /  senha: {SENHA}")
        self.stdout.write(f"  Motorista: {MOTORISTA}  /  senha: {SENHA}")

    # ------------------------------------------------------------------
    def leitura(self, veiculo, data, km, usuario, origem=LeituraOdometro.Origem.MANUAL):
        self.leituras.append((data, veiculo, km, origem, usuario))

    def concluida(self, veiculo, plano, descricao, data, km, valor, oficina):
        self.ordens.append(OrdemServico(
            veiculo=veiculo, plano=plano, descricao=descricao,
            data_abertura=data - timedelta(days=2), data_conclusao=data, quilometragem=km,
            status=OrdemServico.Status.CONCLUIDA, valor=Decimal(valor), oficina=oficina, emitente=self.gestor))
        # RN09: a conclusão gera a leitura de odômetro
        self.leitura(veiculo, data, km, self.gestor, LeituraOdometro.Origem.ORDEM_SERVICO)

    def aberta(self, veiculo, plano, descricao, data, oficina):
        self.ordens.append(OrdemServico(veiculo=veiculo, plano=plano, descricao=descricao,
                                        data_abertura=data, oficina=oficina, emitente=self.gestor))

    def cancelada(self, veiculo, plano, descricao, data, oficina):
        self.ordens.append(OrdemServico(veiculo=veiculo, plano=plano, descricao=descricao,
                                        data_abertura=data, oficina=oficina, status=OrdemServico.Status.CANCELADA,
                                        emitente=self.gestor))

    def apagar(self):
        empresa = Empresa.objects.get(pk=CNPJ)
        CienciaAviso.objects.filter(veiculo__empresa=empresa).delete()
        Problema.objects.filter(veiculo__empresa=empresa).delete()
        Checkin.objects.filter(veiculo__empresa=empresa).delete()
        OrdemServico.objects.filter(veiculo__empresa=empresa).delete()
        LeituraOdometro.objects.filter(veiculo__empresa=empresa).delete()
        PlanoManutencao.objects.filter(empresa=empresa).delete()
        Veiculo.objects.filter(empresa=empresa).delete()
        Usuario.objects.filter(empresa=empresa).delete()
        Motorista.objects.filter(empresa=empresa).delete()
        empresa.delete()
        self.stdout.write("Demonstração anterior apagada.")
