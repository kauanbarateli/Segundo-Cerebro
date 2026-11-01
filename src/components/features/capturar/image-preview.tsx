"use client";

import { useEffect, useState } from "react";
import type { AnexoCaptura } from "@/core/capturas";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

/** Session-only preview (object URL) or private read URL of one capture image. */
export function ImagePreview({ attachment, blob, privateUrl, onRemove }: { attachment: AnexoCaptura; blob?: Blob; privateUrl?: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return <figure className="capture-image">
    {/* Object URLs are session-only previews, so Next's network image optimizer is inapplicable. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url || privateUrl ? <img src={url ?? privateUrl} alt={`Prévia de ${attachment.name}`} loading="lazy" /> : <p>Prévia disponível apenas na sessão em que a imagem foi anexada.</p>}
    <figcaption><span>{attachment.name}</span><Button variant="ghost" onClick={onRemove} aria-label={`Remover imagem ${attachment.name}`}><Icons.X /></Button></figcaption>
  </figure>;
}
