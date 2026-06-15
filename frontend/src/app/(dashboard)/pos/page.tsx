"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Search } from "lucide-react";
import { api } from "@/lib/api";
import { CartItem, Category, Customer, PaymentMethod, Product, SaleOut } from "@/lib/types";

type CheckoutStep = "idle" | "checkout" | "success";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito_aluno: "Crédito do Aluno",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [amountPaid, setAmountPaid] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [lastSale, setLastSale] = useState<SaleOut | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [prodRes, catRes, custRes] = await Promise.all([
        api.get<Product[]>("/products?active_only=true"),
        api.get<Category[]>("/categories"),
        api.get<Customer[]>("/customers"),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setCustomers(custRes.data);
    } catch {
      setLoadError("Não foi possível carregar produtos. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = products.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category_id === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function openCheckout() {
    setPaymentMethod("dinheiro");
    setAmountPaid("");
    setSelectedCustomerId("");
    setCheckoutError("");
    setStep("checkout");
  }

  function cancelCheckout() {
    setStep("idle");
    setCheckoutError("");
  }

  async function confirmSale() {
    setCheckoutError("");
    const paid = paymentMethod === "dinheiro" ? parseFloat(amountPaid) : undefined;
    if (paymentMethod === "dinheiro" && (!amountPaid || isNaN(paid!) || paid! < total)) {
      setCheckoutError("Valor recebido menor que o total.");
      return;
    }
    if (paymentMethod === "credito_aluno" && !selectedCustomerId) {
      setCheckoutError("Selecione o aluno.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<SaleOut>("/sales", {
        items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        payment_method: paymentMethod,
        amount_paid: paid ?? null,
        customer_id: paymentMethod === "credito_aluno" ? selectedCustomerId : null,
      });
      setLastSale(data);
      setCart([]);
      setStep("success");

      // Atualiza estoque local
      setProducts((prev) =>
        prev.map((p) => {
          const soldItem = data.items.find((i) => i.product_id === p.id);
          return soldItem ? { ...p, stock_quantity: p.stock_quantity - soldItem.quantity } : p;
        })
      );

      // Atualiza saldo local do aluno em compras no crédito
      if (paymentMethod === "credito_aluno") {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === selectedCustomerId ? { ...c, credit_balance: c.credit_balance - data.total } : c
          )
        );
      }
    } catch (err: any) {
      setCheckoutError(err?.response?.data?.detail ?? "Erro ao registrar venda.");
    } finally {
      setSubmitting(false);
    }
  }

  function newSale() {
    setLastSale(null);
    setStep("idle");
  }

  const change = paymentMethod === "dinheiro" && amountPaid
    ? parseFloat(amountPaid) - total
    : null;

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

  return (
    <div className="flex h-full gap-4 -m-6 p-0 overflow-hidden">
      {/* Painel esquerdo — produtos */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-4">
        {/* Busca de produto */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              title="Limpar"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Tabs de categoria */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === "all"
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-primary-300"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-primary-300"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid de produtos */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center mt-16">Carregando produtos...</p>
          ) : loadError ? (
            <div className="text-center mt-16">
              <p className="text-sm text-red-500">{loadError}</p>
              <button
                onClick={loadData}
                className="mt-3 text-sm text-primary-600 font-medium hover:text-primary-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-16">
              {search ? "Nenhum produto encontrado." : "Nenhum produto nesta categoria."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((product) => {
                const outOfStock = product.stock_quantity === 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`bg-white rounded-xl border p-3 text-left transition-all ${
                      outOfStock
                        ? "opacity-50 cursor-not-allowed border-gray-100"
                        : "border-gray-100 hover:border-primary-300 hover:shadow-sm active:scale-95"
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 leading-tight">{product.name}</p>
                    <p className="text-primary-600 font-semibold text-sm mt-1">{formatPrice(product.price)}</p>
                    {outOfStock && <p className="text-xs text-red-400 mt-1">Sem estoque</p>}
                    {!outOfStock && product.stock_quantity <= product.stock_minimum && (
                      <p className="text-xs text-amber-500 mt-1">Estoque baixo</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Painel direito — carrinho */}
      <div className="w-72 shrink-0 bg-white border-l border-gray-100 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart size={16} className="text-gray-500" />
          <span className="font-semibold text-sm text-gray-900">Carrinho</span>
          {cartCount > 0 && (
            <span className="ml-auto bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {cartCount}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">Carrinho vazio</p>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-500">{formatPrice(item.product.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.product.id, -1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.product.id, 1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <p className="text-xs font-semibold text-gray-900 w-14 text-right">
                  {formatPrice(item.product.price * item.quantity)}
                </p>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-xl font-bold text-gray-900">{formatPrice(total)}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={openCheckout}
            className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Fechar Venda
          </button>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Limpar carrinho
            </button>
          )}
        </div>
      </div>

      {/* Modal de checkout */}
      {step === "checkout" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Fechar Venda</h2>
            <p className="text-2xl font-bold text-primary-600 mb-4">{formatPrice(total)}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {(["dinheiro", "pix", "credito_aluno"] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => { setPaymentMethod(method); setAmountPaid(""); setCheckoutError(""); }}
                    className={`py-2 px-1 rounded-lg text-xs font-medium border leading-tight transition-colors ${
                      paymentMethod === method
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"
                    }`}
                  >
                    {method === "credito_aluno" ? "Crédito" : PAYMENT_LABELS[method]}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "credito_aluno" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Aluno</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione o aluno...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.is_blocked}>
                      {c.name}{c.class_name ? ` (${c.class_name})` : ""} — saldo {formatPrice(c.credit_balance)}{c.is_blocked ? " [bloqueado]" : ""}
                    </option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className={`text-sm mt-1 font-medium ${selectedCustomer.credit_balance - total < 0 ? "text-amber-600" : "text-green-600"}`}>
                    Saldo após a compra: {formatPrice(selectedCustomer.credit_balance - total)}
                  </p>
                )}
                {customers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhum aluno cadastrado. Cadastre em Clientes.</p>
                )}
              </div>
            )}

            {paymentMethod === "dinheiro" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor recebido (R$)</label>
                <input
                  autoFocus
                  type="number"
                  min={total}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0,00"
                />
                {change !== null && change >= 0 && (
                  <p className="text-sm text-green-600 font-medium mt-1">
                    Troco: {formatPrice(change)}
                  </p>
                )}
              </div>
            )}

            {checkoutError && <p className="text-sm text-red-500 mb-3">{checkoutError}</p>}

            <div className="flex gap-2">
              <button
                onClick={cancelCheckout}
                className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSale}
                disabled={submitting}
                className="flex-1 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium transition-colors"
              >
                {submitting ? "Registrando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de sucesso */}
      {step === "success" && lastSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm mx-4 p-6 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-gray-900 mb-1">Venda registrada!</h2>
            <p className="text-2xl font-bold text-gray-900 mb-1">{formatPrice(lastSale.total)}</p>
            <p className="text-sm text-gray-500 mb-1">{PAYMENT_LABELS[lastSale.payment_method]}</p>
            {lastSale.change !== null && lastSale.change > 0 && (
              <p className="text-sm text-green-600 font-medium mb-4">Troco: {formatPrice(lastSale.change)}</p>
            )}
            <div className="border-t border-gray-100 pt-4 mb-4 text-left space-y-1">
              {lastSale.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-gray-600">
                  <span>{item.quantity}× {item.product_name}</span>
                  <span>{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <button
              onClick={newSale}
              className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              Nova Venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
