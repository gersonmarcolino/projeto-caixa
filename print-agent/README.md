# Print Agent — Cafeteria SaaS

Agente local que roda no PC do caixa, busca cupons pendentes na API e imprime
na impressora térmica (ESC/POS).

## Como funciona

```
Navegador → API (nuvem) → fila print_jobs → [print-agent.py] → impressora
```

A cada `POLL_INTERVAL` segundos o agente consulta `GET /api/print-jobs/pending`,
imprime cada cupom e marca como impresso (`PATCH /api/print-jobs/{id}/done`).
Só marca como impresso após sucesso — se a impressão falhar, tenta de novo no
próximo ciclo.

## Instalação

```bash
cd print-agent
pip install -r requirements.txt
cp .env.example .env      # no Windows: copy .env.example .env
```

Edite o `.env` com a URL da API, as credenciais e os dados da impressora.

> Para testar **sem impressora física**, deixe `PRINTER_TYPE=console` — o cupom
> é impresso no terminal. Nesse modo o `python-escpos` nem é necessário.

## Executar

```bash
python print-agent.py
```

Deixe rodando em segundo plano no PC do caixa.

## Configuração (.env)

| Variável | Descrição |
|---|---|
| `API_URL` | URL base da API (ex.: `http://127.0.0.1:8000`) |
| `AGENT_EMAIL` / `AGENT_PASSWORD` | Credenciais de um usuário da escola |
| `POLL_INTERVAL` | Intervalo de checagem em segundos (padrão 2) |
| `STORE_NAME` | Cabeçalho do cupom |
| `RECEIPT_WIDTH` | Largura em caracteres (32 ≈ 58mm, 48 ≈ 80mm) |
| `PRINTER_TYPE` | `console`, `usb`, `network` ou `serial` |

### Impressora USB
Defina `USB_VENDOR_ID` e `USB_PRODUCT_ID` (hexadecimal). No Windows pode ser
necessário instalar o driver libusb (ex.: via Zadig).

### Impressora de rede
Defina `PRINTER_HOST` e `PRINTER_PORT` (padrão 9100).

### Impressora serial
Defina `SERIAL_PORT` (ex.: `COM3`) e `SERIAL_BAUDRATE`.
