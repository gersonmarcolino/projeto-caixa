"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Shield, Building2, LogOut } from "lucide-react";
import Cookies from "js-cookie";
import { api } from "@/lib/api";
import { UserMe, UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  school_admin: "Administrador da Escola",
  manager: "Gerente",
  cashier: "Operador de Caixa",
};

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadMe() {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get<UserMe>("/auth/me");
      setMe(data);
    } catch {
      setLoadError("Não foi possível carregar seus dados. Verifique a conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  function handleLogout() {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    router.push("/login");
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Configurações</h1>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-500">{loadError}</p>
          <button
            onClick={loadMe}
            className="mt-3 text-sm text-primary-600 font-medium hover:text-primary-700"
          >
            Tentar novamente
          </button>
        </div>
      ) : me ? (
        <>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Minha conta</h2>
            </div>
            <dl className="divide-y divide-gray-100">
              <InfoRow icon={User} label="Nome" value={me.name} />
              <InfoRow icon={Mail} label="Email" value={me.email} />
              <InfoRow icon={Shield} label="Perfil" value={ROLE_LABELS[me.role] ?? me.role} />
              <InfoRow icon={Building2} label="Escola (tenant)" value={me.tenant_id} mono />
            </dl>
          </div>

          <p className="text-xs text-gray-400 mb-6">
            Edição de perfil, troca de senha e dados da escola serão habilitados em uma próxima etapa.
          </p>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </>
      ) : null}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon size={16} className="text-gray-400 shrink-0" />
      <dt className="text-sm text-gray-500 w-40 shrink-0">{label}</dt>
      <dd className={`text-sm text-gray-900 truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
