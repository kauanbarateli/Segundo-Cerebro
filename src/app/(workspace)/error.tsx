"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportBoundary } from "@/components/layout/boundary-report";
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset(): void }) {
  useEffect(() => { reportBoundary("workspace"); }, []);
  return <Card role="alert"><h2>Não foi possível abrir esta área</h2><p>Tente carregar novamente. Seus registros salvos permanecem na sua conta.</p><Button onClick={reset}>Tentar novamente</Button></Card>;
}
