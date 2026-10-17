"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { getRouteByPath, getVisibleRoutes, type WorkspaceRoute } from "@/lib/navigation/routes";
import { groupNavigationRoutes } from "@/lib/navigation/groups";
import {
  applySidebarState, readSidebarChoice, resolveSidebarState, saveSidebarChoice,
  SIDEBAR_COMPACT_QUERY, SIDEBAR_MOBILE_QUERY,
} from "@/lib/navigation/sidebar-preference";
import { NavigationIcon } from "./navigation-icon";
import { ConnectedCommandFeedback } from "./connected-command-feedback";
import { CommandPalette } from "./command-palette";
import { fileReadUrl } from "./file-upload";
import { CalendarMeetingReminders } from "./calendar-meeting-reminders";
import { ThemeSelector } from "@/components/theme/theme-selector";
import avatar from "./illustrative-avatar.jpg";
import "./workspace-shell.css";

const subscribeSidebar = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar"] });
  return () => observer.disconnect();
};
const sidebarCollapsedSnapshot = () => document.documentElement.getAttribute("data-sidebar") === "collapsed";

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function ExitControl({ connected, onExit }: { connected: boolean; onExit: () => void }) {
  const label = connected ? "Sair da conta" : "Sair da demonstração";
  const content = <><Icons.Logout /><span>{label}</span></>;
  return connected
    ? <form action="/auth/logout" method="post" className="shell-exit-form" onSubmit={onExit}><button type="submit" className="shell-menu-link" aria-label={label}>{content}</button></form>
    : <Link className="shell-menu-link" href="/sair" aria-label={label} onClick={onExit}>{content}</Link>;
}

function RouteLink({ route, pathname, badge, onNavigate }: {
  route: WorkspaceRoute; pathname: string; badge?: number; onNavigate?: () => void;
}) {
  const current = pathname === route.href;
  return (
    <Link href={route.href} className="shell-nav-link" aria-current={current ? "page" : undefined}
      aria-label={route.label} data-nav-tip={route.label} onClick={onNavigate}>
      <NavigationIcon feature={route.feature} />
      <span className="shell-nav-label">{route.label}</span>
      {badge ? <span className="shell-nav-count" aria-hidden="true">{badge}</span> : current ? <span className="shell-nav-dot" aria-hidden="true" /> : null}
    </Link>
  );
}

function BottomLink({ route, pathname }: { route: WorkspaceRoute; pathname: string }) {
  return (
    <Link href={route.href} className="shell-bottom-link" aria-current={pathname === route.href ? "page" : undefined} aria-label={route.label}>
      <NavigationIcon feature={route.feature} /><span>{route.label === "Calendário" ? "Agenda" : route.label}</span>
    </Link>
  );
}

