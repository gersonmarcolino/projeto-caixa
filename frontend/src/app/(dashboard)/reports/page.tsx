"use client";

import { useEffect, useState } from "react";
import { Printer, Package, TrendingUp, CreditCard, CheckCircle, Info } from "lucide-react";
import { api } from "@/lib/api";
import { ReportType, UserMe } from "@/lib/types";

const MANAGER_ROLES = ["super_admin", "school_admin", "manager"];

const REPORTS: { type: ReportType; label: string; desc: string; icon: typeof Package }[] = [
  { type: "products_sold", label: "Produtos vendidos", desc: "Produtos e quantidades vendidas no período", icon: Package },
  { type: "top_products", label: "Mais vendidos", desc: "Ranking dos produtos por quantidade", icon: TrendingUp },
  { type: "payment_methods", label: "Formas de pagamento", desc: "Totais por forma de pagamento", icon: CreditCard },
];

type QuickKey = "today" | "yesterday" | "week" | "month" | "custom";

const QUICK: { key: QuickKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function nextDayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}
function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

// endDisplay = último dia INCLUSIVO (para exibição). O fim exclusivo (próximo
// dia 00:00) é calculado só no envio, evitando perder vendas na borda do dia.
function rangeFor(key: QuickKey): { start: Date; endDisplay: Date } {
  const now = new Date();
  const today = startOfDay(now);
  if (key === "today") return { start: today, endDisplay: today };
  if (key === "yesterday") {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { start: startOfDay(y), endDisplay: startOfDay(y) };
  }
  if (key === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay()); // domingo
    return { start: startOfDay(s), endDisplay: today };
  }
  // month
  return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), endDisplay: today };
}

function periodLabel(start: Date, endDisplay: Date) {
  const a = fmt(start);
  const b = fmt(endDisplay);
  return a === b ? a : `${a} a ${b}`;
}

export default function ReportsPage() {
  const [canPrint, setCanPrint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quick, setQuick] = useState<QuickKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [sending, setSending] = useState<ReportType | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    api.get<UserMe>("/auth/me")
      .then(({ data }) => setCanPrint(MANAGER_ROLES.includes(data.role)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function currentRange(): { start: Date; endDisplay: Date } | null {
    if (quick !== "custom") return rangeFor(quick);
    if (!customStart || !customEnd) return null;
    const [sy, sm, sd] = customStart.split("-").map(Number);
    const [ey, em, ed] = customEnd.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endDisplay = new Date(ey, em - 1, ed, 0, 0, 0, 0);
    if (start > endDisplay) return null;
    return { start, endDisplay };
  }

  const range = currentRange();

  // Aplica o filtro de horário (opcional) sobre as datas do período.
  // start inclusivo; end exclusivo (próximo dia 00:00 quando não há hora final).
  let effective: { start: Date; end: Date; label: string } | null = null;
  if (range) {
    const start = new Date(range.start);
    if (startTime) {
      const [h, m] = startTime.split(":").map(Number);
      start.setHours(h, m, 0, 0);
    }
    let end: Date;
    if (endTime) {
      const [h, m] = endTime.split(":").map(Number);
      end = new Date(range.endDisplay);
      end.setHours(h, m, 0, 0);
    } else {
      end = nextDayStart(range.endDisplay);
    }
    if (start < end) {
      const timePart = startTime || endTime ? ` ${startTime || "00:00"}-${endTime || "23:59"}` : "";
      effective = { start, end, label: periodLabel(range.start, range.endDisplay) + timePart };
    }
  }

  const customError =
    quick === "custom" && !range
      ? !customStart || !customEnd
        ? "Preencha as duas datas."
        : "A data final não pode ser anterior à inicial."
      : range && !effective
        ? "O horário final deve ser depois do inicial."
        : "";

  async function handlePrint(type: ReportType) {
    if (!effective) {
      setMessage({ kind: "err", text: "Selecione um período válido." });
      return;
    }
    setSending(type);
    setMessage(null);
    try {
      const { data } = await api.post("/reports/print", {
        report_type: type,
        start: effective.start.toISOString(),
        end: effective.end.toISOString(),
        period_label: effective.label,
      });
      setMessage({ kind: "ok", text: `"${data.title}" enviado para a impressora (${data.rows} linha(s)).` });
    } catch {
      setMessage({ kind: "err", text: "Erro ao enviar o relatório para impressão." });
    } finally {
      setSending(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando...</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Relatórios</h1>
      <p className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Printer size={14} /> Os relatórios são impressos na impressora térmica (print-agent).
      </p>

      {!canPrint ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">Apenas gerentes e administradores podem emitir relatórios.</p>
        </div>
      ) : (
        <>
          {/* Período */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK.map((q) => (
                <button
                  key={q.key}
                  onClick={() => setQuick(q.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    quick === q.key
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"
                  }`}
                >
                  {q.label}
                </button>
              ))}
              <button
                onClick={() => setQuick("custom")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  quick === "custom"
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"
                }`}
              >
                Personalizado
              </button>
            </div>

            {quick === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-gray-400 text-sm">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {/* Horário (opcional) */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Horário (opcional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-gray-400 text-sm">às</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {(startTime || endTime) && (
                  <button
                    onClick={() => { setStartTime(""); setEndTime(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    limpar
                  </button>
                )}
              </div>
            </div>

            {customError && <p className="text-xs text-red-500 mt-2">{customError}</p>}
            {effective && (
              <p className="text-xs text-gray-400 mt-2">Período selecionado: {effective.label}</p>
            )}
          </div>

          {/* Relatórios */}
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {REPORTS.map(({ type, label, desc, icon: Icon }) => (
              <div key={type} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                  <Icon size={18} className="text-primary-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-1 flex-1">{desc}</p>
                <button
                  onClick={() => handlePrint(type)}
                  disabled={sending !== null || !effective}
                  className="mt-3 flex items-center justify-center gap-1.5 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Printer size={14} />
                  {sending === type ? "Enviando..." : "Imprimir"}
                </button>
              </div>
            ))}
          </div>

          {message && (
            <div
              className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
                message.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}
            >
              {message.kind === "ok" && <CheckCircle size={15} />}
              {message.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}
