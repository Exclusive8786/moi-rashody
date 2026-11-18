import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { AppProvider, useApp } from "./store";
import { ToastProvider } from "./components/Toast";
import { HomeScreen } from "./screens/Home";
import { ExpensesScreen } from "./screens/Expenses";
import { ReportScreen } from "./screens/Report";
import { SettingsScreen } from "./screens/Settings";
import { ChartIcon, GearIcon, ListIcon, MenuIcon, WalletIcon } from "./components/Icons";
import type { PeriodKind } from "./types";

interface Route {
  path: string;
  params: URLSearchParams;
}

function parseRoute(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function navigate(path: string) {
  window.location.hash = path;
}

const PERIOD_IDS: PeriodKind[] = ["month", "prev", "quarter", "year", "custom"];

function applyTheme(mode: "system" | "light" | "dark") {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const resolve = () => (mode === "system" ? (media.matches ? "dark" : "light") : mode);
  const apply = () => {
    document.documentElement.dataset.theme = resolve();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolve() === "dark" ? "#0E1117" : "#F4F6FA");
  };
  apply();
  if (mode === "system") {
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }
  return undefined;
}

function Drawer({ open, onClose, path }: { open: boolean; onClose: () => void; path: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    { path: "/expenses", label: "Расходы", icon: <ListIcon size={22} /> },
    { path: "/report", label: "Отчёт", icon: <ChartIcon size={22} /> },
    { path: "/settings", label: "Настройки", icon: <GearIcon size={22} /> },
  ];

  return (
    <div className="drawer-root">
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Меню">
        <div className="drawer-head">
          <span className="drawer-logo">
            <WalletIcon size={20} />
          </span>
          <div>
            <div className="drawer-title">Мои Расходы</div>
            <div className="drawer-version">версия 1.0</div>
          </div>
        </div>
        <nav className="drawer-nav">
          {items.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`drawer-item ${path === item.path ? "active" : ""}`}
              onClick={() => {
                onClose();
                navigate(item.path);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <p className="drawer-note">Данные хранятся только на этом устройстве.</p>
      </aside>
    </div>
  );
}

function Shell() {
  const { status, error, settings } = useApp();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const cleanup = applyTheme(settings.theme);
    return cleanup;
  }, [settings.theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path, route.params.toString()]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    NativeApp.addListener("backButton", () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && hash !== "/") {
        window.history.back();
      } else {
        void NativeApp.exitApp();
      }
    }).then((handle) => {
      if (disposed) void handle.remove();
      else remove = () => void handle.remove();
    });
    return () => {
      disposed = true;
      remove?.();
    };
  }, []);

  const go = useCallback((path: string) => navigate(path), []);
  const back = useCallback(() => navigate("/"), []);

  if (status === "loading") {
    return (
      <div className="splash">
        <div className="splash-logo">
          <WalletIcon size={34} />
        </div>
        <p>Мои Расходы</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="splash">
        <p className="form-error">{error}</p>
      </div>
    );
  }

  const initialPeriod = PERIOD_IDS.includes(route.params.get("period") as PeriodKind)
    ? (route.params.get("period") as PeriodKind)
    : "month";

  return (
    <div className={`app ${route.path !== "/" ? "has-fab" : ""}`}>
      {route.path === "/expenses" && (
        <ExpensesScreen onBack={back} onNavigate={go} />
      )}
      {route.path === "/report" && (
        <ReportScreen onBack={back} onNavigate={go} initialPeriod={initialPeriod} />
      )}
      {route.path === "/settings" && (
        <SettingsScreen
          onBack={back}
          openNewCategory={route.params.get("newCategory") === "1"}
        />
      )}
      {(route.path === "/" || !["/expenses", "/report", "/settings"].includes(route.path)) && (
        <HomeScreen onOpenMenu={() => setDrawerOpen(true)} onNavigate={go} />
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} path={route.path} />

      {route.path !== "/" && (
        <button
          type="button"
          className="floating-menu"
          aria-label="Меню"
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon size={22} />
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}
