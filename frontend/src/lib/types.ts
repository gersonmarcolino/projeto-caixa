export type UserRole = "super_admin" | "school_admin" | "manager" | "cashier";

export interface UserMe {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  category: Category | null;
  stock_quantity: number;
  stock_minimum: number;
  is_active: boolean;
}

export type PaymentMethod = "dinheiro" | "pix" | "credito_aluno";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SaleItemOut {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface SaleOut {
  id: string;
  payment_method: PaymentMethod;
  total: number;
  amount_paid: number | null;
  change: number | null;
  created_at: string;
  items: SaleItemOut[];
}
