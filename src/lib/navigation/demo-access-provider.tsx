"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AccessPolicy, FeatureKey, FeaturePreference, FeaturePreferences } from "@/core/access/resolve-access";
import { DEFAULT_DEMO_POLICY, DEMO_ACCESS_STORAGE_KEY, parseDemoPolicy, serializeDemoPolicy } from "./demo-state";

interface DemoAccessContextValue {
  policy: AccessPolicy;
  ready: boolean;
  connected: boolean;
  setPreference: (feature: FeatureKey, preference: FeaturePreference) => void;
  simulateEntitlement: (feature: FeatureKey, allowed: boolean) => void;
  simulateAdmin: (enabled: boolean) => void;
  resetDemo: () => void;
  applyAccountPreferences: (preferences: FeaturePreferences) => void;
}
const DemoAccessContext = createContext<DemoAccessContextValue | null>(null);

/** Client navigation only. Connected mode receives a server-resolved presentation
 * policy and ignores demo storage/overrides. Server guards remain authoritative. */
export function DemoAccessProvider({ children, serverPolicy }: { children: ReactNode; serverPolicy?: AccessPolicy }) {
  const [policy, setPolicy] = useState<AccessPolicy>(DEFAULT_DEMO_POLICY);
  const [ready, setReady] = useState(false);
  const [accountPreferences, setAccountPreferences] = useState<FeaturePreferences | null>(null);
  const applyAccountPreferences = useCallback((preferences: FeaturePreferences) => { if (serverPolicy) setAccountPreferences(preferences); }, [serverPolicy]);
  useEffect(() => { setAccountPreferences(null); }, [serverPolicy]);
  useEffect(() => {
    if (serverPolicy) return;
    try { setPolicy(parseDemoPolicy(window.sessionStorage.getItem(DEMO_ACCESS_STORAGE_KEY))); } catch { /* Memory remains usable. */ }
    setReady(true);
  }, [serverPolicy]);
  const update = useCallback((change: (previous: AccessPolicy) => AccessPolicy) => {
    if (serverPolicy) return;
    setPolicy((previous) => {
      const next = change(previous);
      try { window.sessionStorage.setItem(DEMO_ACCESS_STORAGE_KEY, serializeDemoPolicy(next)); } catch { /* Keep the change for this mounted session. */ }
      return next;
    });
  }, [serverPolicy]);
  return (
    <DemoAccessContext.Provider value={{
      policy: serverPolicy ? { ...serverPolicy, preferences: accountPreferences ?? serverPolicy.preferences } : policy, ready: !!serverPolicy || ready, connected: !!serverPolicy, applyAccountPreferences,
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
