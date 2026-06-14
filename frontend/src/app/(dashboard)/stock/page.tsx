"use client";

import { useEffect, useState } from "react";
import { Package, AlertTriangle, PackagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { Product, UserMe } from "@/lib/types";

const MANAGER_ROLES = ["super_admin", "school_admin", "manager"];

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const [target, setTarget] = useState<Product | null>(null);
  const [entryQty, setEntryQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryError, setEntryError] = useState("");

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [prodRes, meRes] = await Promise.all([
        api.get<Product[]>("/products?active_only=true"),
        api.get<UserMe>("/auth/me"),
      ]);
      setProducts(prodRes.data);
      setCanEdit(MANAGER_ROLES.includes(meRes.data.role));
    } catch {
      setLoadError("Não foi possível carregar o estoque. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const isLow = (p: Product) => p.stock_quantity <= p.stock_minimum;
  const lowCount = products.filter(isLow).length;
  const visible = onlyLow ? products.filter(isLow) : products;

  function openEntry(product: Product) {
    setTarget(product);
    setEntryQty("");
    setEntryError("");
  }

  function closeEntry() {
    setTarget(null);
    setEntryQty("");
    setEntryError("");
  }

  async function confirmEntry() {
    if (!target) return;
    const qty = parseInt(entryQty);
    if (isNaN(qty) || qty <= 0) {
      setEntryError("Informe uma quantidade maior que zero.");
      return;
    }
    setSaving(true);
    setEntryError("");
    try {
      const newQty = target.stock_quantity + qty;
      await api.patch(`/products/${target.id}`, { stock_quantity: newQty });
      setProducts((prev) =>
        prev.map((p) => (p.id === target.id ? { ...p, stock_quantity: newQty } : p))
      );
      closeEntry();
    } catch {
      setEntryError("Erro ao registrar entrada. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Estoque</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => setOnlyLow(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Só estoque baixo
        </label>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
            <Package size={18} className="text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Produtos ativos</p>
            <p className="text-lg font-bold text-gray-900">{products.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Estoque baixo</p>
            <p className="text-lg font-bold text-gray-900">{lowCount}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500">{loadError}</p>
          <button
            onClick={loadData}
            className="mt-3 text-sm text-primary-600 font-medium hover:text-primary-700"
          >
            Tentar novamente
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">{onlyLow ? "Nenhum produto com estoque baixo." : "Nenhum produto cadastrado."}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Produto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Estoque</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Mínimo</th>
                {canEdit && <th className="px-4 py-3 w-32" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {product.category?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        isLow(product)
                          ? "inline-flex items-center gap-1 text-amber-600 font-medium"
                          : "text-gray-900"
                      }
                    >
                      {isLow(product) && <AlertTriangle size={13} />}
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{product.stock_minimum}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEntry(product)}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        <PackagePlus size={14} />
                        Entrada
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de entrada de mercadoria */}
      {target && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Registrar entrada</h2>
            <p className="text-sm text-gray-500 mb-4">{target.name}</p>

            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-500">Estoque atual</span>
              <span className="font-medium text-gray-900">{target.stock_quantity}</span>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade a adicionar</label>
              <input
                autoFocus
                type="number"
                min="1"
                step="1"
                value={entryQty}
                onChange={(e) => setEntryQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmEntry()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
              {entryQty && !isNaN(parseInt(entryQty)) && parseInt(entryQty) > 0 && (
                <p className="text-sm text-green-600 font-medium mt-1">
                  Novo estoque: {target.stock_quantity + parseInt(entryQty)}
                </p>
              )}
            </div>

            {entryError && <p className="text-sm text-red-500 mb-3">{entryError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={closeEntry}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEntry}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
