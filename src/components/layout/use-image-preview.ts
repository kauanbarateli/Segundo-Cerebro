"use client";
import { useEffect, useState } from "react";
/** Object URLs remain in memory and are released on replacement/unmount. */
export function useImagePreview(file: File | null) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview?.file === file ? preview?.url ?? null : null;
}
