"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, ExternalLink, X } from "lucide-react";
import { useIOLNotifications } from "@/hooks/useIOLNotifications";
import { useIOLStatus } from "@/hooks/useIOLStatus";
import { cn } from "@/lib/utils";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: status } = useIOLStatus();
  const { data, isLoading } = useIOLNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Don't show if IOL not connected
  if (!status?.connected) {
    return null;
  }

  const notifications = data?.notifications || [];
  const hasNotifications = notifications.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 text-xs font-medium rounded-lg border transition-colors relative",
          hasNotifications
            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
            : "border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
        )}
        title="IOL Notifications"
        aria-label="IOL Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        {hasNotifications && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-cyan-500 text-[10px] font-bold text-zinc-900 flex items-center justify-center">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Notificaciones IOL</h3>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="py-2">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-zinc-500" aria-live="polite">
                Cargando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zinc-500">
                No hay notificaciones
              </div>
            ) : (
              notifications.map((notification, index) => (
                <div
                  key={index}
                  className="px-4 py-3 hover:bg-zinc-800/50 border-b border-zinc-800/50 last:border-0"
                >
                  <p className="text-sm font-medium text-zinc-200 mb-1">
                    {notification.titulo}
                  </p>
                  <p className="text-xs text-zinc-400 mb-2">
                    {notification.mensaje}
                  </p>
                  {notification.link && (
                    <a
                      href={notification.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Ver más <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
