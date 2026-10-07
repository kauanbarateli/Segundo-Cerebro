"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface InstallState { prompt: InstallPrompt | null; installed: boolean; clearPrompt: () => void }
const InstallContext = createContext<InstallState | null>(null);

/** Capture the one-shot browser event even when Settings has not been visited. */
export function InstallProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", complete);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);
  return <InstallContext.Provider value={{ prompt, installed, clearPrompt: () => setPrompt(null) }}>{children}</InstallContext.Provider>;
}

export function useInstall() {
  const value = useContext(InstallContext);
  if (!value) throw new Error("useInstall requer InstallProvider.");
  return value;
}
