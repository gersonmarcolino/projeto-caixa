"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Wallet, Receipt, Ban } from "lucide-react";
import { api } from "@/lib/api";
import { Customer, CreditTransaction, UserMe } from "@/lib/types";

const MANAGER_ROLES = ["super_admin", "school_admin", "manager"];

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface CustomerForm {
  name: string;
  class_name: string;
  credit_limit: string;
  is_blocked: boolean;
}

const emptyForm: CustomerForm = { name: "", class_name: "", credit_limit: "0", is_blocked: false };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // modal de cadastro/edição
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // modal de recarga
  const [rechargeTarget, setRechargeTarget] = useState<Customer | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeError, setRechargeError] = useState("");
  const [recharging, setRecharging] = useState(false);

  // modal de extrato
  const [statementTarget, setStatementTarget] = useState<Customer | null>(null);
  const [statement, setStatement] = useState<CreditTransaction[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [custRes, meRes] = await Promise.all([
        api.get<Customer[]>("/customers"),
        api.get<UserMe>("/auth/me"),
      ]);
      setCustomers(custRes.data);
      setCanEdit(MANAGER_ROLES.includes(meRes.data.role));
    } catch {
      setLoadError("Não foi possível carregar os clientes. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      class_name: c.class_name ?? "",
      credit_limit: String(c.credit_limit),
      is_blocked: c.is_blocked,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }
    const limit = parseFloat(form.credit_limit);
    if (isNaN(limit) || limit < 0) {
      setFormError("Limite de crédito inválido.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        class_name: form.class_name.trim() || null,
        credit_limit: limit,
        ...(editing ? { is_blocked: form.is_blocked } : {}),
      };
      if (editing) {
        await api.patch(`/customers/${editing.id}`, payload);
      } else {
        await api.post("/customers", payload);
      }
      await loadData();
      setFormOpen(false);
    } catch {
      setFormError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecharge() {
    if (!rechargeTarget) return;
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount <= 0) {
      setRechargeError("Informe um valor maior que zero.");
      return;
    }
    setRecharging(true);
    setRechargeError("");
    try {
      await api.post(`/customers/${rechargeTarget.id}/recharge`, { amount });
      await loadData();
      setRechargeTarget(null);
      setRechargeAmount("");
    } catch {
      setRechargeError("Erro ao recarregar. Tente novamente.");
    } finally {
      setRecharging(false);
    }
  }

  async function openStatement(c: Customer) {
    setStatementTarget(c);
    setStatement([]);
    setStatementLoading(true);
    try {
      const { data } = await api.get<CreditTransaction[]>(`/customers/${c.id}/statement`);
      setStatement(data);
    } finally {
      setStatementLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500">{loadError}</p>
          <button onClick={loadData} className="mt-3 text-sm text-primary-600 font-medium hover:text-primary-700">
            Tentar novamente
          </button>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Turma</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Limite</th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {c.name}
                      {c.is_blocked && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          <Ban size={11} /> Bloqueado
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.class_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className={`px-4 py-3 text-right font-medium ${c.credit_balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                    {formatPrice(c.credit_balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatPrice(c.credit_limit)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openStatement(c)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="Extrato">
                        <Receipt size={14} />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => { setRechargeTarget(c); setRechargeAmount(""); setRechargeError(""); }} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Recarregar">
                            <Wallet size={14} />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="Editar">
                            <Pencil size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal cadastro/edição */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{editing ? "Editar Cliente" : "Novo Cliente"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input autoFocus type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Nome do aluno" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                  <input type="text" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ex: 5A" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite de crédito (R$)</label>
                  <input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.is_blocked} onChange={(e) => setForm({ ...form, is_blocked: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Bloqueado para compras no crédito
                </label>
              )}
            </div>
            {formError && <p className="text-sm text-red-500 mt-3">{formError}</p>}
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal recarga */}
      {rechargeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Recarregar crédito</h2>
            <p className="text-sm text-gray-500 mb-1">{rechargeTarget.name}</p>
            <p className="text-sm mb-4">Saldo atual: <span className={rechargeTarget.credit_balance < 0 ? "text-red-600 font-medium" : "text-gray-900 font-medium"}>{formatPrice(rechargeTarget.credit_balance)}</span></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor a recarregar (R$)</label>
              <input autoFocus type="number" min="0.01" step="0.01" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRecharge()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="0,00" />
            </div>
            {rechargeError && <p className="text-sm text-red-500 mb-3">{rechargeError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRechargeTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleRecharge} disabled={recharging} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">{recharging ? "Recarregando..." : "Recarregar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal extrato */}
      {statementTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-gray-900">Extrato</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">{statementTarget.name}</p>
            <div className="max-h-80 overflow-y-auto">
              {statementLoading ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : statement.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma movimentação.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {statement.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm text-gray-900">{t.type === "recharge" ? "Recarga" : "Compra"}</p>
                        <p className="text-xs text-gray-400">{formatDate(t.created_at)}{t.description ? ` · ${t.description}` : ""}</p>
                      </div>
                      <span className={`text-sm font-medium ${t.type === "recharge" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "recharge" ? "+" : "−"}{formatPrice(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setStatementTarget(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
