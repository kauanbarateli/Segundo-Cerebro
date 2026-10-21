"use client";
import { useCallback, useEffect, useState } from "react";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import type { EntityImageBinding, EntityImagePurpose } from "@/core/drive/entity-images";
export function useEntityImage(purpose: EntityImagePurpose, entityId: string, enabled: boolean) {
  const app = useDemoApplication(), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; fileId: string | null; ready: boolean; error: string }>({ key: "", fileId: null, ready: false, error: "" });
  const key = `${app.userId}:${purpose}:${entityId}`, connected = app.mode === "connected";
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !connected) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const reply = await fetch(`/api/files/entity-image?purpose=${purpose}&entity=${encodeURIComponent(entityId)}`, { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": app.userId }, signal: controller.signal });
        const value: EntityImageBinding = await reply.json();
        if (!reply.ok || !value || typeof value !== "object" || value.version !== 1 || value.user_id !== app.userId || value.id !== entityId || value.purpose !== purpose || !(value.file_id === null || typeof value.file_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.file_id))) throw new Error("Não foi possível carregar sua imagem. Tente novamente.");
        if (!controller.signal.aborted) setState({ key, fileId: value.file_id, ready: true, error: "" });
      } catch { if (!controller.signal.aborted) setState({ key, fileId: null, ready: false, error: "Não foi possível carregar sua imagem. Tente novamente." }); }
    })();
    return () => controller.abort();
  }, [app.userId, purpose, entityId, enabled, connected, key, attempt]);
  return { fileId: enabled && state.key === key ? state.fileId : null, ready: !connected || enabled && state.key === key && state.ready, error: enabled && state.key === key ? state.error : "", retry };
}
