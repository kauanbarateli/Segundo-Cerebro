"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useTheme } from "@/components/theme/theme-provider";

/** Recebe os pictures do servidor sem levar capturas ou conteúdo ao bundle client. */
export function HeroImagePriority({ children, className, style }: { children: ReactNode; className: string; style: CSSProperties }) {
  const figure = useRef<HTMLElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // O script do head resolve o primeiro tema antes dos valores iniciais do hook.
    const theme = document.documentElement.dataset.theme;
    const quadro = theme === "dark" ? "escuro" : theme === "light" ? "claro" : null;
    for (const image of figure.current?.querySelectorAll<HTMLImageElement>(".conheca-tela__imagem") ?? []) {
      const visible = quadro !== null && image.parentElement?.classList.contains(`conheca-tela__quadro--${quadro}`);
      image.fetchPriority = visible ? "high" : "auto";
      image.loading = visible ? "eager" : "lazy";
    }
  }, [resolvedTheme]);

  return <figure ref={figure} className={className} style={style}>{children}</figure>;
}
