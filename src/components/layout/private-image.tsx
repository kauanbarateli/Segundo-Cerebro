"use client";
/* eslint-disable @next/next/no-img-element -- Owner-authenticated private route cannot use the public image optimizer. */
import { useState } from "react";
import { fileReadUrl } from "./file-upload";
import { Icons } from "../ui/icons";
import "./private-image.css";

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
