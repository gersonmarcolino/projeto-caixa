from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_manager
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


def _validate_category(db: Session, category_id: str | None, tenant_id: str) -> None:
    """Garante que a categoria informada pertence ao tenant do usuário."""
    if category_id is None:
        return
    exists = db.query(Category).filter(
        Category.id == category_id,
        Category.tenant_id == tenant_id,
    ).first()
    if not exists:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoria inválida")


@router.get("", response_model=list[ProductOut])
def list_products(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Product).options(joinedload(Product.category)).filter(
        Product.tenant_id == current_user.tenant_id
    )
    if active_only:
        query = query.filter(Product.is_active == True)
    return query.order_by(Product.name).all()


@router.get("/low-stock", response_model=list[ProductOut])
def low_stock(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    return db.query(Product).options(joinedload(Product.category)).filter(
        Product.tenant_id == current_user.tenant_id,
        Product.is_active == True,
        Product.stock_quantity <= Product.stock_minimum,
    ).all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    _validate_category(db, payload.category_id, current_user.tenant_id)
    product = Product(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == current_user.tenant_id,
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")

    _validate_category(db, payload.category_id, current_user.tenant_id)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_product(
    product_id: str,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == current_user.tenant_id,
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")

    product.is_active = False
    db.commit()
