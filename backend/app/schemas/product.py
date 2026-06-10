from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: str
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)
    category_id: str | None = None
    stock_quantity: int = Field(default=0, ge=0)
    stock_minimum: int = Field(default=5, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    price: float | None = Field(default=None, gt=0)
    category_id: str | None = None
    stock_quantity: int | None = Field(default=None, ge=0)
    stock_minimum: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(BaseModel):
    id: str
    name: str
    price: float
    category_id: str | None
    category: CategoryOut | None
    stock_quantity: int
    stock_minimum: int
    is_active: bool

    model_config = {"from_attributes": True}
