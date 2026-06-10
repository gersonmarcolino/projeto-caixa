"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Archive, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Category, Product } from "@/lib/types";

interface FormState {
  name: string;
  price: string;
  category_id: string;
  stock_quantity: string;
  stock_minimum: string;
}

const emptyForm: FormState = {
  name: "",
  price: "",
  category_id: "",
  stock_quantity: "0",
  stock_minimum: "5",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchData() {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get<Product[]>("/products?active_only=true"),
        api.get<Category[]>("/categories"),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      price: String(product.price),
      category_id: product.category_id ?? "",
      stock_quantity: String(product.stock_quantity),
      stock_minimum: String(product.stock_minimum),
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError("");
  }

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    const price = parseFloat(form.price);
    if (!form.price || isNaN(price) || price <= 0) { setError("Preço inválido."); return; }
    const stock_quantity = parseInt(form.stock_quantity);
    const stock_minimum = parseInt(form.stock_minimum);
    if (isNaN(stock_quantity) || stock_quantity < 0) { setError("Estoque inválido."); return; }
    if (isNaN(stock_minimum) || stock_minimum < 0) { setError("Estoque mínimo inválido."); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        price,
        category_id: form.category_id || null,
        stock_quantity,
        stock_minimum,
      };

      if (editing) {
        await api.patch(`/products/${editing.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      await fetchData();
      closeModal();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(product: Product) {
    if (!confirm(`Arquivar "${product.name}"?`)) return;
    try {
      await api.patch(`/products/${product.id}`, { is_active: false });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch {
      alert("Erro ao arquivar produto.");
    }
  }

  const isLowStock = (p: Product) => p.stock_quantity <= p.stock_minimum;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Produtos</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Novo Produto
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nenhum produto cadastrado.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Preço</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Estoque</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {product.category?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        isLowStock(product)
                          ? "inline-flex items-center gap-1 text-amber-600 font-medium"
                          : "text-gray-900"
                      }
                    >
                      {isLowStock(product) && <AlertTriangle size={13} />}
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(product)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleArchive(product)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Arquivar"
                      >
                        <Archive size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {editing ? "Editar Produto" : "Novo Produto"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Nome do produto"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setField("price", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setField("category_id", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque atual</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_quantity}
                    onChange={(e) => setField("stock_quantity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque mínimo</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_minimum}
                    onChange={(e) => setField("stock_minimum", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
