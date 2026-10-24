"use client";

import { PrivateImage } from "@/components/layout/private-image";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Display only: the owner-validated Goal supplies UUIDs, never a remote URL.
 * The existing keyed private reader owns failure state. Its fallback marker
 * collapses the optional visual area without changing the saved reference. */
export function GoalImage({ ownerId, goalId, fileId, className = "" }: {
  ownerId: string; goalId: string; fileId: string | null; className?: string;
}) {
  if (!fileId || !uuid(ownerId) || !uuid(goalId) || !uuid(fileId)) return <span className="fg-image-unavailable" />;
  return <PrivateImage key={`${ownerId}:${goalId}:${fileId}`} userId={ownerId} fileId={fileId}
    className={`fg-goal-image ${className}`.trim()} fallback={<span className="fg-image-unavailable" />} />;
}
