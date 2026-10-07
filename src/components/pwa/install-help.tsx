"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstall } from "./install-provider";
import "./pwa.css";

export function InstallHelp() {
  const { prompt, installed, clearPrompt } = useInstall();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function install() {
    if (!prompt) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setFeedback(choice.outcome === "accepted" ? "Solicitação aceita. Aguarde a confirmação do dispositivo." : "Você pode instalar mais tarde pelo menu do navegador.");
      clearPrompt();
    } catch { setFeedback("Não foi possível abrir a instalação. Use o menu do navegador para tentar novamente."); }
    finally { setBusy(false); }
  }

  return <section className="pwa-install-help" aria-labelledby="install-title">
    <h2 id="install-title">Segundo Cérebro no seu dispositivo</h2>
    {installed ? <p>Você está usando a versão instalada.</p> : <>
      <p>Abra o aplicativo em uma janela própria e encontre-o pela tela inicial.</p>
      {prompt ? <Button onClick={install} loading={busy}>Instalar Segundo Cérebro</Button> : <p>No menu do navegador, procure a opção de instalar. No iPhone ou iPad, abra no Safari, toque em Compartilhar e em Adicionar à Tela de Início.</p>}
    </>}
    <p className="pwa-install-limit">Sem conexão, uma página de orientação mantém o aplicativo acessível. Salvar e sincronizar capturas offline chegará em uma próxima etapa.</p>
    <p role="status">{feedback}</p>
  </section>;
}
