import { afterEach, describe, expect, it, vi } from "vitest";
import { createVaultClipboard, watchVaultActivity, watchVaultLogout } from "../../src/components/features/cofre/vault-lifecycle";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("T024 vault lifecycle", () => {
 it("inactivity resets on activity then locks at five minutes", () => { vi.useFakeTimers(); const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: "visible" }); vi.stubGlobal("window", win); vi.stubGlobal("document", doc); const lock = vi.fn(), dispose = watchVaultActivity(lock); vi.advanceTimersByTime(299000); expect(lock).not.toHaveBeenCalled(); win.dispatchEvent(new Event("keydown")); vi.advanceTimersByTime(299999); expect(lock).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); expect(lock).toHaveBeenCalledOnce(); dispose(); });
 it("hiding or blurring locks immediately and listener cleanup expires", () => { vi.useFakeTimers(); const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: "visible" }); vi.stubGlobal("window", win); vi.stubGlobal("document", doc); const lock = vi.fn(), dispose = watchVaultActivity(lock); doc.visibilityState = "hidden"; doc.dispatchEvent(new Event("visibilitychange")); win.dispatchEvent(new Event("blur")); expect(lock).toHaveBeenCalledTimes(2); dispose(); vi.advanceTimersByTime(300000); win.dispatchEvent(new Event("blur")); expect(lock).toHaveBeenCalledTimes(2); });
 it("clipboard clears at thirty seconds, superseded timers do not clear the latest copy early", async () => { vi.useFakeTimers(); const writeText = vi.fn(async () => undefined), clipboard = createVaultClipboard({ writeText }, vi.fn()); await clipboard.copy("first"); vi.advanceTimersByTime(20000); await clipboard.copy("second"); vi.advanceTimersByTime(29999); expect(writeText).toHaveBeenCalledTimes(2); await vi.advanceTimersByTimeAsync(1); expect(writeText).toHaveBeenLastCalledWith(""); });
 it("clipboard cleanup failures are explicit", async () => { vi.useFakeTimers(); const failed = vi.fn(), writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error()); const clipboard = createVaultClipboard({ writeText }, failed); await clipboard.copy("secret"); await vi.advanceTimersByTimeAsync(30000); expect(failed).toHaveBeenCalledOnce(); });
 it("logout locks synchronously while journal cleanup remains pending, only for the current owner", async () => {
  const win = new EventTarget(); vi.stubGlobal("window", win); const lock = vi.fn(), eventName = "segundo-cerebro:demo-logout", owner = "current-owner";
  const stop = watchVaultLogout(eventName, owner, lock); let settle!: () => void, navigated = false;
  const journal = new Promise<void>(resolve => { settle = resolve; }), logout = journal.then(() => { navigated = true; });
  win.dispatchEvent(new CustomEvent(eventName, { detail: { userId: "other-owner" } })); expect(lock).not.toHaveBeenCalled();
  win.dispatchEvent(new CustomEvent(eventName, { detail: { userId: owner } })); expect(lock).toHaveBeenCalledOnce(); expect(navigated).toBe(false);
  stop(); win.dispatchEvent(new CustomEvent(eventName, { detail: { userId: owner } })); expect(lock).toHaveBeenCalledOnce(); settle(); await logout;
 });
 it("a deferred copy finishing after dispose is erased immediately without a new timer", async () => {
  vi.useFakeTimers(); let settle!: () => void;
  const writeText = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { settle = resolve; })).mockResolvedValue(undefined), failed = vi.fn();
  const clipboard = createVaultClipboard({ writeText }, failed), copying = clipboard.copy("late-private-value"); await Promise.resolve();
  clipboard.dispose(); settle(); await copying;
  expect(writeText).toHaveBeenLastCalledWith(""); expect(vi.getTimerCount()).toBe(0); expect(failed).not.toHaveBeenCalled();
  await clipboard.clear();
 });
 it("ordered writes never let an older deferred copy or clear overwrite the latest copy", async () => {
  vi.useFakeTimers(); let settle!: () => void;
  const writeText = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { settle = resolve; })).mockResolvedValue(undefined);
  const clipboard = createVaultClipboard({ writeText }, vi.fn()), older = clipboard.copy("older"); await Promise.resolve();
  clipboard.dispose(); const latest = clipboard.copy("latest"); settle(); await older; await latest;
  expect(writeText).toHaveBeenLastCalledWith("latest"); await vi.advanceTimersByTimeAsync(29999); expect(writeText).toHaveBeenLastCalledWith("latest");
  await vi.advanceTimersByTimeAsync(1); expect(writeText).toHaveBeenLastCalledWith("");
 });
 it("dispose preserves unrelated clipboard contents when this instance has never copied", () => { const writeText = vi.fn().mockResolvedValue(undefined), clipboard = createVaultClipboard({ writeText }, vi.fn()); clipboard.dispose(); expect(writeText).not.toHaveBeenCalled(); });
});
