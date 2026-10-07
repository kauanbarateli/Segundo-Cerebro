"use client";
import { Button } from "@/components/ui/button";

export function RetryConnection() {
  return <Button variant="primary" onClick={() => { window.location.href = "/"; }}>Tentar conectar novamente</Button>;
}
