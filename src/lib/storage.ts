/**
 * Persistência local. No desktop grava JSON na pasta de dados do usuário (via IPC).
 * No navegador (modo dev/preview) cai para localStorage automaticamente.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type DesktopBridge = {
  isDesktop: boolean;
  platform: string;
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
    remove: (key: string) => Promise<boolean>;
  };
  appInfo: () => Promise<{ version: string; platform: string; dataDir: string; electron: string }>;
  setTheme: (theme: 'dark' | 'light') => Promise<boolean>;
  onDataImported: (cb: () => void) => () => void;
};

declare global {
  interface Window {
    mrq?: DesktopBridge;
  }
}

export const isDesktop = () => {
  try {
    return typeof window !== 'undefined' && !!window.mrq?.isDesktop;
  } catch {
    return false;
  }
};

/** acesso seguro ao bridge (evita quebrar no navegador) */
const bridge = (): DesktopBridge | undefined => {
  try {
    return typeof window !== 'undefined' ? window.mrq : undefined;
  } catch {
    return undefined;
  }
};

export async function loadKey<T>(key: string, fallback: T): Promise<T> {
  try {
    const b = bridge();
    if (b?.store) {
      const v = await b.store.get(key);
      if (v !== null && v !== undefined) return v as T;
      // primeira execução: migra dados do localStorage se existirem
      const raw = localStorage.getItem(`mrq:${key}`);
      if (raw) return JSON.parse(raw) as T;
      return fallback;
    }
    const raw = localStorage.getItem(`mrq:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveKey(key: string, value: unknown): Promise<void> {
  try {
    const b = bridge();
    if (b?.store) {
      await b.store.set(key, value);
      return;
    }
    localStorage.setItem(`mrq:${key}`, JSON.stringify(value));
  } catch {
    /* silencioso: nunca travar a UI por falha de gravação */
  }
}

/** Hook de estado persistido */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const skip = useRef(true);

  useEffect(() => {
    let alive = true;
    loadKey<T>(key, initial).then((v) => {
      if (!alive) return;
      setValue(v);
      setLoaded(true);
      skip.current = true;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const id = setTimeout(() => void saveKey(key, value), 220);
    return () => clearTimeout(id);
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatch(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return match;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useLocalStorageFlag(key: string, initial = false) {
  const [flag, setFlag] = usePersisted<boolean>(key, initial);
  const toggle = useCallback(() => setFlag((f) => !f), [setFlag]);
  return [flag, toggle, setFlag] as const;
}
