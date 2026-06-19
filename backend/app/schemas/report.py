from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ReportPrintRequest(BaseModel):
    report_type: Literal["products_sold", "top_products", "payment_methods"]
    start: datetime  # início inclusivo (UTC)
    end: datetime    # fim exclusivo (UTC) — borda half-open
    period_label: str = Field(max_length=80)  # intervalo de datas formatado no fuso do usuário


class ReportPrintResponse(BaseModel):
    job_id: str
    title: str
    rows: int
