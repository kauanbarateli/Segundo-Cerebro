"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icons } from "@/components/ui/icons";
import type { GroupedNavigation } from "@/lib/navigation/groups";
import { NavigationIcon } from "./navigation-icon";
import "./desktop-dock.css";

/**
 * Optional desktop navigation (doc21). Always server-rendered as static Next links;
 * CSS shows it only for `html[data-desktop-navigation="dock"]` on eligible desktops,
 * so the sidebar stays usable while this chunk loads or if it fails. Items come from
 * the same navigation routes as the sidebar (policy order, entitlements) — never
 * from a fixed list. No mobile variant: phones keep the existing bottom navigation.
 */
export interface DockEntry { key: string; href: string; label: string; icon: ReactNode; separatorBefore: boolean }

/** OBSERVADO in the refined prototype: 44px tile, 8px gap, 14px padding, separator ≈ 14px. */
export const DOCK_SLOT = 52;
const DOCK_PADDING = 28, DOCK_SEPARATOR = 14, DOCK_MAGNIFICATION_RESERVE = 48, DOCK_EDGE = 32;

/**
 * How many leading module entries fit before "Mais áreas" is needed. Pinned utilities
 * (Configurações, Integrações, Métricas) always stay visible so the choice can be
 * reverted. Never shrinks a target below 44px and never wraps to a second row.
 */
export function dockCapacity(viewport: number, modules: number, pinned: number, separators: number): number {
  const room = Math.max(0, viewport - DOCK_EDGE) - DOCK_PADDING - DOCK_MAGNIFICATION_RESERVE - pinned * DOCK_SLOT - separators * DOCK_SEPARATOR;
  if (modules * DOCK_SLOT <= room) return modules;
  return Math.max(0, Math.min(modules, Math.floor((room - DOCK_SLOT) / DOCK_SLOT)));
}

/** Same rule as the sidebar: the current page is the exact route; "/" never matches subpaths. */
export function isDockCurrent(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return path === href;
}

export function buildDockEntries(navigation: GroupedNavigation, metricsAvailable: boolean): { modules: DockEntry[]; pinned: DockEntry[] } {
  const modules = navigation.groups.flatMap((group, groupIndex) => group.routes.map((route, index): DockEntry => ({
    key: route.feature, href: route.href, label: route.label, icon: <NavigationIcon feature={route.feature} />,
    // Separators only mark real groups; a custom order that interleaves groups stays one run.
    separatorBefore: navigation.labeled && groupIndex > 0 && index === 0,
  })));
  const pinned: DockEntry[] = navigation.utility.map((route, index) => ({
    key: route.feature, href: route.href, label: route.label, icon: <NavigationIcon feature={route.feature} />, separatorBefore: index === 0 && modules.length > 0,
  }));
  if (metricsAvailable) pinned.push({ key: "metricas", href: "/metricas", label: "Métricas", icon: <Icons.Activity />, separatorBefore: pinned.length === 0 && modules.length > 0 });
  return { modules, pinned };
}

// Spring constants of the refined prototype (Motion: mass 0.16, stiffness 220, damping 20).
const SPRING = { mass: 0.16, stiffness: 220, damping: 20 };
const BASE = 44, PEAK = 64, ICON_BASE = 22, ICON_PEAK = 30, RADIUS = 110;

/**
 * Pointer magnification without React state per pointermove: each frame integrates a
 * spring per item and writes CSS variables. Centers are measured once per hover
 * session (and on resize), not per icon per frame. Touch and reduced motion never
 * magnify; changing the motion preference mid-hover settles everything to rest.
 */
function useDockMagnification(dock: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = dock.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let items: HTMLElement[] = [], centers: number[] = [], sizes: number[] = [], velocities: number[] = [];
    let pointer = Infinity, frame = 0, last = 0;
    const measure = () => {
      items = Array.from(root.querySelectorAll<HTMLElement>("[data-dock-item]"));
      centers = items.map((item) => { const box = item.getBoundingClientRect(); return box.left + box.width / 2; });
      sizes = items.map((_, index) => sizes[index] ?? BASE); velocities = items.map((_, index) => velocities[index] ?? 0);
    };
    const write = (index: number, size: number) => {
      const item = items[index]!;
      item.style.setProperty("--dock-tile", `${size.toFixed(2)}px`);
      item.style.setProperty("--dock-icon", `${(ICON_BASE + (size - BASE) * (ICON_PEAK - ICON_BASE) / (PEAK - BASE)).toFixed(2)}px`);
    };
    const settle = () => { for (let index = 0; index < items.length; index++) { sizes[index] = BASE; velocities[index] = 0; items[index]!.style.removeProperty("--dock-tile"); items[index]!.style.removeProperty("--dock-icon"); } };
    const step = (time: number) => {
      const elapsed = Math.min(0.064, last ? (time - last) / 1000 : 1 / 60);
      last = time;
      let moving = false;
      for (let index = 0; index < items.length; index++) {
        const distance = Math.abs(pointer - centers[index]!);
        const target = distance >= RADIUS ? BASE : BASE + (PEAK - BASE) * (1 - distance / RADIUS);
        // Semi-implicit Euler in 4ms substeps: stable for this overdamped spring.
        for (let remaining = elapsed; remaining > 0; remaining -= 0.004) {
          const dt = Math.min(0.004, remaining);
          velocities[index]! += ((SPRING.stiffness * (target - sizes[index]!) - SPRING.damping * velocities[index]!) / SPRING.mass) * dt;
          sizes[index]! += velocities[index]! * dt;
        }
        if (Math.abs(target - sizes[index]!) > 0.05 || Math.abs(velocities[index]!) > 0.5) moving = true;
        else { sizes[index] = target; velocities[index] = 0; }
        write(index, sizes[index]!);
      }
      frame = moving ? requestAnimationFrame(step) : 0;
      if (!moving) { last = 0; if (pointer === Infinity) settle(); }
    };
    const run = () => { if (!frame) { last = 0; frame = requestAnimationFrame(step); } };
    const onEnter = (event: PointerEvent) => { if (event.pointerType === "touch" || reduced.matches) return; if (pointer === Infinity) measure(); };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (reduced.matches) { if (pointer !== Infinity) { pointer = Infinity; settle(); } return; }
      if (!centers.length) measure();
      pointer = event.clientX; run();
    };
    const onLeave = () => { pointer = Infinity; if (items.length) run(); };
    const onMotion = () => { if (reduced.matches) { pointer = Infinity; if (frame) cancelAnimationFrame(frame); frame = 0; settle(); } };
    const onResize = () => { pointer = Infinity; centers = []; if (items.length) settle(); };
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    reduced.addEventListener("change", onMotion);
    window.addEventListener("resize", onResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      reduced.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
    };
  }, [dock]);
}

