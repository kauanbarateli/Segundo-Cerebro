/** Re-encoded bytes are disposable in M1; only their metadata enters the domain. */
export interface DemoCaptureImage {
  id: string; name: string; blob: Blob; mime: "image/png" | "image/jpeg";
  width: number; height: number; bytes: number;
}
