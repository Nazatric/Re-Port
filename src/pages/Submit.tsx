import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../components/Icons';
import { Hero } from '../components/ui';
import { Link, useRoute } from '../lib/router';
import { bestPort, collections, gameById, platforms, games } from '../lib/catalog';
import { EMPTY_SUBMISSION, removeSubmission, submissionAsText, submitPort, useSubmissionQueue, validateSubmission, type QueuedSubmission, type SubmissionErrors, type SubmissionPayload } from '../lib/submissions';
import { copyText, showToast } from '../lib/ui';
import { formatDate } from '../lib/format';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--bad)]">
          <Icon name="warn" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

export default function Submit() {
  const route = useRoute();
  const report = route.query.get('mode') === 'report';
  const prefill = route.query.get('title') || '';
  const [form, setForm] = useState<SubmissionPayload>({ ...EMPTY_SUBMISSION, title: prefill });
  const [errors, setErrors] = useState<SubmissionErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<QueuedSubmission | null>(null);
  const queue = useSubmissionQueue();
  const reportedGame = useMemo(() => games.find((g) => g.title === prefill), [prefill]);

  const set = <K extends keyof SubmissionPayload>(k: K, v: SubmissionPayload[K]) => setForm((f) => ({ ...f, [k]: v }));
  const props = (k: keyof SubmissionPayload) => ({
    id: `f-${k}`,
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `f-${k}-err` : `f-${k}-hint`,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let payload = { ...form };
    let errs: SubmissionErrors;
    if (report) {
      const g = reportedGame ?? gameById.get(prefill);
      payload = {
        ...payload,
        project: 'REPORT',
        developer: payload.developer || 'reader',
        url: payload.url.trim() || (g ? bestPort(g).url : 'https://example.com'),
        platform: g?.platform || payload.platform,
        notes: `REPORT: ${payload.notes.trim()}`,
      };
      errs = validateSubmission({ ...payload, notes: payload.notes.slice(0, 600) });
      if (form.notes.trim().length < 5) errs.notes = 'Describe the problem in a few words.';
      else delete errs.notes;
      delete errs.title;
    } else {
      errs = validateSubmission(payload);
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById('form-errors')?.focus();
      return;
    }
    setBusy(true);
    const item = await submitPort(payload);
    setBusy(false);
    setDone(item);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Hero title={report ? 'Report' : 'Submit'} kicker="Re:Port" />
      <main id="main" tabIndex={-1} className="wrap safe-bottom -mt-4 space-y-6 outline-none">
        {done ? (
          <section className="panel p-5 text-center" role="status">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--good)]">
              <Icon name="checkCircle" size={36} />
            </span>
            <h2 className="mt-3 text-xl font-bold">{done.status === 'sent' ? 'Sent for review' : 'Saved on this device'}</h2>
            <p className="mt-1 text-sm text-ink2">
              {done.status === 'sent' ? 'Thank you. A maintainer will check the link before it appears in the library.' : 'The review service is not connected yet, so your submission is stored here. You can copy the details and send them to the maintainer.'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-a small"
                onClick={async () => showToast((await copyText(submissionAsText(done.payload))) ? 'Details copied' : 'Could not copy')}
              >
                Copy details
              </button>
              <button
                type="button"
                className="btn-glass"
                onClick={() => {
                  setDone(null);
                  setForm({ ...EMPTY_SUBMISSION });
                }}
              >
                Add another
              </button>
              <Link to="/library" className="btn-glass">
                Back to the library
              </Link>
            </div>
          </section>
        ) : (
          <form onSubmit={onSubmit} noValidate className="panel space-y-4 p-4" aria-label={report ? 'Report a problem' : 'Submit a port'}>
            <p className="text-sm text-ink2">
              {report ? 'Tell us what is wrong with this entry, such as a broken link or an incorrect status.' : 'Know a port that is missing? Add the release link and a few details. Every submission is reviewed before it is listed.'}
            </p>
            {Object.keys(errors).length > 0 && (
              <div id="form-errors" tabIndex={-1} role="alert" className="rounded-xl border border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] p-3 text-sm font-semibold text-[var(--bad)] outline-none">
                Please fix {Object.keys(errors).length} {Object.keys(errors).length === 1 ? 'field' : 'fields'} below.
              </div>
            )}

            <Field id="f-title" label={report ? 'Game' : 'Game title *'} error={errors.title}>
              <input {...props('title')} className="field" value={form.title} onChange={(e) => set('title', e.target.value)} readOnly={report && !!prefill} autoComplete="off" maxLength={120} />
            </Field>

            {!report && (
              <>
                <Field id="f-project" label="Port or project name" hint="For example the app or repository name." error={errors.project}>
                  <input {...props('project')} className="field" value={form.project} onChange={(e) => set('project', e.target.value)} autoComplete="off" maxLength={80} />
                </Field>
                <Field id="f-developer" label="Developer or channel *" error={errors.developer}>
                  <input {...props('developer')} className="field" value={form.developer} onChange={(e) => set('developer', e.target.value)} autoComplete="off" maxLength={80} />
                </Field>
              </>
            )}

            <Field id="f-url" label={report ? 'Correct link (optional)' : 'Release or download link *'} hint="GitHub repository, Telegram post, Discord invite, itch.io page and so on." error={errors.url}>
              <input {...props('url')} className="field" type="url" inputMode="url" placeholder="https://" value={form.url} onChange={(e) => set('url', e.target.value)} autoComplete="off" />
            </Field>

            {!report && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="f-platform" label="Original platform *" error={errors.platform}>
                    <select {...props('platform')} className="field" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
                      {platforms.filter((p) => p.id !== 'engine').map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="f-genre" label="Genre">
                    <select {...props('genre')} className="field" value={form.genre} onChange={(e) => set('genre', e.target.value)}>
                      <option value="">Not sure</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <fieldset className="border-0 p-0">
                  <legend className="mb-1.5 text-sm font-bold">Game files</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Game files">
                    {([['none', 'None needed'], ['rom', 'Needs a ROM'], ['files', 'Needs game files']] as const).map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={form.files === v} aria-pressed={form.files === v} className="chip" onClick={() => set('files', v)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="border-0 p-0">
                  <legend className="mb-1.5 text-sm font-bold">Controls</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Controls">
                    {([['', 'Not sure'], ['both', 'Touch and controller'], ['touch', 'Touch only'], ['controller', 'Controller only']] as const).map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={form.controller === v} aria-pressed={form.controller === v} className="chip" onClick={() => set('controller', v)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <Field id="f-notes" label={report ? 'What is wrong? *' : 'Notes'} hint="Up to 600 characters." error={errors.notes}>
              <textarea {...props('notes')} className="field" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={600} />
            </Field>
            <Field id="f-contact" label="Contact (optional)" hint="An email or username, only used if we need to ask a question." error={errors.contact}>
              <input {...props('contact')} className="field" value={form.contact} onChange={(e) => set('contact', e.target.value)} autoComplete="off" maxLength={80} />
            </Field>

            <button type="submit" className="btn-a w-full" disabled={busy} aria-busy={busy}>
              <Icon name="send" size={20} />
              {busy ? 'Sending...' : report ? 'Send report' : 'Submit for review'}
            </button>
          </form>
        )}

        {queue.length > 0 && (
          <section aria-labelledby="h-queue" className="panel p-4">
            <h2 id="h-queue" className="text-lg font-bold">
              Waiting on this device
            </h2>
            <p className="mb-3 text-sm text-ink2">These have not reached a review service yet.</p>
            <ul className="grid gap-2">
              {queue.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{q.payload.title}</p>
                    <p className="text-xs text-ink2">{formatDate(q.createdAt.slice(0, 10))}</p>
                  </div>
                  <button type="button" onClick={() => removeSubmission(q.id)} aria-label={`Remove ${q.payload.title} from the queue`} className="grid h-11 w-11 place-items-center rounded-full">
                    <Icon name="trash" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
