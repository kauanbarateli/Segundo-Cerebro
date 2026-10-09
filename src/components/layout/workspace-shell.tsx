"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { filterRoutes, getRouteByPath, getVisibleRoutes, type WorkspaceRoute } from "@/lib/navigation/routes";
import { NavigationIcon } from "./navigation-icon";
import { ConnectedCommandFeedback } from "./connected-command-feedback";
import avatar from "./illustrative-avatar.jpg";
import "./workspace-shell.css";

function ExitControl({ connected, onExit }: { connected: boolean; onExit: () => void }) {
  const label = connected ? "Sair da conta" : "Sair da demonstração";
  const content = <><Icons.Logout /><span>{label}</span></>;
  return connected
    ? <form action="/auth/logout" method="post" className="shell-exit-form" onSubmit={onExit}><button type="submit" className="shell-nav-link" aria-label={label} title={label}>{content}</button></form>
    : <Link className="shell-nav-link" href="/sair" aria-label={label} title={label} onClick={onExit}>{content}</Link>;
}

function RouteLink({ route, pathname, onNavigate, compact = false }: {
  route: WorkspaceRoute; pathname: string; onNavigate?: () => void; compact?: boolean;
}) {
  return (
    <Link href={route.href} className={compact ? "shell-bottom-link" : "shell-nav-link"}
      aria-current={pathname === route.href ? "page" : undefined} aria-label={route.label}
      title={route.label} onClick={onNavigate}>
      <NavigationIcon feature={route.feature} /><span>{route.label}</span>
    </Link>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { policy, connected } = useDemoAccess();
  const { logout } = useDemoApplication();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const profilePopover = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const routes = getVisibleRoutes(policy);
  const primaryRoutes = routes.slice(0, 4);
  const overflowRoutes = routes.slice(4);
  const results = filterRoutes(routes, query);
  const current = getRouteByPath(pathname);
  const activityAllowed = connected && resolveAccess("inicio", policy).allowed;
  const context = current?.label ?? (pathname === "/atividade" ? "Atividade" : pathname === "/ajuda" ? "Ajuda" : "Demonstração");
  const moreActive = overflowRoutes.some((route) => route.href === pathname) || pathname === "/atividade" || pathname === "/ajuda" || pathname === "/sair";

  const closeProfile = () => profilePopover.current?.hidePopover();
  const openSearch = () => { setQuery(""); setSearchOpen(true); };
  const leaveDemo = () => { logout(); setMoreOpen(false); closeProfile(); };

  useEffect(() => {
    if (pathname === "/sair") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMoreOpen(false);
        profilePopover.current?.hidePopover();
        setQuery("");
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      main.current?.focus();
    }
  }, [pathname]);

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
    <div className="workspace-shell" data-collapsed={collapsed}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <aside className="shell-rail" aria-label="Trilho de navegação">
        <Link className="shell-brand" href="/" aria-label="Segundo Cérebro · Início">
          <Brand variant="compact" size={34} />
        </Link>
        <nav aria-label="Navegação principal" className="shell-route-list">
          {routes.map((route) => <RouteLink key={route.feature} route={route} pathname={pathname} />)}
        </nav>
        <div className="shell-rail-footer">
          {activityAllowed && <Link className="shell-nav-link" href="/atividade" aria-label="Atividade" title="Atividade" aria-current={pathname === "/atividade" ? "page" : undefined}>
            <Icons.Clock /><span>Atividade</span>
          </Link>}
          <Link className="shell-nav-link" href="/ajuda" aria-label="Ajuda" title="Ajuda" aria-current={pathname === "/ajuda" ? "page" : undefined}>
            <Icons.Help /><span>Ajuda</span>
          </Link>
          <ExitControl connected={connected} onExit={leaveDemo} />
          <Button className="shell-collapse" variant="ghost" onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"} aria-expanded={!collapsed}>
            <Icons.ChevronRight /><span>{collapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>
      </aside>

      <div className="shell-content">
        <header className="shell-header">
          <div className="shell-context"><span>{context}</span><span className="shell-demo-label">{connected ? "Conta conectada" : "Demonstração"}</span></div>
          <Link href="/" className="shell-mobile-brand" aria-label="Segundo Cérebro · Início"><Brand variant="symbol" size={28} /></Link>
          <Button className="shell-search" variant="ghost" onClick={openSearch} aria-label="Buscar módulos" aria-keyshortcuts="Control+k Meta+k">
            <Icons.Search /><span className="shell-search-label">Buscar</span><kbd>Ctrl K</kbd>
          </Button>
          <ThemeSelector />
          <Button className="shell-profile-trigger" variant="ghost" popoverTarget="shell-profile" aria-label={connected ? "Abrir opções da conta" : "Abrir perfil de demonstração"}>
            {connected ? <Icons.User /> : <Image src={avatar} alt="" width={36} height={36} unoptimized />}
          </Button>
          <div id="shell-profile" ref={profilePopover} popover="auto" className="shell-profile">
            <p className="shell-profile-title">{connected ? "Sua conta" : "Perfil de demonstração"}</p>
            <p>{connected ? "Capturar e Tarefas são salvos na sua conta. As demais áreas ainda usam exemplos." : "Foto ilustrativa. Nenhuma conta está conectada."}</p>
            {activityAllowed && <Link href="/atividade" className="shell-nav-link" onClick={closeProfile}><Icons.Clock /><span>Atividade</span></Link>}
            <Link href="/configuracoes" className="shell-nav-link" onClick={closeProfile}><Icons.Settings /><span>Configurações</span></Link>
            <Link href="/ajuda" className="shell-nav-link" onClick={closeProfile}><Icons.Help /><span>Ajuda</span></Link>
            {connected && <Link href="/trocar-senha" className="shell-nav-link" onClick={closeProfile}><Icons.Lock /><span>Trocar senha</span></Link>}
            <ExitControl connected={connected} onExit={leaveDemo} />
          </div>
        </header>

        <main id="conteudo" ref={main} tabIndex={-1} className="shell-main"><ConnectedCommandFeedback>{children}</ConnectedCommandFeedback></main>
        <footer className="shell-status">{connected ? "Capturar e Tarefas são salvos na sua conta. As demais áreas ainda usam exemplos." : "Demonstração de navegação · Os módulos estão em construção."}</footer>
      </div>

      <nav className="shell-bottom" aria-label="Navegação no celular">
        {primaryRoutes.map((route) => <RouteLink key={route.feature} route={route} pathname={pathname} compact />)}
        <Button variant="ghost" className="shell-bottom-link" onClick={() => setMoreOpen(true)}
          aria-label="Mais módulos e conta" aria-haspopup="dialog" aria-expanded={moreOpen} data-active={moreActive || undefined}>
          <Icons.Dots /><span>Mais</span>
        </Button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} variant="sheet" title="Mais módulos" description={connected ? "Outras áreas e opções da sua conta." : "Outras áreas e opções desta demonstração."}>
        <nav className="shell-more-list" aria-label="Mais navegação">
          {overflowRoutes.map((route) => <RouteLink key={route.feature} route={route} pathname={pathname} onNavigate={() => setMoreOpen(false)} />)}
          {activityAllowed && <Link className="shell-nav-link" href="/atividade" aria-current={pathname === "/atividade" ? "page" : undefined} onClick={() => setMoreOpen(false)}><Icons.Clock /><span>Atividade</span></Link>}
          <Link className="shell-nav-link" href="/ajuda" onClick={() => setMoreOpen(false)}><Icons.Help /><span>Ajuda</span></Link>
          <ExitControl connected={connected} onExit={leaveDemo} />
        </nav>
      </Dialog>

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} title="Buscar módulos" initialFocusRef={searchInput}
        description="Atalhos da navegação. A busca nas suas informações será disponibilizada em uma próxima etapa.">
        <Field label="Nome do módulo" type="search" ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Busque por tarefas, notas ou agenda" onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setSearchOpen(false); }
          }} />
        <p className="shell-search-count" role="status">{results.length} {results.length === 1 ? "atalho disponível" : "atalhos disponíveis"}</p>
        <nav className="shell-search-results" aria-label="Resultados de módulos">
          {results.map((route) => <RouteLink key={route.feature} route={route} pathname={pathname} onNavigate={() => setSearchOpen(false)} />)}
        </nav>
        {results.length === 0 && <p className="shell-no-results">Nenhum módulo encontrado. Tente outro nome ou reveja a visibilidade em Configurações.</p>}
      </Dialog>
    </div>
  );
}
