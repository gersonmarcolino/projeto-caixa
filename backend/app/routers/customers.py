from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_manager
from app.models.credit_transaction import CreditTransaction, TransactionType
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import (
    CreditTransactionOut,
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    RechargeRequest,
)

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Customer).filter(Customer.tenant_id == current_user.tenant_id)
    if active_only:
        query = query.filter(Customer.is_active == True)
    return query.order_by(Customer.name).all()


@router.get("/debtors", response_model=list[CustomerOut])
def list_debtors(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    return (
        db.query(Customer)
        .filter(
            Customer.tenant_id == current_user.tenant_id,
            Customer.is_active == True,
            Customer.credit_balance < 0,
        )
        .order_by(Customer.credit_balance)
        .all()
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    customer = Customer(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.tenant_id == current_user.tenant_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.post("/{customer_id}/recharge", response_model=CustomerOut)
def recharge(
    customer_id: str,
    payload: RechargeRequest,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.tenant_id == current_user.tenant_id,
        Customer.is_active == True,
    ).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    customer.credit_balance = float(customer.credit_balance) + payload.amount
    tx = CreditTransaction(
        tenant_id=current_user.tenant_id,
        customer_id=customer.id,
        type=TransactionType.recharge,
        amount=payload.amount,
        description=payload.description,
    )
    db.add(tx)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}/statement", response_model=list[CreditTransactionOut])
def statement(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.tenant_id == current_user.tenant_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    return (
        db.query(CreditTransaction)
        .filter(CreditTransaction.customer_id == customer_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(100)
        .all()
    )
