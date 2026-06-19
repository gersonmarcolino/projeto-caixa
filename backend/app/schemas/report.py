from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ReportPrintRequest(BaseModel):
    report_type: Literal["products_sold", "top_products", "payment_methods"]
    start: datetime
    end: datetime
    period_label: str  # rótulo já formatado no fuso do usuário (ex.: "Hoje 18/06/2026")


class ReportPrintResponse(BaseModel):
    job_id: str
    title: str
    rows: int
