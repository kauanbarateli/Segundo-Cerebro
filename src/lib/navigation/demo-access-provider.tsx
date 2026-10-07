"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AccessPolicy, FeatureKey, FeaturePreference } from "@/core/access/resolve-access";
import { DEFAULT_DEMO_POLICY, DEMO_ACCESS_STORAGE_KEY, parseDemoPolicy, serializeDemoPolicy } from "./demo-state";

interface DemoAccessContextValue {
  policy: AccessPolicy;
  ready: boolean;
  setPreference: (feature: FeatureKey, preference: FeaturePreference) => void;
  simulateEntitlement: (feature: FeatureKey, allowed: boolean) => void;
  simulateAdmin: (enabled: boolean) => void;
  resetDemo: () => void;
}
const DemoAccessContext = createContext<DemoAccessContextValue | null>(null);

/** T-004 fixture seam only. This is NOT authentication or server authorization.
 * Replace this provider with a server-resolved policy in the identity milestone.
 * sessionStorage persists the demonstration in this tab; failure falls back to memory. */
export function DemoAccessProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<AccessPolicy>(DEFAULT_DEMO_POLICY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setPolicy(parseDemoPolicy(window.sessionStorage.getItem(DEMO_ACCESS_STORAGE_KEY))); } catch { /* Memory remains usable. */ }
    setReady(true);
  }, []);
  const update = useCallback((change: (previous: AccessPolicy) => AccessPolicy) => {
    setPolicy((previous) => {
      const next = change(previous);
      try { window.sessionStorage.setItem(DEMO_ACCESS_STORAGE_KEY, serializeDemoPolicy(next)); } catch { /* Keep the change for this mounted session. */ }
      return next;
    });
  }, []);
  return (
    <DemoAccessContext.Provider value={{
      policy, ready,
      setPreference: (feature, preference) => update((previous) => ({ ...previous, preferences: { ...previous.preferences, [feature]: preference } })),
      simulateEntitlement: (feature, allowed) => update((previous) => ({ ...previous, entitlements: { ...previous.entitlements, [feature]: allowed } })),
      simulateAdmin: (enabled) => update((previous) => ({ ...previous, isAdmin: enabled })),
      resetDemo: () => update(() => DEFAULT_DEMO_POLICY),
    }}>
      {children}
    </DemoAccessContext.Provider>
  );
}

export function useDemoAccess(): DemoAccessContextValue {
  const value = useContext(DemoAccessContext);
  if (!value) throw new Error("useDemoAccess requer DemoAccessProvider.");
  return value;
}
