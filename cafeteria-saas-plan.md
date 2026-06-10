# Cafeteria SaaS — Plano de Implementação

**Projeto:** Sistema de Gestão de Lanchonete Escolar  
**Modelo:** SaaS (venda de serviço por escola)  
**Status:** Planejamento  
**Criado em:** 2026-06-05

---

## Visão Geral

Substituição completa do sistema atual de lanchonete escolar, adicionando as funcionalidades ausentes (relatórios e controle de crédito/devedores) com uma plataforma web moderna, vendida como serviço para escolas.

---

## Stack Técnico

| Camada            | Tecnologia                        | Justificativa                              |
|-------------------|-----------------------------------|--------------------------------------------|
| Frontend          | Next.js 15 (App Router) + TypeScript | UI rica para POS e dashboards             |
| Estilo            | Tailwind CSS + shadcn/ui          | Componentes prontos, visual profissional    |
| Backend           | Python + FastAPI                  | Alinhado ao conhecimento do dev, async     |
| Banco de dados    | PostgreSQL (Supabase)             | Gerenciado, multi-tenant ready             |
| ORM (backend)     | SQLAlchemy 2.0 + Alembic          | Migrations e queries Python-native         |
| Auth              | FastAPI + JWT (python-jose)       | Roles: admin, cashier, manager             |
| Relatórios        | pandas + openpyxl + ReportLab     | PDF e Excel server-side                    |
| Impressora térmica| Agente Python local (ESC/POS)     | Script no PC do caixa, polling na API      |
| Deploy frontend   | Vercel                            | CI/CD automático, free tier disponível     |
| Deploy backend    | Railway ou Fly.io                 | FastAPI containerizado                     |

---

## Arquitetura

```
[Browser - Caixa / Gestor / Admin]
         ↕ HTTPS
[Vercel - Next.js Frontend]
         ↕ REST API
[Railway/Fly.io - FastAPI Backend]
         ↕
[Supabase - PostgreSQL]

[PC do Caixa]
[print-agent.py] ←─ polling /api/print-jobs ─→ [FastAPI]
      ↓
[Impressora Térmica USB/Rede]
```

---

## Módulos

### M1 — Autenticação & Multi-tenancy
- Login com email/senha
- Roles: `super_admin` (você), `school_admin`, `manager`, `cashier`
- Cada escola é um `tenant` isolado no banco

### M2 — Cadastros Base
- Produtos (nome, preço, categoria, estoque mínimo)
- Categorias
- Alunos/Clientes (nome, turma, crédito disponível)
- Usuários por escola

### M3 — POS (Caixa)
- Interface otimizada para velocidade (touch-friendly)
- Seleção de produtos por categoria
- Carrinho de compra
- Formas de pagamento: dinheiro, crédito (conta do aluno), PIX (fase 2)
- Emissão de cupom (envia para fila de impressão)
- Troco automático

### M4 — Controle de Estoque
- Entrada de mercadoria
- Baixa automática por venda
- Alerta de estoque mínimo
- Histórico de movimentações

### M5 — Controle de Crédito / Devedores
- Conta corrente por aluno
- Recarga de crédito (manual ou por responsável)
- Limite de crédito configurável
- Extrato de consumo por aluno
- Lista de devedores com saldo negativo
- Bloqueio automático por limite

### M6 — Relatórios
- Vendas por período (dia/semana/mês)
- Produtos mais vendidos
- Faturamento total e por forma de pagamento
- Estoque atual e movimentações
- Relatório de crédito e inadimplência
- Exportação PDF e Excel

### M7 — Agente de Impressão (Print Agent)
- Script Python standalone (`print-agent.py`)
- Roda em segundo plano no PC do caixa
- Polling na API a cada 2 segundos
- Suporte ESC/POS via `python-escpos`
- Instalação com um comando (`pip install + python print-agent.py`)

---

## Banco de Dados — Entidades Principais

```
tenants          → escolas (multi-tenancy)
users            → funcionários com role e tenant_id
products         → produtos com preço e estoque
categories       → categorias de produtos
customers        → alunos/clientes com saldo de crédito
sales            → cabeçalho da venda
sale_items       → itens de cada venda
stock_movements  → entradas e saídas de estoque
credit_transactions → recargas e débitos de crédito
print_jobs       → fila de impressão (status: pending/done)
```

---

## Fases de Implementação

### Fase 1 — Fundação (Semana 1-2)
- [ ] Setup do monorepo (frontend + backend separados)
- [ ] Configuração Supabase (banco + variáveis)
- [ ] Models SQLAlchemy + migrations Alembic
- [ ] Auth JWT (login, refresh token, roles)
- [ ] CRUD de produtos e categorias
- [ ] Layout base Next.js (sidebar, header, rotas protegidas)

### Fase 2 — POS Core (Semana 3-4)
- [ ] Interface de caixa (POS)
- [ ] Carrinho e fechamento de venda
- [ ] Baixa de estoque automática por venda
- [ ] Fila de impressão (tabela print_jobs)
- [ ] Agente de impressão local (`print-agent.py`)

### Fase 3 — Crédito & Devedores (Semana 5)
- [ ] Cadastro de alunos/clientes
- [ ] Conta corrente de crédito
- [ ] Recarga manual de saldo
- [ ] Bloqueio por limite
- [ ] Tela de devedores

### Fase 4 — Relatórios (Semana 6)
- [ ] Relatório de vendas por período
- [ ] Relatório de estoque
- [ ] Relatório de crédito/inadimplência
- [ ] Export PDF e Excel

### Fase 5 — Deploy & Produto (Semana 7)
- [ ] Deploy backend (Railway)
- [ ] Deploy frontend (Vercel)
- [ ] Onboarding de nova escola (criação de tenant)
- [ ] Documentação de uso (admin e caixa)
- [ ] Teste completo com dados reais

---

## Estrutura de Diretórios

```
cafeteria-saas/
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── core/               # config, security, database
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── routers/            # endpoints por módulo
│   │   │   ├── auth.py
│   │   │   ├── products.py
│   │   │   ├── sales.py
│   │   │   ├── stock.py
│   │   │   ├── credit.py
│   │   │   ├── reports.py
│   │   │   └── print_jobs.py
│   │   └── services/           # lógica de negócio
│   ├── alembic/                # migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   # Next.js
│   ├── app/
│   │   ├── (auth)/             # login
│   │   ├── (dashboard)/        # área logada
│   │   │   ├── pos/            # caixa
│   │   │   ├── products/       # produtos
│   │   │   ├── stock/          # estoque
│   │   │   ├── credit/         # crédito
│   │   │   └── reports/        # relatórios
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/                    # api client, utils
│   └── package.json
├── print-agent/                # Agente local de impressão
│   ├── print-agent.py
│   └── requirements.txt
└── cafeteria-saas-plan.md      # este arquivo
```

---

## Decisões em Aberto

| Decisão | Opções | Status |
|---|---|---|
| Multi-tenancy DB | Schema separado por tenant vs coluna tenant_id | A definir na Fase 1 |
| PIX integrado | Fase 1 ou Fase 2 | Fase 2 (backlog) |
| App mobile para responsáveis | Consulta de saldo/extrato | Backlog |
| Modelo de cobrança SaaS | Mensalidade fixa ou por aluno | Fora do escopo técnico |

---

## Próximo Passo

Iniciar **Fase 1 — Fundação**: scaffold do projeto, configuração do banco e auth.
