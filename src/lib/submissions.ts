/**
 * Port submissions.
 *
 * Right now submissions are validated on the device and stored in a local queue. When a review
 * backend exists, set VITE_SUBMIT_URL at build time. The app will then POST the same JSON payload
 * to that endpoint, and the local queue only keeps items that could not be delivered.
 *
 * Payload contract (JSON):
 *   { title, project, developer, url, platform, genre, files, controller, notes, contact, app: 'portdeck', version: 1 }
 */
import { useSyncExternalStore } from 'react';

export interface SubmissionPayload {
  title: string;
  project: string;
  developer: string;
  url: string;
  platform: string;
  genre: string;
  files: 'none' | 'rom' | 'files';
  controller: 'both' | 'controller' | 'touch' | '';
  notes: string;
  contact: string;
}

export interface QueuedSubmission {
  id: string;
  createdAt: string;
  status: 'queued' | 'sent';
  payload: SubmissionPayload;
}

export type SubmissionErrors = Partial<Record<keyof SubmissionPayload, string>>;

export const EMPTY_SUBMISSION: SubmissionPayload = {
  title: '',
  project: '',
  developer: '',
  url: '',
  platform: 'pc',
  genre: '',
  files: 'files',
  controller: '',
  notes: '',
  contact: '',
};

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function validateSubmission(p: SubmissionPayload): SubmissionErrors {
  const e: SubmissionErrors = {};
  if (p.title.trim().length < 2) e.title = 'Enter the name of the game.';
  else if (p.title.length > 120) e.title = 'Keep the title under 120 characters.';
  if (p.developer.trim().length < 2) e.developer = 'Enter the developer or channel name.';
  if (!p.url.trim()) e.url = 'Enter the download or release link.';
  else if (!isHttpUrl(p.url)) e.url = 'Enter a full link that starts with https://';
  if (!p.platform) e.platform = 'Choose the original platform.';
  if (p.notes.length > 600) e.notes = 'Keep notes under 600 characters.';
  if (p.contact.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contact.trim()) && !/^@?[\w.]{3,}$/.test(p.contact.trim())) e.contact = 'Enter an email address or a username.';
  return e;
}

const KEY = 'portdeck.submissions.v1';
const listeners = new Set<() => void>();
let queue: QueuedSubmission[] = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
})();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useSubmissionQueue(): QueuedSubmission[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue,
    () => queue,
  );
}

export function removeSubmission(id: string) {
  queue = queue.filter((q) => q.id !== id);
  save();
}

export async function submitPort(payload: SubmissionPayload): Promise<QueuedSubmission> {
  const item: QueuedSubmission = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), status: 'queued', payload };
  const endpoint = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUBMIT_URL;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, app: 'portdeck', version: 1 }) });
      if (res.ok) {
        item.status = 'sent';
        return item;
      }
    } catch {
      /* keep in the local queue below */
    }
  }
  queue = [item, ...queue].slice(0, 30);
  save();
  return item;
}

export function submissionAsText(p: SubmissionPayload): string {
  return [
    `Game: ${p.title}`,
    `Port or project: ${p.project || '-'}`,
    `Developer: ${p.developer}`,
    `Link: ${p.url}`,
    `Original platform: ${p.platform}`,
    `Genre: ${p.genre || '-'}`,
    `Game files: ${p.files}`,
    `Controls: ${p.controller || '-'}`,
    `Notes: ${p.notes || '-'}`,
    `Contact: ${p.contact || '-'}`,
  ].join('\n');
}
