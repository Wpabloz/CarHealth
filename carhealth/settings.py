"""
Configurações do projeto CarHealth (API REST).

Os valores secretos (senha do banco, SECRET_KEY) ficam no arquivo .env,
que NÃO vai para o GitHub.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-inseguro-troque-no-env")
DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    # bibliotecas
    "rest_framework",       # Django REST Framework: cria a API
    "drf_spectacular",      # gera a documentação Swagger em /api/docs
    "corsheaders",          # libera o frontend (outro endereço) a chamar a API
    # apps do projeto
    "contas",               # empresa, admin (usuário) e autenticação
    "frota",                # motorista, veículo, planos, odômetro, ordens de serviço
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "carhealth.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,  # necessário só para a página do Swagger
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    },
]

WSGI_APPLICATION = "carhealth.wsgi.application"

# ---------------------------------------------------------------------------
# Banco de dados PostgreSQL (valores lidos do .env)
# ATOMIC_REQUESTS: cada requisição é uma transação — se der erro, nada é gravado.
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "carhealth"),
        "USER": os.getenv("DB_USER", "carhealth"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "ATOMIC_REQUESTS": True,
    }
}

# ---------------------------------------------------------------------------
# Autenticação
# A tabela "admin" é o usuário do sistema. Login com e-mail + senha.
# Senhas gravadas com bcrypt (coluna "senha"), nunca em texto puro.
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "contas.Admin"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    # Toda rota exige o token JWT, a não ser que a view diga o contrário
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "carhealth.erros.tratar_erros",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),  # cabeçalho: Authorization: Bearer <token>
    "USER_ID_FIELD": "email",
    "USER_ID_CLAIM": "email",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CarHealth API",
        "DESCRIPTION": "API do CarHealth para gestão de manutenção de frotas.",
    "VERSION": "0.2.0",
    "ENUM_NAME_OVERRIDES": {"TipoVeiculoEnum": "frota.models.TipoVeiculo"},
}

# Endereços do frontend que podem chamar a API (separados por vírgula no .env)
CORS_ALLOWED_ORIGINS = [
    o for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if o
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
