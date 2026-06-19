import json

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_manager
from app.models.print_job import PrintJob
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.report import ReportPrintRequest, ReportPrintResponse

router = APIRouter(prefix="/reports", tags=["reports"])

PAYMENT_LABELS = {
    "dinheiro": "Dinheiro",
    "pix": "PIX",
    "cartao_credito": "Cartao de Credito",
    "cartao_debito": "Cartao de Debito",
    "credito_aluno": "Credito do Aluno",
}

TITLES = {
    "products_sold": "PRODUTOS VENDIDOS",
    "top_products": "MAIS VENDIDOS",
    "payment_methods": "FORMAS DE PAGAMENTO",
}


def _brl(value) -> str:
    return f"R$ {float(value or 0):.2f}".replace(".", ",")


RANKING_LIMIT = 20


def _product_rows(db: Session, tenant_id: str, start, end, *, ranked: bool):
    """Agrega itens vendidos por produto no período. Retorna (rows, totals)."""
    results = (
        db.query(
            SaleItem.product_id,
            func.max(SaleItem.product_name).label("name"),  # nome representativo
            func.sum(SaleItem.quantity).label("qty"),
            func.sum(SaleItem.subtotal).label("revenue"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            Sale.tenant_id == tenant_id,
            Sale.created_at >= start,
            Sale.created_at < end,  # borda half-open: cobre o dia todo sem depender de ms
        )
        .group_by(SaleItem.product_id)
        .all()
    )

    items = [(name, int(qty or 0), float(revenue or 0)) for _pid, name, qty, revenue in results]

    # Totais sempre sobre o conjunto completo do período (antes de qualquer corte)
    total_qty = sum(qty for _n, qty, _r in items)
    total_rev = sum(rev for _n, _q, rev in items)
    totals = [["Itens vendidos", str(total_qty)], ["Faturamento", _brl(total_rev)]]

    if ranked:
        items.sort(key=lambda r: (-r[1], -r[2], r[0].lower()))  # qty desc, fat desc, nome asc
        shown = items[:RANKING_LIMIT]
        rows = [[f"{i}. {name}", str(qty)] for i, (name, qty, _rev) in enumerate(shown, 1)]
        if len(items) > len(shown):
            rows.append([f"... e mais {len(items) - len(shown)} produto(s)", ""])
    else:
        items.sort(key=lambda r: r[0].lower())
        rows = [[name, str(qty)] for name, qty, _rev in items]

    return rows, totals


def _payment_rows(db: Session, tenant_id: str, start, end):
    results = (
        db.query(
            Sale.payment_method,
            func.count(Sale.id).label("qty"),
            func.sum(Sale.total).label("total"),
        )
        .filter(
            Sale.tenant_id == tenant_id,
            Sale.created_at >= start,
            Sale.created_at < end,  # borda half-open
        )
        .group_by(Sale.payment_method)
        .all()
    )

    rows = []
    grand_total = 0.0
    grand_count = 0
    for method, qty, total in results:
        label = PAYMENT_LABELS.get(method, str(method))
        rows.append([f"{label} ({int(qty)})", _brl(total)])
        grand_total += float(total or 0)
        grand_count += int(qty)

    totals = [["Vendas", str(grand_count)], ["TOTAL", _brl(grand_total)]]
    return rows, totals


@router.post("/print", response_model=ReportPrintResponse, status_code=status.HTTP_201_CREATED)
def print_report(
    payload: ReportPrintRequest,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    if payload.report_type == "payment_methods":
        rows, totals = _payment_rows(db, current_user.tenant_id, payload.start, payload.end)
    else:
        rows, totals = _product_rows(
            db, current_user.tenant_id, payload.start, payload.end,
            ranked=(payload.report_type == "top_products"),
        )

    if not rows:
        rows = [["Sem vendas no periodo", ""]]

    report = {
        "type": "report",
        "title": TITLES[payload.report_type],
        "period": payload.period_label,
        "rows": rows,
        "totals": totals,
    }

    job = PrintJob(
        tenant_id=current_user.tenant_id,
        sale_id=None,
        payload=json.dumps(report, ensure_ascii=False),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return ReportPrintResponse(job_id=job.id, title=report["title"], rows=len(rows))
