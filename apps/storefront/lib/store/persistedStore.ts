import { useSyncExternalStore } from "react";

type Listener = () => void;

export function createPersistedStore<T>(key: string, fallback: T) {
  const listeners = new Set<Listener>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  function parse(raw: string | null): T {
    if (raw === null) {
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  function getSnapshot(): T {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = parse(raw);
    }
    return cachedValue;
  }

  function getServerSnapshot(): T {
    return fallback;
  }

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);

    function handleStorage(event: StorageEvent) {
      if (event.key === key) {
        listener();
      }
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  }

  function set(value: T) {
    const raw = JSON.stringify(value);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      // Storage can be unavailable in private windows; keep the in-memory value.
    }
    cachedRaw = raw;
    cachedValue = value;
    notify();
  }

  function update(updater: (current: T) => T) {
    set(updater(getSnapshot()));
  }

  return { subscribe, getSnapshot, getServerSnapshot, set, update };
}

export type PersistedStore<T> = ReturnType<typeof createPersistedStore<T>>;

export function usePersistedStore<T>(store: PersistedStore<T>) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
