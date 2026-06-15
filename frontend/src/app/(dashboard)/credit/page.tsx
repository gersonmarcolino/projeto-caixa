"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Customer } from "@/lib/types";

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function CreditPage() {
  const [debtors, setDebtors] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get<Customer[]>("/customers/debtors");
      setDebtors(data);
    } catch {
      setLoadError("Não foi possível carregar os devedores. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalOwed = debtors.reduce((sum, c) => sum + Math.abs(c.credit_balance), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Crédito — Devedores</h1>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <Users size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Devedores</p>
            <p className="text-lg font-bold text-gray-900">{debtors.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total devido</p>
            <p className="text-lg font-bold text-gray-900">{formatPrice(totalOwed)}</p>
          </div>
        </div>
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
      ) : debtors.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nenhum devedor. 🎉</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Turma</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo devedor</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Limite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {debtors.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.class_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">{formatPrice(c.credit_balance)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatPrice(c.credit_limit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
