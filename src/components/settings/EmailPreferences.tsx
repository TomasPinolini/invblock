"use client";

import { Loader2, Mail, BarChart3, TrendingUp, Bell, Shield } from "lucide-react";
import {
  useEmailPreferences,
  useUpdateEmailPreferences,
} from "@/hooks/useEmailPreferences";

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ icon, label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-zinc-400">{icon}</div>
        <div>
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
                    transition-colors duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${checked ? "bg-blue-600" : "bg-zinc-700"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full
                      bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5
                      ${checked ? "translate-x-4 ml-0.5" : "translate-x-0 ml-0.5"}`}
        />
      </button>
    </div>
  );
}

export function EmailPreferences() {
  const { data: prefs, isLoading } = useEmailPreferences();
  const updatePrefs = useUpdateEmailPreferences();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (!prefs) return null;

  const handleToggle = (key: string, value: boolean) => {
    updatePrefs.mutate({ [key]: value });
  };

  return (
    <div id="notifications" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
          <Mail className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-100">Notificaciones por Email</h3>
          <p className="text-xs text-zinc-500">Elegir que emails recibis</p>
        </div>
      </div>

      <div className="divide-y divide-zinc-800">
        <ToggleRow
          icon={<BarChart3 className="h-4 w-4" />}
          label="Reporte Diario de Mercado"
          description="Resumen del portfolio enviado al cierre del mercado"
          checked={prefs.dailyReport}
          onChange={(v) => handleToggle("dailyReport", v)}
          disabled={updatePrefs.isPending}
        />
        <ToggleRow
          icon={<TrendingUp className="h-4 w-4" />}
          label="Resumen Semanal del Portfolio"
          description="Revision semanal de rendimiento con analisis de IA"
          checked={prefs.weeklyDigest}
          onChange={(v) => handleToggle("weeklyDigest", v)}
          disabled={updatePrefs.isPending}
        />
        <ToggleRow
          icon={<Bell className="h-4 w-4" />}
          label="Alertas de Precio"
          description="Notificaciones cuando se alcanzan los precios objetivo"
          checked={prefs.priceAlerts}
          onChange={(v) => handleToggle("priceAlerts", v)}
          disabled={updatePrefs.isPending}
        />
        <ToggleRow
          icon={<Shield className="h-4 w-4" />}
          label="Alertas de Seguridad"
          description="Alertas por inicios de sesion en nuevos dispositivos — recomendado"
          checked={prefs.securityAlerts}
          onChange={(v) => handleToggle("securityAlerts", v)}
          disabled={updatePrefs.isPending}
        />
      </div>
    </div>
  );
}
