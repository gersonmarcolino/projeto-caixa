"""
Print Agent — Cafeteria SaaS

Roda no PC do caixa. Faz polling na API por cupons pendentes e imprime
na impressora térmica (ESC/POS). Configuração via arquivo .env.

Modos de impressora (PRINTER_TYPE):
  console  -> imprime o cupom no terminal (padrão, para testes sem impressora)
  usb      -> impressora USB        (precisa USB_VENDOR_ID / USB_PRODUCT_ID)
  network  -> impressora de rede     (precisa PRINTER_HOST / PRINTER_PORT)
  serial   -> impressora serial      (precisa SERIAL_PORT / SERIAL_BAUDRATE)

Uso:
  pip install -r requirements.txt
  python print-agent.py
"""

import json
import os
import sys
import time
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000").rstrip("/")
AGENT_EMAIL = os.getenv("AGENT_EMAIL", "")
AGENT_PASSWORD = os.getenv("AGENT_PASSWORD", "")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "2"))
STORE_NAME = os.getenv("STORE_NAME", "Cafeteria")
RECEIPT_WIDTH = int(os.getenv("RECEIPT_WIDTH", "32"))
PRINTER_TYPE = os.getenv("PRINTER_TYPE", "console").lower()

PAYMENT_LABELS = {
    "dinheiro": "Dinheiro",
    "pix": "PIX",
    "cartao_credito": "Cartao de Credito",
    "cartao_debito": "Cartao de Debito",
    "credito_aluno": "Credito do Aluno",
}


def log(message: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)


def format_brl(value) -> str:
    if value is None:
        return "-"
    return f"R$ {float(value):.2f}".replace(".", ",")


def line_lr(left: str, right: str, width: int = RECEIPT_WIDTH) -> str:
    """Linha com texto à esquerda e valor à direita, dentro da largura."""
    space = width - len(right)
    if len(left) > space - 1:
        left = left[: max(0, space - 2)] + "…"
    return f"{left:<{space}}{right}"


def render_receipt(payload: dict) -> list[str]:
    """Monta as linhas de texto do cupom a partir do payload do print_job."""
    lines: list[str] = []
    sep = "-" * RECEIPT_WIDTH

    lines.append(STORE_NAME.center(RECEIPT_WIDTH))
    lines.append(f"{datetime.now():%d/%m/%Y %H:%M}".center(RECEIPT_WIDTH))
    lines.append(sep)

    for item in payload.get("items", []):
        name = f"{item.get('qty', 1)}x {item.get('name', '')}"
        lines.append(line_lr(name, format_brl(item.get("subtotal"))))

    lines.append(sep)
    lines.append(line_lr("TOTAL", format_brl(payload.get("total"))))

    method = PAYMENT_LABELS.get(payload.get("payment_method"), payload.get("payment_method", ""))
    lines.append(f"Pagamento: {method}")
    if payload.get("amount_paid") is not None:
        lines.append(line_lr("Recebido", format_brl(payload.get("amount_paid"))))
    if payload.get("change") is not None:
        lines.append(line_lr("Troco", format_brl(payload.get("change"))))

    lines.append(sep)
    sale_id = str(payload.get("sale_id", ""))
    lines.append(f"Venda: {sale_id[:8]}")
    return lines


# ---------------------------------------------------------------------------
# Impressoras
# ---------------------------------------------------------------------------

def build_printer():
    """Retorna um objeto com método .print_receipt(lines). Lazy-import do escpos."""
    if PRINTER_TYPE == "console":
        return ConsolePrinter()

    from escpos import printer as escpos_printer  # só importa se houver impressora real

    if PRINTER_TYPE == "usb":
        dev = escpos_printer.Usb(
            int(os.environ["USB_VENDOR_ID"], 16),
            int(os.environ["USB_PRODUCT_ID"], 16),
        )
    elif PRINTER_TYPE == "network":
        dev = escpos_printer.Network(os.environ["PRINTER_HOST"], int(os.getenv("PRINTER_PORT", "9100")))
    elif PRINTER_TYPE == "serial":
        dev = escpos_printer.Serial(os.environ["SERIAL_PORT"], baudrate=int(os.getenv("SERIAL_BAUDRATE", "9600")))
    else:
        raise ValueError(f"PRINTER_TYPE inválido: {PRINTER_TYPE}")

    return EscposPrinter(dev)


class ConsolePrinter:
    """Imprime o cupom no terminal (para testes sem impressora física)."""

    def print_receipt(self, lines: list[str]) -> None:
        border = "+" + "-" * (RECEIPT_WIDTH + 2) + "+"
        print(border)
        for ln in lines:
            print(f"| {ln:<{RECEIPT_WIDTH}} |")
        print(border, flush=True)


class EscposPrinter:
    """Envia o cupom para uma impressora ESC/POS real."""

    def __init__(self, device):
        self.device = device

    def print_receipt(self, lines: list[str]) -> None:
        for ln in lines:
            self.device.text(ln + "\n")
        self.device.cut()


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class ApiClient:
    def __init__(self):
        self.token: str | None = None

    def login(self) -> None:
        resp = requests.post(
            f"{API_URL}/api/auth/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            timeout=10,
        )
        resp.raise_for_status()
        self.token = resp.json()["access_token"]
        log("Autenticado na API.")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def get_pending(self) -> list[dict]:
        if not self.token:
            self.login()
        resp = requests.get(f"{API_URL}/api/print-jobs/pending", headers=self._headers(), timeout=10)
        if resp.status_code == 401:
            self.login()
            resp = requests.get(f"{API_URL}/api/print-jobs/pending", headers=self._headers(), timeout=10)
        resp.raise_for_status()
        return resp.json()

    def mark_done(self, job_id: str) -> None:
        resp = requests.patch(f"{API_URL}/api/print-jobs/{job_id}/done", headers=self._headers(), timeout=10)
        resp.raise_for_status()


# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------

def main() -> None:
    if not AGENT_EMAIL or not AGENT_PASSWORD:
        log("ERRO: configure AGENT_EMAIL e AGENT_PASSWORD no arquivo .env")
        sys.exit(1)

    log(f"Print Agent iniciado | API={API_URL} | impressora={PRINTER_TYPE} | intervalo={POLL_INTERVAL}s")

    try:
        printer = build_printer()
    except Exception as exc:  # noqa: BLE001
        log(f"ERRO ao inicializar a impressora: {exc}")
        sys.exit(1)

    api = ApiClient()

    while True:
        try:
            jobs = api.get_pending()
            for job in jobs:
                try:
                    payload = json.loads(job["payload"])
                    printer.print_receipt(render_receipt(payload))
                    api.mark_done(job["id"])
                    log(f"Cupom impresso e baixado | job={job['id'][:8]} venda={str(payload.get('sale_id',''))[:8]}")
                except Exception as exc:  # noqa: BLE001
                    # Não marca como done: será tentado de novo no próximo ciclo
                    log(f"Falha ao imprimir job {job['id'][:8]}: {exc}")
        except requests.RequestException as exc:
            log(f"Sem conexão com a API: {exc}")
        except Exception as exc:  # noqa: BLE001
            log(f"Erro inesperado: {exc}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Print Agent encerrado.")
