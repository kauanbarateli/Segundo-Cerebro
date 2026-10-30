"use client";
import { useRef, useState } from "react";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { Button } from "@/components/ui/button";
import { EntityImageEditor } from "@/components/layout/entity-image-editor";
import { PrivateImage } from "@/components/layout/private-image";
import { useEntityImage } from "@/components/layout/use-entity-image";
export function HomeImageSettings() {
  const app = useDemoApplication(), { ready, policy } = useDemoAccess();
  const enabled = ready && resolveAccess("inicio", policy).allowed;
  const image = useEntityImage("home_focus_image", app.userId, enabled);
  const [editing, setEditing] = useState(false), trigger = useRef<HTMLElement | null>(null);
  if (!enabled) return null;
  return <div className="entity-image-form"><h2>Imagem do Início</h2><p>Escolha o fundo privado do destaque. A imagem acompanha sua conta, mesmo quando você oculta Tarefas.</p>
    <PrivateImage fileId={image.fileId} userId={app.userId} className="entity-image-preview" />
    {image.error && <><p role="alert">{image.error}</p><Button onClick={image.retry}>Tentar carregar imagem</Button></>}
    <Button disabled={!image.ready} onClick={event => { trigger.current = event.currentTarget; setEditing(true); }}>{image.fileId ? "Trocar ou remover imagem do Início" : "Escolher imagem do Início"}</Button>
    {editing && <EntityImageEditor purpose="home_focus_image" entityId={app.userId} currentFileId={image.fileId} title="Imagem do Início" returnFocusRef={trigger} onClose={() => setEditing(false)} onSaved={image.retry} />}
  </div>;
}
