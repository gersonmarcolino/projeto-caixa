from datetime import datetime

from pydantic import BaseModel, Field

from app.models.credit_transaction import TransactionType


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    class_name: str | None = Field(default=None, max_length=100)
    credit_limit: float = Field(default=0, ge=0)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    class_name: str | None = None
    credit_limit: float | None = Field(default=None, ge=0)
    is_blocked: bool | None = None
    is_active: bool | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    class_name: str | None
    credit_balance: float
    credit_limit: float
    is_blocked: bool
    is_active: bool

    model_config = {"from_attributes": True}


class RechargeRequest(BaseModel):
    amount: float = Field(gt=0)
    description: str | None = Field(default=None, max_length=300)


class CreditTransactionOut(BaseModel):
    id: str
    type: TransactionType
    amount: float
    description: str | None
    sale_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