export function WorkspaceShell({ children, avatarId = null, displayName = null }: { children: ReactNode; avatarId?: string | null; displayName?: string | null }) {
  const pathname = usePathname();
  const { policy, connected } = useDemoAccess();
  const { logout, userId } = useDemoApplication();
  const collapsed = useSyncExternalStore(subscribeSidebar, sidebarCollapsedSnapshot, () => false);
  const compact = useMediaQuery(SIDEBAR_COMPACT_QUERY);
  const mobile = useMediaQuery(SIDEBAR_MOBILE_QUERY);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tip, setTip] = useState<{ text: string; left: number; top: number } | null>(null);
  const profilePopover = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const mobileOpener = useRef<HTMLElement | null>(null);
  const restoreMobileFocus = useRef(false);
  const tipTarget = useRef<HTMLElement | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const routes = getVisibleRoutes(policy);
  const navigation = groupNavigationRoutes(routes);
  const bottomRoutes = navigation.groups.flatMap((group) => group.routes).slice(0, 4);
  const current = getRouteByPath(pathname);
  const activityAllowed = connected && resolveAccess("inicio", policy).allowed;
  const captureAllowed = resolveAccess("capturar", policy).allowed;
  const context = current?.label ?? (pathname === "/atividade" ? "Atividade" : pathname === "/ajuda" ? "Ajuda" : "Demonstração");
  const overlay = mobile && mobileOpen;
  const profileName = connected ? displayName?.trim() || "Sua conta" : "Perfil de demonstração";
  const profileDetail = connected ? "Meu espaço pessoal" : "Foto ilustrativa";

  const closeProfile = () => profilePopover.current?.hidePopover();
  const openSearch = () => { closeProfile(); setMobileOpen(false); setSearchOpen(true); };
  const leaveDemo = () => { logout(); setMobileOpen(false); closeProfile(); };

  const hideTip = useCallback(() => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTarget.current?.removeAttribute("aria-describedby");
    tipTarget.current = null;
    setTip(null);
  }, []);

  const showTip = useCallback((target: EventTarget | null) => {
    const element = target instanceof Element ? target.closest<HTMLElement>("[data-nav-tip]") : null;
    if (!element || !sidebar.current?.contains(element) || !collapsed || mobile) return;
    if (tipTimer.current) clearTimeout(tipTimer.current);
    if (tipTarget.current && tipTarget.current !== element) tipTarget.current.removeAttribute("aria-describedby");
    const rect = element.getBoundingClientRect();
    tipTarget.current = element;
    element.setAttribute("aria-describedby", "shell-nav-tip");
    // OBSERVADO: 10px to the right of the item, clamped to the window.
    setTip({ text: element.dataset.navTip ?? "", left: rect.right + 10, top: Math.max(8, Math.min(window.innerHeight - 44, rect.top + (rect.height - 36) / 2)) });
  }, [collapsed, mobile]);

  const toggleSidebar = () => {
    const next = collapsed ? "expanded" : "collapsed";
    saveSidebarChoice(next);
    applySidebarState(next);
    hideTip();
  };

  const openMobile = (opener: HTMLElement) => {
    mobileOpener.current = opener;
    closeProfile();
    setMobileOpen(true);
  };
  const closeMobile = useCallback((restoreFocus = true) => {
    // Focus returns after React removes `inert` from the background (effect below).
    restoreMobileFocus.current = restoreFocus;
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    // The responsive fallback follows the window only while no choice was saved.
    if (!readSidebarChoice()) applySidebarState(resolveSidebarState(null, compact));
  }, [compact]);

  useEffect(() => {
    if (!mobile) setMobileOpen(false);
  }, [mobile]);

  useEffect(() => {
    hideTip();
  }, [collapsed, mobile, hideTip]);

  useEffect(() => {
    if (!overlay) {
      if (restoreMobileFocus.current && mobileOpener.current?.isConnected) mobileOpener.current.focus({ preventScroll: true });
      restoreMobileFocus.current = false;
      return;
    }
    closeButton.current?.focus({ preventScroll: true });
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => { body.style.overflow = previousOverflow; };
  }, [overlay]);

  useEffect(() => {
    const root = document.documentElement;
    const onKey = () => root.setAttribute("data-input", "keyboard");
    const onPointer = () => root.setAttribute("data-input", "pointer");
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  useEffect(() => {
    if (!tip) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") hideTip(); };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("scroll", hideTip, true);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("scroll", hideTip, true);
    };
  }, [tip, hideTip]);

  useEffect(() => {
    if (pathname === "/sair") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        profilePopover.current?.hidePopover();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setMobileOpen(false);
      main.current?.focus();
    }
  }, [pathname]);

  const onSidebarKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!overlay) return;
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      closeMobile();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"))
      .filter((item) => item.getClientRects().length > 0 && !item.closest("[popover]:not(:popover-open)"));
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (pathname === "/sair") {
    return (
      <div className="shell-exit">
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        <header className="shell-exit-header"><Brand variant="compact" size={36} /><ThemeSelector /></header>
        <main id="conteudo" ref={main} tabIndex={-1} className="shell-main"><ConnectedCommandFeedback>{children}</ConnectedCommandFeedback></main>
      </div>
    );
  }

  return (
    <div className="workspace-shell" data-mobile-open={overlay || undefined}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {overlay && <div className="shell-scrim" aria-hidden="true" onClick={() => closeMobile()} />}

      <aside
        id="shell-sidebar"
        ref={sidebar}
        className="shell-sidebar"
        aria-label={overlay ? "Menu de navegação" : "Trilho de navegação"}
        role={overlay ? "dialog" : undefined}
        aria-modal={overlay || undefined}
        inert={mobile && !mobileOpen}
        onKeyDown={onSidebarKeyDown}
        onPointerOver={(event) => { if (event.pointerType === "mouse") showTip(event.target); }}
        onPointerOut={(event) => {
          if (!tipTarget.current || tipTarget.current.contains(event.relatedTarget as Node | null)) return;
          tipTimer.current = setTimeout(hideTip, 160);
        }}
        onFocus={(event) => showTip(event.target)}
        onBlur={hideTip}
        onClick={hideTip}
      >
        <div className="shell-brand-row">
          <Link className="shell-brand" href="/" aria-label="Segundo Cérebro · Início" data-nav-tip="Segundo Cérebro">
            <Brand variant="stacked" size={38} />
          </Link>
          <Button ref={closeButton} variant="ghost" className="shell-sidebar-close" aria-label="Fechar navegação" onClick={() => closeMobile()}>
            <Icons.X />
          </Button>
        </div>

        <nav aria-label="Navegação principal" className="shell-nav-region">
          <div className="shell-sidebar-scroll">
            <button type="button" className="shell-sidebar-search" onClick={openSearch} aria-label="Buscar informações"
              aria-keyshortcuts="Control+k Meta+k" data-nav-tip="Buscar · Ctrl K">
              <Icons.Search /><span className="shell-nav-label">Buscar</span><kbd>Ctrl K</kbd>
            </button>
            <div className="shell-nav" data-labeled={navigation.labeled}>
              {navigation.groups.map((group) => (
                <div key={group.key} className="shell-nav-group" role={group.label ? "group" : undefined} aria-label={group.label ?? undefined}>
                  {group.label && <span className="shell-nav-group-label" aria-hidden="true">{group.label}</span>}
                  {group.routes.map((route) => <RouteLink key={route.feature} route={route} pathname={pathname} />)}
                </div>
              ))}
            </div>
          </div>
          {navigation.utility.length > 0 && <div className="shell-nav-group shell-nav-utility">
            {navigation.utility.map((route) => <RouteLink key={route.feature} route={route} pathname={pathname} />)}
          </div>}
        </nav>

        <div className="shell-sidebar-footer">
          <Link className="shell-nav-link" href="/ajuda" aria-label="Ajuda" data-nav-tip="Ajuda" aria-current={pathname === "/ajuda" ? "page" : undefined}>
            <Icons.Help /><span className="shell-nav-label">Ajuda</span>
          </Link>
          <button type="button" className="shell-profile-trigger" popoverTarget="shell-profile"
            aria-label={connected ? "Abrir opções da conta" : "Abrir perfil de demonstração"} data-nav-tip={connected ? "Sua conta" : "Perfil de demonstração"}>
            <span className="shell-avatar" aria-hidden="true">
              {connected ? avatarId ? (
                // Private authorization URL is resolved by the Storage route.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileReadUrl(avatarId, userId)} alt="" width={36} height={36} />
              ) : <Icons.User /> : <Image src={avatar} alt="" width={36} height={36} unoptimized />}
            </span>
            <span className="shell-profile-copy"><strong>{profileName}</strong><small>{profileDetail}</small></span>
            <Icons.ChevronDown className="shell-profile-chevron" />
          </button>
          <div id="shell-profile" ref={profilePopover} popover="auto" className="shell-profile">
            <p className="shell-profile-title">{connected ? "Sua conta" : "Perfil de demonstração"}</p>
            <p>{connected ? "Seus registros são salvos na sua conta." : "Foto ilustrativa. Nenhuma conta está conectada."}</p>
            {activityAllowed && <Link href="/atividade" className="shell-menu-link" onClick={closeProfile}><Icons.Activity /><span>Atividade</span></Link>}
            <Link href="/configuracoes" className="shell-menu-link" onClick={closeProfile}><Icons.Settings /><span>Configurações</span></Link>
            <Link href="/ajuda" className="shell-menu-link" onClick={closeProfile}><Icons.Help /><span>Ajuda</span></Link>
            {connected && <Link href="/trocar-senha" className="shell-menu-link" onClick={closeProfile}><Icons.Lock /><span>Trocar senha</span></Link>}
            <ExitControl connected={connected} onExit={leaveDemo} />
          </div>
        </div>
      </aside>

      {tip && <div id="shell-nav-tip" className="shell-nav-tip" role="tooltip" style={{ left: tip.left, top: tip.top }}
        onPointerEnter={() => { if (tipTimer.current) clearTimeout(tipTimer.current); }}
        onPointerLeave={() => { tipTimer.current = setTimeout(hideTip, 160); }}>{tip.text}</div>}

      <div className="shell-workspace" inert={overlay}>
        <header className="shell-topbar">
          <div className="shell-breadcrumb">
            <Button variant="ghost" className="shell-sidebar-toggle" onClick={toggleSidebar} aria-controls="shell-sidebar"
              aria-expanded={!collapsed} aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"} title={collapsed ? "Expandir navegação" : "Recolher navegação"}>
              <Icons.PanelLeft />
            </Button>
            <Button variant="ghost" className="shell-menu-button" onClick={(event) => openMobile(event.currentTarget)} aria-controls="shell-sidebar"
              aria-expanded={overlay} aria-haspopup="dialog" aria-label="Abrir navegação">
              <Icons.Menu />
            </Button>
            <span className="shell-breadcrumb-root">{connected ? "Meu espaço" : "Demonstração"}</span>
            <Icons.ChevronRight className="shell-breadcrumb-separator" />
            <strong className="shell-breadcrumb-current">{context}</strong>
          </div>
          <div className="shell-top-actions">
            <span className="shell-mode"><span className="shell-mode-dot" aria-hidden="true" /><span className="shell-demo-label">{connected ? "Conta conectada" : "Demonstração"}</span></span>
            <Button variant="ghost" className="shell-top-search" onClick={openSearch} aria-label="Buscar informações" aria-keyshortcuts="Control+k Meta+k">
              <Icons.Search />
            </Button>
            <ThemeToggle />
            {activityAllowed && <Link className="shell-icon-link" href="/atividade" aria-label="Atividade" title="Atividade" aria-current={pathname === "/atividade" ? "page" : undefined}><Icons.Activity /></Link>}
            {captureAllowed && <Link className="shell-capture" href="/capturar"><Icons.Capture /><span>Capturar</span></Link>}
          </div>
        </header>

        <main id="conteudo" ref={main} tabIndex={-1} className="shell-main"><ConnectedCommandFeedback>{children}</ConnectedCommandFeedback></main>
        <footer className="shell-footer">
          <span>Um lugar para pensar com clareza.</span>
          <span className="shell-status">{connected ? "Seus registros são salvos na sua conta." : "Demonstração · Alterações guardadas somente nesta visita."}</span>
        </footer>
      </div>

      <nav className="shell-bottom" aria-label="Navegação no celular" inert={overlay}>
        {bottomRoutes.map((route) => <BottomLink key={route.feature} route={route} pathname={pathname} />)}
        <button type="button" className="shell-bottom-link" onClick={(event) => openMobile(event.currentTarget)}
          aria-label="Mais módulos e conta" aria-haspopup="dialog" aria-controls="shell-sidebar" aria-expanded={overlay}
          data-active={!bottomRoutes.some((route) => route.href === pathname) || undefined}>
          <Icons.Menu /><span>Mais</span>
        </button>
      </nav>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CalendarMeetingReminders />
    </div>
  );
}
