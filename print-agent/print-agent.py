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

# Garante acentuação correta no console (nomes como "José", "Conceição").
# No Windows o stdout costuma vir em cp1252 e truncaria/quebraria os acentos.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

load_dotenv()

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000").rstrip("/")
AGENT_EMAIL = os.getenv("AGENT_EMAIL", "")
AGENT_PASSWORD = os.getenv("AGENT_PASSWORD", "")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "2"))
STORE_NAME = os.getenv("STORE_NAME", "Cafeteria")
RECEIPT_WIDTH = int(os.getenv("RECEIPT_WIDTH", "32"))
PRINTER_TYPE = os.getenv("PRINTER_TYPE", "console").lower()
# Code page da impressora térmica. CP850 cobre os acentos do português.
# Alguns modelos só trazem CP437/WPC1252 — ajuste conforme o manual.
PRINTER_CODEPAGE = os.getenv("PRINTER_CODEPAGE", "CP850")
# Registro local de cupons já enviados à impressora (evita reimpressão se o
# mark_done falhar, ou após crash/reinício do agente).
PRINTED_LOG = os.getenv("PRINTED_LOG", "printed-jobs.log")

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


def truncate(text: str, width: int) -> str:
    """Trunca com reticências ASCII (seguras em qualquer code page da térmica)."""
    if len(text) <= width:
        return text
    return text[: max(0, width - 3)] + "..."


def line_lr(left: str, right: str, width: int = RECEIPT_WIDTH) -> str:
    """Linha com texto à esquerda e valor à direita, dentro da largura."""
    right = truncate(right, width)
    space = max(0, width - len(right))
    left = truncate(left, max(0, space - 1))
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
    customer_name = payload.get("customer_name")
    if customer_name:
        lines.append(truncate(f"Aluno: {customer_name}", RECEIPT_WIDTH))
    if payload.get("amount_paid") is not None:
        lines.append(line_lr("Recebido", format_brl(payload.get("amount_paid"))))
    if payload.get("change") is not None:
        lines.append(line_lr("Troco", format_brl(payload.get("change"))))

    lines.append(sep)
    sale_id = str(payload.get("sale_id", ""))
    lines.append(f"Venda: {sale_id[:8]}")
    return lines


def render_report(payload: dict) -> list[str]:
    """Monta um cupom de relatório (linhas com rótulo à esquerda e valor à direita)."""
    lines: list[str] = []
    sep = "-" * RECEIPT_WIDTH

    lines.append(payload.get("title", "RELATORIO").center(RECEIPT_WIDTH))
    period = payload.get("period")
    if period:
        lines.append(truncate(period, RECEIPT_WIDTH).center(RECEIPT_WIDTH))
    lines.append(sep)

    for row in payload.get("rows", []):
        left, right = (list(row) + ["", ""])[:2]
        lines.append(line_lr(str(left), str(right)))

    totals = payload.get("totals", [])
    if totals:
        lines.append(sep)
        for row in totals:
            left, right = (list(row) + ["", ""])[:2]
            lines.append(line_lr(str(left), str(right)))

    lines.append(sep)
    lines.append(f"Emitido {datetime.now():%d/%m/%Y %H:%M}".center(RECEIPT_WIDTH))
    return lines


def render_job(payload: dict) -> list[str]:
    """Escolhe o renderizador conforme o tipo do payload."""
    if payload.get("type") == "report":
        return render_report(payload)
    return render_receipt(payload)


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
        # Fixa a code page (determinístico) em vez de depender do auto-encoding,
        # garantindo acentos corretos em nomes como "José"/"Conceição".
        try:
            self.device.charcode(PRINTER_CODEPAGE)
        except Exception as exc:  # noqa: BLE001
            log(f"Aviso: não foi possível fixar code page {PRINTER_CODEPAGE}: {exc}")

    def print_receipt(self, lines: list[str]) -> None:
        for ln in lines:
            self.device.text(ln + "\n")
        self.device.cut()


# ---------------------------------------------------------------------------
# Registro local de cupons impressos (idempotência)
# ---------------------------------------------------------------------------

def load_printed() -> set[str]:
    try:
        with open(PRINTED_LOG, encoding="utf-8") as f:
            return {line.strip() for line in f if line.strip()}
    except FileNotFoundError:
        return set()


def record_printed(job_id: str) -> None:
    with open(PRINTED_LOG, "a", encoding="utf-8") as f:
        f.write(job_id + "\n")
        f.flush()


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

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        """Faz a requisição reautenticando uma vez em caso de 401 (token expirado)."""
        if not self.token:
            self.login()
        url = f"{API_URL}{path}"
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = requests.request(method, url, headers=headers, timeout=10, **kwargs)
        if resp.status_code == 401:
            self.login()
            headers = {"Authorization": f"Bearer {self.token}"}
            resp = requests.request(method, url, headers=headers, timeout=10, **kwargs)
        resp.raise_for_status()
        return resp

    def get_pending(self) -> list[dict]:
        return self._request("GET", "/api/print-jobs/pending").json()

    def mark_done(self, job_id: str) -> None:
        self._request("PATCH", f"/api/print-jobs/{job_id}/done")


# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------

def main() -> None:
    if not AGENT_EMAIL or not AGENT_PASSWORD:
        log("ERRO: configure AGENT_EMAIL e AGENT_PASSWORD no arquivo .env")
        sys.exit(1)

    log(f"Print Agent iniciado | API={API_URL} | impressora={PRINTER_TYPE} | intervalo={POLL_INTERVAL}s")

    api = ApiClient()
    printer = None
    printed = load_printed()

    while True:
        try:
            if printer is None:
                printer = build_printer()  # (re)conecta; não derruba o agente se falhar
                log(f"Impressora pronta ({PRINTER_TYPE}).")

            for job in api.get_pending():
                job_id = job["id"]
                try:
                    # Já impresso antes (o mark_done falhou)? Só confirma, não reimprime.
                    if job_id not in printed:
                        payload = json.loads(job["payload"])
                        printer.print_receipt(render_job(payload))
                        record_printed(job_id)
                        printed.add(job_id)
                        kind = "Relatorio" if payload.get("type") == "report" else "Cupom"
                        log(f"{kind} impresso | job={job_id[:8]}")
                    api.mark_done(job_id)
                except requests.RequestException:
                    raise  # erro de rede/API -> trata no except externo (sem reimprimir)
                except Exception as exc:  # noqa: BLE001 — falha de impressão
                    log(f"Falha ao imprimir job {job_id[:8]}: {exc}")
                    printer = None  # reconstrói a conexão no próximo ciclo (impressora pode ter caído)
                    break
        except requests.RequestException as exc:
            log(f"Sem conexão com a API: {exc}")
        except Exception as exc:  # noqa: BLE001
            log(f"Erro inesperado: {exc}")
            printer = None

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Print Agent encerrado.")
