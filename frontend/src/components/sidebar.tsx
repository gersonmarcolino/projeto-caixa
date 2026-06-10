"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingCart, Package, Tag, Users, BarChart2, Settings, LogOut, CreditCard } from "lucide-react";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/pos", label: "Caixa", icon: ShoppingCart },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/categories", label: "Categorias", icon: Tag },
  { href: "/stock", label: "Estoque", icon: Package },
  { href: "/credit", label: "Crédito", icon: CreditCard },
  { href: "/reports", label: "Relatórios", icon: BarChart2 },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    router.push("/login");
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-full shrink-0">
      <div className="px-6 py-5 border-b border-gray-100">
        <span className="font-bold text-lg text-primary-600">Cafeteria</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
