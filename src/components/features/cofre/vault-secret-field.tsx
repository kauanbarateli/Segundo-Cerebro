"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

/** Presentation within an already unlocked session; never stores the value. */
export function VaultSecretField({ value, label, title, enabled, isCurrent }: {
  value: string; label: string; title: string; enabled: boolean; isCurrent(): boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const conceal = () => setRevealed(false);
    if (!enabled) conceal();
    const visibility = () => { if (document.visibilityState === "hidden") conceal(); };
    window.addEventListener("blur", conceal);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", conceal);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);
  const visible = revealed && enabled && isCurrent() && document.visibilityState !== "hidden";
  return <>
    <span className={visible ? "vault-revealed" : "vault-masked"} aria-live="off">
      {visible ? value : <><span aria-hidden="true">••••••••••••</span><span className="vault-sr">{label} oculta</span></>}
    </span>
    <Button variant="ghost" disabled={!enabled} aria-label={`${visible ? "Ocultar" : "Revelar"} ${label.toLocaleLowerCase("pt-BR")} de ${title}`} aria-pressed={visible}
      onClick={() => { if (enabled && isCurrent() && document.visibilityState !== "hidden") setRevealed(!visible); }}>
      {visible ? <Icons.EyeOff /> : <Icons.Eye />}
    </Button>
  </>;
}
