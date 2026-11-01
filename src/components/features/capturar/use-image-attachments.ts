"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { AnexoCaptura } from "@/core/capturas";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { uploadFile } from "@/components/layout/file-upload";
import { prepareImage } from "./images";

export const MAX_CAPTURE_IMAGES = 6;

/**
 * Image attach protocol shared by the capture page and the quick-capture modal:
 * at most six images, connected uploads are validated by the server, demo images
 * are re-encoded and staged for the session. A late result is dropped when the
 * owner signed out, `cancel()` ran or the draft changed while the file was read.
 */
export function useImageAttachments({ draft, signedOut, busy, onAttach, onError }: {
  draft: RefObject<{ id: string; attachments: AnexoCaptura[] }>;
  signedOut: RefObject<boolean>;
  busy: boolean;
  onAttach(attachments: AnexoCaptura[]): void;
  onError(message: string | null): void;
}) {
  const app = useDemoApplication();
  const connected = app.mode === "connected";
  const epoch = useRef(0);
  const [uploading, setUploading] = useState(false);
  const cancel = useCallback(() => { epoch.current++; }, []);
  async function attach(files: File[]) {
    if (!files.length || uploading || busy) return;
    const remaining = MAX_CAPTURE_IMAGES - draft.current.attachments.length;
    if (files.length > remaining) { onError("Cada nota aceita até seis imagens. Remova uma imagem ou escolha menos arquivos."); return; }
    setUploading(true); onError(null); const started = epoch.current; const id = draft.current.id;
    const stale = () => signedOut.current || started !== epoch.current || draft.current.id !== id;
    try {
      if (connected) {
        const attachments: AnexoCaptura[] = [];
        for (const file of files) {
          const uploaded = await uploadFile({ file, kind: "capture_image", userId: app.userId, storageOrigin: app.storageOrigin, sender: app.executeDomainCommand });
          if ((uploaded.mime !== "image/png" && uploaded.mime !== "image/jpeg") || !uploaded.width || !uploaded.height) throw new Error("A imagem ainda não foi validada.");
          attachments.push({ id: uploaded.id, name: uploaded.name, mime: uploaded.mime, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes });
        }
        if (!stale()) onAttach(attachments);
        return;
      }
      const prepared = [];
      for (const file of files) prepared.push(await prepareImage(file));
      if (stale()) return;
      for (const image of prepared) app.stageImage(image);
      onAttach(prepared.map(({ id: imageId, name, mime, width, height, bytes }) => ({ id: imageId, name, mime, width, height, bytes })));
    } catch (reason) { onError(reason instanceof Error ? reason.message : "Não foi possível preparar a imagem."); }
    finally { setUploading(false); }
  }
  return { uploading, attach, cancel };
}
