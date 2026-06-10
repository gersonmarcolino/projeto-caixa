# Guia de Aprendizado — Cafeteria SaaS

> Documento de estudo: o que foi feito, como foi feito e por quê.  
> Gerado em: 2026-06-05

---

## Índice

1. [Configuração do ambiente de agentes (.agent)](#1-configuração-do-ambiente-de-agentes-agent)
2. [Planejamento do projeto](#2-planejamento-do-projeto)
3. [Estrutura do backend (FastAPI)](#3-estrutura-do-backend-fastapi)
4. [Banco de dados (SQLAlchemy + Alembic)](#4-banco-de-dados-sqlalchemy--alembic)
5. [Autenticação JWT](#5-autenticação-jwt)
6. [Rotas da API](#6-rotas-da-api)
7. [Estrutura do frontend (Next.js)](#7-estrutura-do-frontend-nextjs)
8. [Erros encontrados e como foram resolvidos](#8-erros-encontrados-e-como-foram-resolvidos)
9. [Conceitos importantes para estudar](#9-conceitos-importantes-para-estudar)

---

## 1. Configuração do ambiente de agentes (.agent)

### O que é a pasta `.agent`?

É uma pasta dentro do projeto que contém "inteligência auxiliar" para o assistente de IA. Ela define:

- **Agentes**: personas especializadas (ex: `backend-specialist`, `frontend-specialist`)
- **Skills**: módulos de conhecimento por domínio (ex: `api-patterns`, `clean-code`)
- **Workflows**: comandos especiais como `/create`, `/debug`, `/plan`
- **Regras globais**: um arquivo que diz como o assistente deve se comportar no projeto

### Por que foi criada?

Para que em qualquer projeto futuro, o assistente já saiba de antemão:
- Quais padrões de código seguir
- Qual especialista ativar para cada tipo de tarefa
- Como fazer perguntas antes de codar (Gate Socrático)

### O que foi adaptado?

O arquivo `rules/GEMINI.md` foi criado originalmente para o Google Gemini. Foi adaptado para `rules/CLAUDE.md` com estas mudanças:

| O que mudou | De (Gemini) | Para (Claude Code) |
|---|---|---|
| Referência de skills | `@[skills/clean-code]` | `.agent/skills/clean-code/SKILL.md` |
| Modos de trabalho | plan/ask/edit (Gemini) | `/plan`, pergunta direta, tarefa clara |
| Nome do arquivo de regras | `GEMINI.md` | `CLAUDE.md` |
| Idioma | Inglês | Português (mantendo código em inglês) |

---

## 2. Planejamento do projeto

### Por que planejar antes de codar?

Projetos sem planejamento geram:
- Retrabalho (descobrir que a arquitetura errada foi escolhida depois de muito código pronto)
- Falta de visão do todo (não saber o que falta)
- Dificuldade de trabalhar em equipe

### O Gate Socrático

Antes de qualquer implementação, foi feita uma série de perguntas estratégicas:

1. **O que o sistema resolve?** → Identificar o problema real
2. **Qual o stack?** → Definir tecnologias compatíveis com o nível do dev
3. **Quem vai usar?** → Impacta UX, segurança e modelo de negócio
4. **Tem restrições?** → Evitar surpresas técnicas depois
5. **Substituir ou complementar?** → Define escopo total do sistema
6. **Web ou local?** → Define toda a arquitetura (especialmente a impressora térmica)

### Por que Web/Cloud para uma lanchonete com impressora térmica?

Esse foi o ponto mais crítico. A impressora térmica é conectada fisicamente ao computador do caixa via USB. Um sistema web rodando na nuvem **não consegue acessar USB do navegador** diretamente.

**Solução criada:** Um "agente de impressão" (`print-agent.py`) — um script Python pequeno que roda em segundo plano no computador do caixa e fica perguntando para a API na nuvem "tem algum cupom para imprimir?". Quando tem, ele imprime localmente.

```
Navegador → API na nuvem → Fila no banco → Script local → Impressora
```

### O arquivo de plano (`cafeteria-saas-plan.md`)

Foi criado antes de qualquer código. Contém:
- Stack técnico com justificativas
- Arquitetura em diagrama texto
- Todos os módulos com descrição
- Entidades do banco de dados
- Fases de implementação com checklist

**Por que isso é importante?** Qualquer pessoa (ou o próprio assistente em outra sessão) pode retomar o projeto lendo esse arquivo e sabendo exatamente onde parou.

---

## 3. Estrutura do backend (FastAPI)

### Por que FastAPI?

| Critério | Flask | Django | FastAPI |
|---|---|---|---|
| Curva de aprendizado | Baixa | Alta | Média |
| Performance | Média | Média | Alta (async) |
| Validação automática | Não | Parcial | Sim (Pydantic) |
| Documentação automática | Não | Não | Sim (Swagger) |
| Pythônico | Sim | Sim | Sim |

FastAPI gera automaticamente uma documentação interativa em `/docs` onde você pode testar todos os endpoints sem precisar de Postman ou outro programa.

### Estrutura de pastas criada

```
backend/
├── app/
│   ├── main.py          ← ponto de entrada, registra as rotas
│   ├── core/
│   │   ├── config.py    ← lê variáveis do .env
│   │   ├── database.py  ← conecta ao banco
│   │   ├── security.py  ← cria e valida tokens JWT
│   │   └── deps.py      ← dependências reutilizáveis (quem está logado, qual role)
│   ├── models/          ← estrutura das tabelas do banco (SQLAlchemy)
│   ├── schemas/         ← formato dos dados que entram e saem da API (Pydantic)
│   └── routers/         ← os endpoints organizados por módulo
├── alembic/             ← controle de versão do banco (migrations)
├── requirements.txt     ← dependências do projeto
└── .env                 ← variáveis secretas (nunca sobe para o Git)
```

### Por que separar em `models`, `schemas` e `routers`?

**Sem separação (ruim):**
```python
# tudo junto em um arquivo → difícil de manter
@app.post("/products")
def create_product(name: str, price: float):
    # lógica de banco misturada com lógica de API
```

**Com separação (o que foi feito):**

- `models/product.py` → define como o produto é salvo no banco
- `schemas/product.py` → define o que a API aceita (entrada) e retorna (saída)
- `routers/products.py` → define as rotas e usa models + schemas

Isso permite alterar o banco sem quebrar a API, e vice-versa.

---

## 4. Banco de dados (SQLAlchemy + Alembic)

### O que é ORM?

ORM (Object-Relational Mapping) permite trabalhar com o banco de dados usando Python puro, sem escrever SQL diretamente.

**Com SQL puro:**
```sql
INSERT INTO products (id, name, price) VALUES ('abc', 'Lanche', 5.00);
```

**Com SQLAlchemy (ORM):**
```python
product = Product(name="Lanche", price=5.00)
db.add(product)
db.commit()
```

### Por que SQLAlchemy 2.0?

A versão 2.0 tem uma sintaxe mais moderna com `Mapped` e `mapped_column` que usa type hints do Python — mais seguro e mais fácil de ler:

```python
class Product(Base):
    __tablename__ = "products"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
```

### Multi-tenancy com `tenant_id`

Cada escola é um "tenant" (inquilino). Todo dado no sistema (produto, usuário, venda) pertence a um tenant específico via `tenant_id`.

```python
# Ao buscar produtos, sempre filtra pelo tenant do usuário logado
db.query(Product).filter(
    Product.tenant_id == current_user.tenant_id
).all()
```

Isso garante que a **Escola A nunca vê os dados da Escola B**.

### O que são migrations? (Alembic)

O banco de dados precisa ter suas tabelas criadas e atualizadas ao longo do tempo. Migrations são como um "histórico de versões" do banco.

```bash
# Criar migration (detecta mudanças nos models automaticamente)
alembic revision --autogenerate -m "add products table"

# Aplicar migration no banco
alembic upgrade head

# Desfazer a última migration
alembic downgrade -1
```

---

## 5. Autenticação JWT

### O que é JWT?

JWT (JSON Web Token) é uma forma de provar que você está logado sem precisar consultar o banco a cada requisição.

**Fluxo:**
```
1. Usuário faz login com email/senha
2. Servidor verifica no banco → senha correta
3. Servidor gera um token JWT (string codificada)
4. Usuário guarda esse token (no navegador, em cookie)
5. A cada requisição, envia o token no header
6. Servidor valida o token → sem consultar o banco
```

**Estrutura do token JWT:**
```
header.payload.signature

eyJhbGciOiJIUzI1NiJ9  ←  header (algoritmo)
.eyJzdWIiOiJ1c2VyMTIz  ←  payload (dados: id, role, tenant)
.SflKxwRJSMeKKF2QT4fw  ←  assinatura (garante que não foi alterado)
```

### Por que dois tokens? (access + refresh)

- **Access token**: expira em 8 horas. Usado em toda requisição.
- **Refresh token**: expira em 7 dias. Usado apenas para gerar um novo access token quando ele expira.

Isso evita que o usuário precise fazer login todo dia, mas mantém segurança.

### Roles (níveis de acesso)

```python
class UserRole(str, Enum):
    super_admin = "super_admin"  # você (dono do SaaS)
    school_admin = "school_admin"  # diretor da escola
    manager = "manager"  # gerente da lanchonete
    cashier = "cashier"  # operador do caixa
```

**Como funciona na prática:**

```python
# Qualquer usuário logado pode ver produtos
@router.get("/products")
def list_products(current_user: User = Depends(get_current_user)):
    ...

# Apenas manager ou admin pode criar produto
@router.post("/products")
def create_product(current_user: User = Depends(require_manager)):
    ...
```

O `Depends()` é o sistema de injeção de dependências do FastAPI — ele executa a função `require_manager` automaticamente antes da rota, e rejeita a requisição se o usuário não tiver permissão.

---

## 6. Rotas da API

### Padrão REST

As rotas seguem o padrão REST, onde o verbo HTTP indica a ação:

| Verbo | Rota | O que faz |
|---|---|---|
| `GET` | `/products` | Lista todos os produtos |
| `POST` | `/products` | Cria um produto |
| `PATCH` | `/products/{id}` | Atualiza campos específicos |
| `DELETE` | `/products/{id}` | Remove (ou desativa) |

### Por que `PATCH` e não `PUT`?

- `PUT` substitui o objeto inteiro (precisa enviar todos os campos)
- `PATCH` atualiza apenas os campos enviados

```python
# Com PATCH, pode enviar só o preço sem precisar mandar nome, estoque, etc.
PATCH /products/abc123
{ "price": 6.50 }
```

### Validação automática com Pydantic

```python
class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)  # obrigatório, 1-200 chars
    price: float = Field(gt=0)  # obrigatório, maior que zero
    stock_quantity: int = Field(default=0, ge=0)  # opcional, padrão 0
```

Se a API receber um produto com `price: -5`, o FastAPI já rejeita automaticamente com erro 422 — sem precisar escrever nenhuma validação manual.

---

## 7. Estrutura do frontend (Next.js)

### Por que Next.js?

Next.js é React com funcionalidades extras. Para um sistema de gestão, as principais vantagens são:

- **App Router**: organização de rotas por pastas (intuitivo)
- **Server Components**: partes do React que rodam no servidor (mais rápido)
- **Rotas protegidas**: fácil de implementar páginas que exigem login

### App Router — organização por pastas

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx      ← rota: /login
├── (dashboard)/
│   ├── layout.tsx        ← layout com sidebar (aplica em todas as páginas abaixo)
│   ├── pos/
│   │   └── page.tsx      ← rota: /dashboard/pos
│   └── products/
│       └── page.tsx      ← rota: /dashboard/products
└── layout.tsx            ← layout raiz (html, body, globals.css)
```

Os parênteses `(auth)` e `(dashboard)` são **grupos de rota** — organizam sem afetar a URL.

### Por que o `next.config.ts` tem rewrites?

```typescript
async rewrites() {
    return [{
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
    }];
}
```

Isso faz com que chamadas para `/api/products` no frontend sejam redirecionadas para `http://localhost:8000/api/products` (o backend). O motivo: evita problemas de CORS (Cross-Origin Resource Sharing) e simplifica as chamadas no código.

### Interceptor Axios

```typescript
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expirou → tenta renovar com refresh token
            // Se não conseguir → manda para /login
        }
    }
);
```

Toda resposta da API passa por esse interceptor. Se o token expirar (erro 401), ele tenta renovar automaticamente sem o usuário perceber.

---

## 8. Erros encontrados e como foram resolvidos

### Erro 1: `psycopg2-binary` não instala no Windows + Python 3.13

**Motivo:** O `psycopg2-binary` é o driver de conexão com PostgreSQL. Versões antigas não têm binários pré-compilados para Python 3.13 no Windows, então tenta compilar do zero — e falha porque precisa do PostgreSQL instalado localmente.

**Solução:** Trocar para `psycopg[binary]` (psycopg3), a versão moderna que tem binários para Python 3.13.

**Impacto no código:** A URL de conexão muda de `postgresql://` para `postgresql+psycopg://`. Foi adicionada uma linha no `database.py` que faz essa troca automaticamente:

```python
_db_url = settings.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
```

Assim o `.env` continua com a URL padrão do Supabase e o código adapta sozinho.

---

### Erro 2: `alembic` não reconhecido como comando

**Motivo:** O ambiente virtual (`.venv`) não estava ativado. Sem ativar, o terminal usa o Python global do sistema, onde o alembic não foi instalado.

**Solução:** Sempre ativar o ambiente virtual antes de usar qualquer comando:
```powershell
.venv\Scripts\activate
```

---

### Erro 3: Alembic usa `psycopg2` mesmo após trocar para `psycopg3`

**Motivo:** O `alembic/env.py` estava usando `engine_from_config()` que lê a URL diretamente do `alembic.ini`. Essa URL não tinha o `+psycopg` no dialeto, então o SQLAlchemy tentava usar o driver antigo.

**Solução:** Fazer o `alembic/env.py` usar o engine que já foi criado corretamente em `database.py`:

```python
# Antes (ruim): criava engine novo a partir do alembic.ini
connectable = engine_from_config(config.get_section(...))

# Depois (correto): reutiliza o engine já configurado
from app.core.database import engine as connectable
```

---

### Erro 4: `passlib` incompatível com `bcrypt` versão 4.2+

**Motivo:** O `passlib` (biblioteca de hash de senha) usa uma API interna do `bcrypt` que foi removida nas versões mais novas. Especificamente, tenta acessar `bcrypt.__about__.__version__` que não existe mais.

**Solução:** Fixar a versão do bcrypt em `4.0.1`, última que ainda tem a API antiga:
```
bcrypt==4.0.1
```

**Lição:** Ao usar bibliotecas que dependem umas das outras, às vezes é necessário fixar versões específicas para garantir compatibilidade.

---

### Erro 5: `python -c "..."` com múltiplas linhas não funciona no Windows

**Motivo:** O Windows (cmd/PowerShell) não suporta o mesmo formato de strings multi-linha do Linux/Mac ao usar `python -c`.

**Solução:** Criar um arquivo `.py` separado e executar com `python arquivo.py`.

---

## 9. Conceitos importantes para estudar

### Fundamentos que apareceram neste projeto

| Conceito | Onde aparece | Para estudar |
|---|---|---|
| **REST API** | Todas as rotas | Verbos HTTP, status codes, recursos |
| **JWT** | Autenticação | Como funciona token, claims, expiração |
| **ORM** | SQLAlchemy | Mapeamento objeto-relacional, relacionamentos |
| **Migrations** | Alembic | Versionamento de schema de banco |
| **Multi-tenancy** | `tenant_id` em todo model | Isolamento de dados por cliente |
| **Dependency Injection** | `Depends()` no FastAPI | Injeção de dependências, middleware |
| **Pydantic** | Schemas | Validação de dados, type hints |
| **React/Next.js** | Frontend | Componentes, hooks, App Router |
| **Interceptors** | Axios | Middleware de requisições HTTP |
| **Ambiente virtual** | `.venv` | Isolamento de dependências Python |

### Ordem de estudo recomendada

1. **Python básico** → funções, classes, type hints
2. **FastAPI** → rotas, Depends, Pydantic (documentação oficial é excelente)
3. **SQLAlchemy 2.0** → models, sessions, relacionamentos
4. **HTTP e REST** → verbos, status codes, headers
5. **JWT** → como funciona, quando usar
6. **React básico** → componentes, useState, useEffect
7. **Next.js** → App Router, Server/Client components

### Recursos recomendados

- **FastAPI**: documentação oficial em `fastapi.tiangolo.com` — tem tutorial completo
- **SQLAlchemy**: `docs.sqlalchemy.org` — comece pelo "ORM Quick Start"
- **Next.js**: `nextjs.org/learn` — curso interativo oficial
- **JWT**: `jwt.io` — visualizador de tokens + explicação

---

## Resumo do que está funcionando

```
✅ Backend rodando em http://localhost:8000
✅ Documentação interativa em http://localhost:8000/docs
✅ Login retornando access_token e refresh_token
✅ Banco Supabase conectado
✅ Tabelas criadas (tenants, users, categories, products)
✅ Usuário admin criado (admin@teste.com / admin123)
✅ Proteção por roles funcionando

⏳ Frontend aguardando Node.js (npm install)
⏳ Fase 2: POS, estoque, impressão
⏳ Fase 3: Crédito/devedores
⏳ Fase 4: Relatórios
⏳ Fase 5: Deploy
```
