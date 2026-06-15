from datetime import datetime

from pydantic import BaseModel, Field

from app.models.sale import PaymentMethod


class SaleItemIn(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


class SaleCreate(BaseModel):
    items: list[SaleItemIn] = Field(min_length=1)
    payment_method: PaymentMethod
    amount_paid: float | None = Field(default=None, gt=0)
    customer_id: str | None = None


class SaleItemOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    unit_price: float
    quantity: int
    subtotal: float

    model_config = {"from_attributes": True}


class SaleOut(BaseModel):
    id: str
    payment_method: PaymentMethod
    total: float
    amount_paid: float | None
    change: float | None
    customer_id: str | None
    created_at: datetime
    items: list[SaleItemOut]

    model_config = {"from_attributes": True}
