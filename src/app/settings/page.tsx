"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import {
  Settings,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { relativeDate } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EmailPreferences } from "@/components/settings/EmailPreferences";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-zinc-950 px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center">
            <Settings className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Configuracion</h1>
            <p className="text-sm text-zinc-500">
              Gestionar conexiones y notificaciones
            </p>
          </div>
        </div>

        {/* IOL Connection */}
        <IOLConnectionCard />

        {/* Binance Connection */}
        <BinanceConnectionCard />

        {/* PPI Connection */}
        <PPIConnectionCard />

        {/* Email Notifications */}
        <EmailPreferences />
      </div>
    </div>
    </ErrorBoundary>
  );
}

function IOLConnectionCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { addToast } = useToast();
  const [status, setStatus] = useState<{
    connected: boolean;
    updatedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Fetch connection status
  useEffect(() => {
    fetch("/api/iol/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);

    try {
      const res = await fetch("/api/iol/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de conexion");
      }

      setStatus({ connected: true, updatedAt: new Date().toISOString() });
      addToast("IOL conectado exitosamente!", "success");

      // Invalidate portfolio cache and redirect to dashboard
      queryClient.invalidateQueries({ queryKey: ["iol-portfolio"] });
      router.push("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error de conexion", "error");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "Estas seguro de que queres desconectar IOL? Vas a necesitar volver a ingresar tus credenciales para reconectar."
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      await fetch("/api/iol/auth", { method: "DELETE" });
      setStatus({ connected: false, updatedAt: null });
      addToast("IOL desconectado", "info");
    } catch {
      addToast("Error al desconectar", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      const res = await fetch("/api/iol/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de sincronizacion");
      }

      addToast("Portfolio sincronizado!", "success");

      // Invalidate portfolio cache so dashboard shows fresh data
      queryClient.invalidateQueries({ queryKey: ["iol-portfolio"] });

      // Redirect to dashboard after successful sync
      router.push("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error de sincronizacion", "error");
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <span className="text-blue-400 font-bold text-sm">IOL</span>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">InvertirOnline</h3>
            <p className="text-xs text-zinc-500">
              Sincroniza tus CEDEARs y acciones argentinas
            </p>
          </div>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-4">
          {status.updatedAt && (
            <p className="text-xs text-zinc-500">
              Ultima sincronizacion: {relativeDate(status.updatedAt)}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 h-10 rounded-lg bg-blue-600 hover:bg-blue-500
                         disabled:opacity-50 text-white text-sm font-medium
                         transition-colors inline-flex items-center justify-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncing ? "Sincronizando..." : "Sincronizar Portfolio"}
            </button>
            <button
              onClick={handleDisconnect}
              className="h-10 px-4 rounded-lg border border-zinc-700 bg-zinc-800
                         text-zinc-300 hover:text-white hover:bg-zinc-700
                         text-sm font-medium transition-colors
                         inline-flex items-center justify-center gap-2"
            >
              <Unlink className="h-4 w-4" />
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Usuario / Email de IOL
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your@email.com"
                aria-label="IOL Username or Email"
                required
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900
                           px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                           focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Contrasena de IOL
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Contrasena de IOL"
                required
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900
                           px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                           focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Tus credenciales se usan solo para autenticar con la API de IOL.
            Solo almacenamos el token de acceso, no tu contrasena.
          </p>

          <button
            type="submit"
            disabled={connecting}
            className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500
                       disabled:opacity-50 text-white text-sm font-medium
                       transition-colors inline-flex items-center justify-center gap-2"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {connecting ? "Conectando..." : "Conectar a IOL"}
          </button>
        </form>
      )}
    </div>
  );
}

function BinanceConnectionCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { addToast } = useToast();
  const [status, setStatus] = useState<{
    connected: boolean;
    updatedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  // Fetch connection status
  useEffect(() => {
    fetch("/api/binance/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);

    try {
      const res = await fetch("/api/binance/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de conexion");
      }

      setStatus({ connected: true, updatedAt: new Date().toISOString() });
      addToast("Binance conectado exitosamente!", "success");

      // Invalidate portfolio cache and redirect to dashboard
      queryClient.invalidateQueries({ queryKey: ["binance-portfolio"] });
      router.push("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error de conexion", "error");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "Estas seguro de que queres desconectar Binance? Vas a necesitar volver a ingresar tus API keys para reconectar."
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      await fetch("/api/binance/auth", { method: "DELETE" });
      setStatus({ connected: false, updatedAt: null });
      queryClient.invalidateQueries({ queryKey: ["binance-portfolio"] });
      addToast("Binance desconectado", "info");
    } catch {
      addToast("Error al desconectar", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <span className="text-yellow-400 font-bold text-sm">₿</span>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">Binance</h3>
            <p className="text-xs text-zinc-500">
              Sincroniza tus tenencias crypto
            </p>
          </div>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-4">
          {status.updatedAt && (
            <p className="text-xs text-zinc-500">
              Conectado: {relativeDate(status.updatedAt)}
            </p>
          )}

          <button
            onClick={handleDisconnect}
            className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800
                       text-zinc-300 hover:text-white hover:bg-zinc-700
                       text-sm font-medium transition-colors
                       inline-flex items-center justify-center gap-2"
          >
            <Unlink className="h-4 w-4" />
            Desconectar
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ingresa tu API key de Binance"
                aria-label="Binance API Key"
                required
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900
                           px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                           focus:outline-none focus:ring-1 focus:ring-yellow-500/50
                           font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                API Secret
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Ingresa tu API secret de Binance"
                aria-label="Binance API Secret"
                required
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900
                           px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                           focus:outline-none focus:ring-1 focus:ring-yellow-500/50
                           font-mono text-xs"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Crea una API key en{" "}
            <a
              href="https://www.binance.com/en/my/settings/api-management"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-500 hover:underline"
            >
              Binance API Management
            </a>
            . Solo se requiere permiso de &quot;lectura&quot;.
          </p>

          <button
            type="submit"
            disabled={connecting}
            className="w-full h-10 rounded-lg bg-yellow-500 hover:bg-yellow-400
                       disabled:opacity-50 text-black text-sm font-medium
                       transition-colors inline-flex items-center justify-center gap-2"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {connecting ? "Conectando..." : "Conectar a Binance"}
          </button>
        </form>
      )}
    </div>
  );
}

function PPIConnectionCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { addToast } = useToast();
  const [status, setStatus] = useState<{
    connected: boolean;
    updatedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form state — public + private key
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  // Fetch connection status
  useEffect(() => {
    fetch("/api/ppi/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);

    try {
      const res = await fetch("/api/ppi/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de conexion");
      }

      setStatus({ connected: true, updatedAt: new Date().toISOString() });
      addToast("PPI conectado exitosamente!", "success");

      queryClient.invalidateQueries({ queryKey: ["ppi-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["ppi-status"] });
      router.push("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error de conexion", "error");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "Estas seguro de que queres desconectar PPI? Vas a necesitar volver a ingresar tus API keys para reconectar."
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      await fetch("/api/ppi/auth", { method: "DELETE" });
      setStatus({ connected: false, updatedAt: null });
      queryClient.invalidateQueries({ queryKey: ["ppi-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["ppi-status"] });
      addToast("PPI desconectado", "info");
    } catch {
      addToast("Error al desconectar", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      const res = await fetch("/api/ppi/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de sincronizacion");
      }

      addToast("Portfolio PPI sincronizado!", "success");
      queryClient.invalidateQueries({ queryKey: ["ppi-portfolio"] });
      router.push("/");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error de sincronizacion", "error");
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <span className="text-violet-400 font-bold text-sm">PPI</span>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">Portfolio Personal</h3>
            <p className="text-xs text-zinc-500">
              Sincroniza tus acciones, CEDEARs y bonos
            </p>
          </div>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-4">
          {status.updatedAt && (
            <p className="text-xs text-zinc-500">
              Ultima sincronizacion: {relativeDate(status.updatedAt)}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 h-10 rounded-lg bg-violet-600 hover:bg-violet-500
                         disabled:opacity-50 text-white text-sm font-medium
                         transition-colors inline-flex items-center justify-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncing ? "Sincronizando..." : "Sincronizar Portfolio"}
            </button>
            <button
              onClick={handleDisconnect}
              className="h-10 px-4 rounded-lg border border-zinc-700 bg-zinc-800
                         text-zinc-300 hover:text-white hover:bg-zinc-700
                         text-sm font-medium transition-colors
                         inline-flex items-center justify-center gap-2"
            >
              <Unlink className="h-4 w-4" />
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Clave Publica
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ingresa tu clave publica"
                aria-label="PPI Clave Publica"
                required
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900
                           px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                           focus:outline-none focus:ring-1 focus:ring-violet-500/50
                           font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Clave Privada
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Ingresa tu clave privada"
                aria-label="PPI Clave Privada"
                required
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900
                           px-3 text-sm text-zinc-200 placeholder:text-zinc-500
                           focus:outline-none focus:ring-1 focus:ring-violet-500/50
                           font-mono text-xs"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Obtene las credenciales API desde PPI &rarr; Gestiones &rarr; Gestion de servicio API.
            Solo se requieren permisos de lectura.
          </p>

          <button
            type="submit"
            disabled={connecting}
            className="w-full h-10 rounded-lg bg-violet-600 hover:bg-violet-500
                       disabled:opacity-50 text-white text-sm font-medium
                       transition-colors inline-flex items-center justify-center gap-2"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {connecting ? "Conectando..." : "Conectar a PPI"}
          </button>
        </form>
      )}
    </div>
  );
}
