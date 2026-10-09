import { CommandJournal, type JournalEnvironment } from "../../../src/lib/demo/command-journal";

/** Explicit unit-only browser seam; production has no memory journal fallback. */
export function journalBrowser() {
  const data = new Map<string, string>(), locks = new Map<string, Promise<void>>();
  const listeners = new Map<number, Set<() => void>>();
  let tabId = 0, sequence = 0;
  const failures = { read: false, write: false, remove: false, dropWrite: false, locks: false };
  const denied = () => { throw new Error("private-storage-canary"); };
  function tab() {
    const owner = ++tabId; listeners.set(owner, new Set());
    const changed = () => { for (const [other, callbacks] of listeners) if (other !== owner) for (const callback of callbacks) queueMicrotask(callback); };
    const environment: JournalEnvironment = {
      storage: {
        get length() { if (failures.read) denied(); return data.size; },
        key(index) { if (failures.read) denied(); return [...data.keys()][index] ?? null; },
        getItem(key) { if (failures.read) denied(); return data.get(key) ?? null; },
        setItem(key, value) { if (failures.write) denied(); if (failures.dropWrite) return; const previous = data.get(key); data.set(key, value); if (previous !== value) changed(); },
        removeItem(key) { if (failures.remove) denied(); if (data.delete(key)) changed(); },
      },
      randomId: () => `epoch-${++sequence}`,
      subscribe(listener) { listeners.get(owner)!.add(listener); return () => { listeners.get(owner)!.delete(listener); }; },
      async lock(name, signal, operation) {
        if (failures.locks) denied();
        const previous = locks.get(name) ?? Promise.resolve();
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        const tail = previous.then(() => held); locks.set(name, tail);
        let abort!: () => void;
        const aborted = new Promise<never>((_, reject) => { abort = () => reject(new Error("aborted")); signal.addEventListener("abort", abort, { once: true }); });
        try {
          if (signal.aborted) abort();
          await Promise.race([previous, aborted]);
          if (signal.aborted) throw new Error("aborted");
          return await operation();
        } finally {
          signal.removeEventListener("abort", abort); release();
          if (locks.get(name) === tail) void tail.then(() => { if (locks.get(name) === tail) locks.delete(name); });
        }
      },
    };
    return { environment, journal: (userId: string) => new CommandJournal(userId, environment) };
  }
  return { data, failures, tab, entries: () => [...data.entries()].filter(([key]) => key.includes(":entry:")) };
}
