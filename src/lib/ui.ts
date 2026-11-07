import { useSyncExternalStore } from 'react';
import { settingsStore } from './store';

/** Short vibration for key actions. Respects the haptics setting and reduced motion. */
export function haptic(ms = 8): void {
  try {
    if (!settingsStore.get().haptics) return;
    if (document.documentElement.dataset.motion === 'reduce') return;
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/* ------------------------------------------------------------ toast */
let toastMessage = '';
let toastId = 0;
const toastListeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, ms = 2600): void {
  toastMessage = message;
  toastId++;
  toastListeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastMessage = '';
    toastListeners.forEach((l) => l());
  }, ms);
}

export function useToast(): { message: string; id: number } {
  const message = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toastMessage,
    () => '',
  );
  return { message, id: toastId };
}

/* -------------------------------------------------------- clipboard */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function shareLink(title: string, text: string, url: string): Promise<void> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
  }
  const ok = await copyText(`${text}\n${url}`);
  showToast(ok ? 'Link copied to clipboard' : 'Could not copy the link');
}
