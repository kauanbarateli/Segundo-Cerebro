"use client";
/* eslint-disable @next/next/no-img-element -- Owner-authenticated private route cannot use the public image optimizer. */
import { useState } from "react";
import { fileReadUrl } from "./file-upload";
import { Icons } from "../ui/icons";
import "./private-image.css";

/** Preview failure is local feedback, never confirmation of a persisted link. */
export function PrivateImagePreview({ source, label }: { source: string | null; label: string }) {
  return <PreviewContent key={source ?? "none"} source={source} label={label} />;
}
function PreviewContent({ source, label }: { source: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  return source && !failed ? <img className="entity-image-preview" src={source} alt={label} onError={() => setFailed(true)} />
    : <div className="entity-image-empty" role={failed ? "status" : undefined}>{failed ? "Não foi possível exibir a prévia. Escolha outra imagem ou tente carregar novamente." : "Sem imagem"}</div>;
}

/** No remote source supplied by a profile, calendar guest or domain payload. */
export function PrivateImage({ fileId, userId, className = "" }: { fileId?: string | null; userId: string; className?: string }) {
  return <ImageContent key={`${userId}:${fileId ?? "none"}`} fileId={fileId} userId={userId} className={className} />;
}
function ImageContent({ fileId, userId, className }: { fileId?: string | null; userId: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return <span className={`private-image ${className}`} aria-hidden="true">
    {fileId && !failed ? <img src={fileReadUrl(fileId, userId)} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Icons.File width={28} height={28} />}
  </span>;
}
