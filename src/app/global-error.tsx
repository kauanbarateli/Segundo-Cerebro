"use client";
import { useEffect } from "react";
import { reportBoundary } from "@/components/layout/boundary-report";
import { Button } from "@/components/ui/button";
import "./global-error.css";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset(): void }) {
  useEffect(() => { reportBoundary("global"); }, []);
  return <html lang="pt-BR"><body><main className="global-error" role="alert"><h1>Não foi possível carregar o Segundo Cérebro</h1><p>Tente novamente para continuar.</p>
    <Button onClick={reset}>Tentar novamente</Button></main></body></html>;
}
