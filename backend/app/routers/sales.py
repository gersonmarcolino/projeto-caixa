import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.print_job import PrintJob
from app.models.product import Product
from app.models.sale import PaymentMethod, Sale, SaleItem
from app.models.user import User
from app.schemas.sale import SaleCreate, SaleOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product_ids = [item.product_id for item in payload.items]
    products = {
        p.id: p
        for p in db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.tenant_id == current_user.tenant_id,
            Product.is_active == True,
        ).all()
    }

    for item in payload.items:
        if item.product_id not in products:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Produto {item.product_id} não encontrado")
        if products[item.product_id].stock_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Estoque insuficiente para '{products[item.product_id].name}'",
            )

    # Toda a aritmética monetária usa Decimal — product.price vem do banco como Decimal
    # e amount_paid chega como float do Pydantic; misturar os dois lança TypeError.
    amount_paid = Decimal(str(payload.amount_paid)) if payload.amount_paid is not None else None

    if payload.payment_method == PaymentMethod.dinheiro:
        if amount_paid is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Informe o valor recebido")

    total = sum((products[item.product_id].price * item.quantity for item in payload.items), Decimal("0"))

    if payload.payment_method == PaymentMethod.dinheiro and amount_paid < total:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Valor recebido menor que o total")

    change = (amount_paid - total) if payload.payment_method == PaymentMethod.dinheiro else None

    sale = Sale(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payment_method=payload.payment_method,
        total=total,
        amount_paid=amount_paid,
        change=change,
    )
    db.add(sale)
    db.flush()

    sale_items = []
    for item in payload.items:
        product = products[item.product_id]
        si = SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            product_name=product.name,
            unit_price=product.price,
            quantity=item.quantity,
            subtotal=product.price * item.quantity,
        )
        db.add(si)
        sale_items.append(si)
        product.stock_quantity -= item.quantity

    db.flush()

    receipt_items = [
        {"name": si.product_name, "qty": si.quantity, "unit": float(si.unit_price), "subtotal": float(si.subtotal)}
        for si in sale_items
    ]
    print_job = PrintJob(
        tenant_id=current_user.tenant_id,
        sale_id=sale.id,
        payload=json.dumps({
            "sale_id": sale.id,
            "total": float(total),
            "payment_method": payload.payment_method,
            "amount_paid": float(amount_paid) if amount_paid is not None else None,
            "change": float(change) if change is not None else None,
            "items": receipt_items,
        }),
    )
    db.add(print_job)
    db.commit()
    db.refresh(sale)

    return db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale.id).first()


@router.get("", response_model=list[SaleOut])
def list_sales(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Sale)
        .options(joinedload(Sale.items))
        .filter(Sale.tenant_id == current_user.tenant_id)
        .order_by(Sale.created_at.desc())
        .limit(100)
        .all()
    )
