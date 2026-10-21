"use client";
import { useState } from "react";
import { fileReadUrl } from "./file-upload";
import "./account-avatar.css";
export function AccountAvatar({ userId, fileId, name }: { userId: string; fileId: string | null; name: string }) {
  return <AvatarContent key={`${userId}:${fileId ?? "none"}`} userId={userId} fileId={fileId} name={name} />;
}
function AvatarContent({ userId, fileId, name }: { userId: string; fileId: string | null; name: string }) {
  const [failed, setFailed] = useState(false), initial = [...name.trim()][0]?.toLocaleUpperCase("pt-BR") ?? "S";
  return <span className="account-avatar" aria-hidden="true">{fileId && !failed
    // The private authorization route needs this user's cookies; no image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={fileReadUrl(fileId, userId)} alt="" width={36} height={36} onError={() => setFailed(true)} /> : initial}</span>;
}