function DockLink({ entry, current, onNavigate }: { entry: DockEntry; current: boolean; onNavigate?: () => void }) {
  return <>
    {entry.separatorBefore && <span className="desktop-dock__separator" aria-hidden="true" />}
    <Link href={entry.href} className="desktop-dock__item" data-dock-item="" aria-label={entry.label} aria-current={current ? "page" : undefined} onClick={onNavigate}>
      <span className="desktop-dock__tile"><span className="desktop-dock__icon">{entry.icon}</span></span>
      <span className="desktop-dock__tip" aria-hidden="true">{entry.label}</span>
    </Link>
  </>;
}

export function DesktopDock({ navigation, metricsAvailable, pathname }: { navigation: GroupedNavigation; metricsAvailable: boolean; pathname: string }) {
  const dock = useRef<HTMLElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const moreId = `desktop-dock-more-${useId().replace(/:/g, "")}`;
  const { modules, pinned } = buildDockEntries(navigation, metricsAvailable);
  const separators = modules.filter((entry) => entry.separatorBefore).length + pinned.filter((entry) => entry.separatorBefore).length;
  // Server and first client render show every entry; the window measurement trims it afterwards.
  const [capacity, setCapacity] = useState(modules.length);
  useDockMagnification(dock);

  useEffect(() => {
    const update = () => setCapacity(dockCapacity(window.innerWidth, modules.length, pinned.length, separators));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [modules.length, pinned.length, separators]);

  const visible = modules.slice(0, capacity), hidden = modules.slice(capacity);
  const currentHidden = hidden.some((entry) => isDockCurrent(pathname, entry.href));
  const closeMore = () => more.current?.hidePopover?.();

  // WCAG 1.4.13: the name stays while hovered or focused; Escape dismisses it without moving focus.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented && !more.current?.matches(":popover-open")) dock.current?.setAttribute("data-tips-dismissed", "");
  };
  const resetTips = () => dock.current?.removeAttribute("data-tips-dismissed");
  // A hover tip must also close with Escape while focus is elsewhere on the page.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && dock.current?.matches(":hover")) dock.current.setAttribute("data-tips-dismissed", ""); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);
  // Hybrid laptops: a tap leaves CSS :hover stuck, so touch dismisses the name until the next hover or focus.
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => { if (event.pointerType === "touch") dock.current?.setAttribute("data-tips-dismissed", ""); };
  const onPointerOver = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const item = (event.target as Element).closest("[data-dock-item]");
    if (item && !item.contains(event.relatedTarget as Node | null)) resetTips();
  };

  return (
    <nav ref={dock} className="desktop-dock" aria-label="Navegação principal" onKeyDown={onKeyDown} onFocus={resetTips} onPointerOver={onPointerOver} onPointerDown={onPointerDown}>
      {visible.map((entry) => <DockLink key={entry.key} entry={entry} current={isDockCurrent(pathname, entry.href)} />)}
      {hidden.length > 0 && <>
        <button type="button" className="desktop-dock__item desktop-dock__more" data-dock-item="" popoverTarget={moreId}
          aria-label={currentHidden ? "Mais áreas, inclui a página atual" : "Mais áreas"} data-current={currentHidden || undefined}>
          <span className="desktop-dock__tile"><span className="desktop-dock__icon"><Icons.Dots /></span></span>
          <span className="desktop-dock__tip" aria-hidden="true">Mais áreas</span>
        </button>
        <div id={moreId} ref={more} popover="auto" className="desktop-dock__overflow">
          <p className="desktop-dock__overflow-title">Mais áreas</p>
          <ul>
            {hidden.map((entry) => (
              <li key={entry.key}>
                <Link href={entry.href} className="desktop-dock__overflow-link" aria-current={isDockCurrent(pathname, entry.href) ? "page" : undefined} onClick={closeMore}>
                  {entry.icon}<span>{entry.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </>}
      {pinned.map((entry) => <DockLink key={entry.key} entry={entry} current={isDockCurrent(pathname, entry.href)} />)}
    </nav>
  );
}
