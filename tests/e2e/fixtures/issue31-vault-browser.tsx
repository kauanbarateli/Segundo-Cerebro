import { createRoot, type Root } from "react-dom/client";
import { VaultWorkspace } from "../../../src/components/features/cofre/vault-workspace";
import { ThemeProvider } from "../../../src/components/theme/theme-provider";
import { InstallProvider } from "../../../src/components/pwa/install-provider";
import { ToastProvider } from "../../../src/components/ui/toast";
import { DemoAccessProvider } from "../../../src/lib/navigation/demo-access-provider";
import { DemoApplicationProvider, useDemoApplication } from "../../../src/lib/demo/demo-provider";
import type { AccessPolicy } from "../../../src/core/access/resolve-access";
import type { VaultPlainItem } from "../../../src/core/cofre/types";

// Next routing only. Product crypto/worker/session/port/client/providers are real.
export function usePathname() { return "/cofre"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useRouter() { return { push() { throw new Error("VAULT_NAVIGATION_REFUSED"); }, replace() { throw new Error("VAULT_NAVIGATION_REFUSED"); }, refresh() { throw new Error("VAULT_NAVIGATION_REFUSED"); } }; }

const fieldNames = ["title", "username", "password", "url", "note"] as const;
const fieldLabels = ["Título do item", "Usuário do login", "Senha do item", "Endereço do login", "Nota privada"] as const;
type FieldDigests = Record<typeof fieldNames[number], string>;
export interface VaultRamPacket { kit: { a: string; b: string }; fieldDigests: FieldDigests }
type Slot = "master" | "next" | "recovered";
export interface VaultPrivateApi {
  start(userId: string, transferred?: VaultRamPacket): void;
  fillPassword(label: string, slot: Slot): boolean;
  fillItem(modified?: boolean): boolean;
  loadKit(mode?: "valid" | "corrupt"): Promise<boolean>;
  packet(): Promise<VaultRamPacket>;
  markers(): string[];
  fieldsMatch(): Promise<boolean>;
  storageClean(): Promise<boolean>;
  domClean(): boolean;
  clipboardMatches(): Promise<boolean>;
  clipboardEmpty(): Promise<boolean>;
  probe(): { imports: number; rejectedExports: number; extractableKeys: number; unexpected: number };
  kitReady(): { halves: number; failed: boolean };
  controlledHidden(): { stimulusKind: "controlled"; stateObserved: "hidden"; eventObserved: true };
  dispose(): boolean;
}
const policy: AccessPolicy = { entitlements: { conhecimento: false, calendario: false }, isAdmin: false, preferences: {
  capturar: { visible: false, order: 10 }, tarefas: { visible: false, order: 20 }, habitos: { visible: false, order: 30 },
  calendario: { visible: false, order: 40 }, projetos: { visible: false, order: 50 },
} };
function Surface() { const app = useDemoApplication(); return <main data-application-mode={app.mode}><h1>Cofre</h1><VaultWorkspace /></main>; }
const randomSecret = () => "Fixture-" + Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, "0")).join("") + "!";
let rendered: Root | null = null, keys = { master: "", next: "", recovered: "" }, kit = { a: "", b: "" };
let plain: VaultPlainItem = { title: "", kind: "login", username: "", password: "", url: "", note: "" };
let modifiedNote = "", captureFailed = false, restoreHooks: (() => void) | null = null;
let expectedFields: FieldDigests | null = null, observedPlainValues: string[] = [];
let probe = { imports: 0, rejectedExports: 0, extractableKeys: 0, unexpected: 0 };
let generation = 0;
async function digestField(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, "0")).join(""); }
function input(label: string) {
  const labels = [...document.querySelectorAll("label")].filter(value => value.textContent?.trim() === label);
  if (labels.length !== 1) throw new Error("VAULT_PRIVATE_INPUT_REFUSED");
  const element = document.getElementById(labels[0]!.htmlFor);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) throw new Error("VAULT_PRIVATE_INPUT_REFUSED");
  return element;
}
function setNative(label: string, value: string) {
  const control = input(label), prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter || control.disabled) throw new Error("VAULT_PRIVATE_INPUT_REFUSED");
  setter.call(control, value); control.dispatchEvent(new Event("input", { bubbles: true })); control.dispatchEvent(new Event("change", { bubbles: true }));
}
function installRamHooks() {
  // The product anchor is detached: a document click listener would miss it.
  // Deny native downloads; read the original Blob URL into this private RAM.
  const originalClick = HTMLAnchorElement.prototype.click;
  const activeGeneration = generation, pending = new Set<"a" | "b">();
  const click: typeof originalClick = function (this: HTMLAnchorElement) {
    const half = this.download === "segundo-cerebro-cofre-metade-A.txt" ? "a" : this.download === "segundo-cerebro-cofre-metade-B.txt" ? "b" : null;
    if (!half) { originalClick.call(this); return; }
    const target = new URL(this.href);
    if (target.protocol !== "blob:" || target.origin !== location.origin || kit[half] || pending.has(half) || generation !== activeGeneration) throw new Error("VAULT_DOWNLOAD_RAM_REFUSED");
    pending.add(half);
    void fetch(target.href).then(async response => {
      const blob = await response.blob();
      if (!response.ok || blob.size < 1 || blob.size > 1024 || !blob.type.startsWith("text/plain")) throw new Error("VAULT_DOWNLOAD_RAM_REFUSED");
      const value = await blob.text(); if (new TextEncoder().encode(value).byteLength > 1024) throw new Error("VAULT_DOWNLOAD_RAM_REFUSED");
      if (generation === activeGeneration) kit[half] = value;
    }).catch(() => { if (generation === activeGeneration) captureFailed = true; }).finally(() => { pending.delete(half); });
  };
  HTMLAnchorElement.prototype.click = click;
  const own = Object.getOwnPropertyDescriptor(crypto.subtle, "importKey"), originalImport = crypto.subtle.importKey.bind(crypto.subtle), originalExport = crypto.subtle.exportKey.bind(crypto.subtle);
  // A native observation, not a replacement cipher or extra fixture key. It
  // immediately releases each key; only booleans/counts survive the probe.
  const observedImport = async (format: KeyFormat, data: JsonWebKey | BufferSource, algorithm: AlgorithmIdentifier, extractable: boolean, usages: KeyUsage[]) => {
    const key = format === "jwk" ? await originalImport(format, data as JsonWebKey, algorithm, extractable, usages)
      : await originalImport(format, data as BufferSource, algorithm, extractable, usages);
    if (generation !== activeGeneration) return key;
    if (key.algorithm.name === "AES-GCM") {
      probe.imports++; if (key.extractable) probe.extractableKeys++;
      try { const exported = await originalExport("raw", key); new Uint8Array(exported).fill(0); if (generation === activeGeneration) probe.unexpected++; }
      catch (error) { if (generation === activeGeneration) { if (error instanceof DOMException && error.name === "InvalidAccessError") probe.rejectedExports++; else probe.unexpected++; } }
    }
    return key;
  };
  Object.defineProperty(crypto.subtle, "importKey", { configurable: true, value: observedImport });
  restoreHooks = () => {
    if (HTMLAnchorElement.prototype.click === click) HTMLAnchorElement.prototype.click = originalClick;
    if (own) Object.defineProperty(crypto.subtle, "importKey", own); else delete (crypto.subtle as Partial<SubtleCrypto>).importKey;
  };
}
const api: VaultPrivateApi = {
  start(userId, transferred) {
    if (rendered) throw new Error("VAULT_FIXTURE_REENTRY_REFUSED");
    generation++;
    keys = { master: randomSecret(), next: randomSecret(), recovered: randomSecret() };
    kit = transferred ? { ...transferred.kit } : { a: "", b: "" };
    // A new context receives only the kit and one-way field oracles. Plaintext,
    // master passwords, keys and sessions are never transferred into it.
    plain = transferred ? { title: "", kind: "login", username: "", password: "", url: "", note: "" } : { title: "Item RAM da jornada", kind: "login", username: randomSecret(), password: randomSecret(), url: "https://example.invalid", note: randomSecret() };
    expectedFields = transferred ? { ...transferred.fieldDigests } : null; observedPlainValues = [];
    modifiedNote = randomSecret(); probe = { imports: 0, rejectedExports: 0, extractableKeys: 0, unexpected: 0 }; captureFailed = false;
    installRamHooks();
    const element = document.getElementById("issue31-vault"); if (!element) throw new Error("VAULT_ROOT_REFUSED");
    rendered = createRoot(element);
    rendered.render(<ThemeProvider><InstallProvider><ToastProvider><DemoAccessProvider serverPolicy={policy}><DemoApplicationProvider serverUserId={userId}><Surface /></DemoApplicationProvider></DemoAccessProvider></ToastProvider></InstallProvider></ThemeProvider>);
  },
  fillPassword(label, slot) { setNative(label, keys[slot]); return true; },
  fillItem(modified = false) {
    if (modified) plain = { ...plain, note: modifiedNote };
    for (const [label, value] of [["Título do item", plain.title], ["Usuário do login", plain.username], ["Senha do item", plain.password], ["Endereço do login", plain.url], ["Nota privada", plain.note]]) setNative(label!, value!);
    return true;
  },
  async loadKit(mode = "valid") {
    if (!kit.a || !kit.b || captureFailed) throw new Error("VAULT_KIT_RAM_REFUSED");
    for (const half of ["a", "b"] as const) {
      const control = input("Arquivo da metade " + half.toUpperCase()); if (!(control instanceof HTMLInputElement) || control.type !== "file") throw new Error("VAULT_KIT_RAM_REFUSED");
      const value = mode === "corrupt" && half === "b" ? kit.b.slice(0, -1) : kit[half], transfer = new DataTransfer();
      const file = new File([value], "segundo-cerebro-cofre-metade-" + half.toUpperCase() + ".txt", { type: "text/plain" });
      transfer.items.add(file); control.files = transfer.files; control.dispatchEvent(new Event("change", { bubbles: true }));
      await file.text();
    }
    // Let the native File.text/change promise and React render settle. No
    // preparation state or proved flag is accessible to this fixture.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return true;
  },
  async packet() {
    const active = generation, fieldDigests = {} as FieldDigests;
    for (const name of fieldNames) fieldDigests[name] = await digestField(plain[name]);
    if (generation !== active) throw new Error("VAULT_PACKET_RAM_REFUSED");
    return { kit: { ...kit }, fieldDigests };
  },
  markers: () => [...Object.values(keys), ...Object.values(plain).filter(value => value !== "login"), ...observedPlainValues, kit.a, kit.b, modifiedNote].filter(Boolean),
  async fieldsMatch() {
    if (!expectedFields) throw new Error("VAULT_FIELD_ORACLE_REFUSED");
    const active = generation, values = fieldLabels.map(label => input(label).value), expected = expectedFields;
    const hashes = await Promise.all(values.map(digestField));
    if (generation !== active) throw new Error("VAULT_FIELD_ORACLE_REFUSED");
    const match = fieldNames.every((name, index) => hashes[index] === expected[name]);
    // These values come from the product's actual recovered editor, only after
    // the digest oracle passed; retain them in this browser's private RAM for
    // storage/server leak checks, never as setup or plaintext transfer.
    if (match) observedPlainValues = values;
    return match;
  },
  async storageClean() {
    const storage = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } });
    return !api.markers().some(value => storage.includes(value)) && (await indexedDB.databases()).length === 0;
  },
  domClean() {
    const values = (document.body.textContent ?? "") + [...document.querySelectorAll("input,textarea")].map(element => (element as HTMLInputElement | HTMLTextAreaElement).value).join("\n");
    return !api.markers().some(value => values.includes(value));
  },
  clipboardMatches: async () => await navigator.clipboard.readText() === plain.password,
  clipboardEmpty: async () => await navigator.clipboard.readText() === "",
  probe: () => ({ ...probe }),
  kitReady: () => ({ halves: Number(Boolean(kit.a)) + Number(Boolean(kit.b)), failed: captureFailed }),
  controlledHidden() {
    const own = Object.getOwnPropertyDescriptor(document, "visibilityState");
    try {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      if (document.visibilityState !== "hidden") throw new Error("VAULT_VISIBILITY_REFUSED");
      document.dispatchEvent(new Event("visibilitychange"));
      return { stimulusKind: "controlled", stateObserved: "hidden", eventObserved: true };
    } finally { if (own) Object.defineProperty(document, "visibilityState", own); else Reflect.deleteProperty(document, "visibilityState"); }
  },
  dispose() {
    generation++;
    rendered?.unmount(); rendered = null; restoreHooks?.(); restoreHooks = null;
    keys = { master: "", next: "", recovered: "" }; kit = { a: "", b: "" }; modifiedNote = ""; expectedFields = null; observedPlainValues = [];
    plain = { title: "", kind: "login", username: "", password: "", url: "", note: "" }; return true;
  },
};
Object.assign(globalThis, { __issue31Vault: api });
