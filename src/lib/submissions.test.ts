import { describe, expect, it } from 'vitest';
import { EMPTY_SUBMISSION, isHttpUrl, submissionAsText, validateSubmission, type SubmissionPayload } from './submissions';

const valid: SubmissionPayload = { ...EMPTY_SUBMISSION, title: 'Example Game', developer: 'someone', url: 'https://github.com/someone/example-port' };

describe('isHttpUrl', () => {
  it('accepts web links and rejects everything else', () => {
    expect(isHttpUrl('https://github.com/a/b')).toBe(true);
    expect(isHttpUrl('http://example.com/file')).toBe(true);
    expect(isHttpUrl('  https://t.me/channel/12  ')).toBe(true);
    expect(isHttpUrl('github.com/a/b')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('ftp://example.com/a')).toBe(false);
    expect(isHttpUrl('https://localhost')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('validateSubmission', () => {
  it('accepts a complete submission', () => {
    expect(validateSubmission(valid)).toEqual({});
  });
  it('requires title, developer and link', () => {
    const e = validateSubmission({ ...EMPTY_SUBMISSION });
    expect(Object.keys(e).sort()).toEqual(['developer', 'title', 'url']);
  });
  it('rejects unsafe or malformed links', () => {
    expect(validateSubmission({ ...valid, url: 'javascript:alert(1)' }).url).toBeTruthy();
    expect(validateSubmission({ ...valid, url: 'not a url' }).url).toBeTruthy();
  });
  it('limits lengths', () => {
    expect(validateSubmission({ ...valid, title: 'x'.repeat(121) }).title).toBeTruthy();
    expect(validateSubmission({ ...valid, notes: 'x'.repeat(601) }).notes).toBeTruthy();
  });
  it('accepts an email or username as contact and rejects nonsense', () => {
    expect(validateSubmission({ ...valid, contact: 'me@example.com' }).contact).toBeUndefined();
    expect(validateSubmission({ ...valid, contact: '@some_user' }).contact).toBeUndefined();
    expect(validateSubmission({ ...valid, contact: 'a b c !!' }).contact).toBeTruthy();
    expect(validateSubmission({ ...valid, contact: '' }).contact).toBeUndefined();
  });
});

describe('submissionAsText', () => {
  it('lists every field for the reviewer', () => {
    const t = submissionAsText(valid);
    expect(t).toContain('Game: Example Game');
    expect(t).toContain('Link: https://github.com/someone/example-port');
    expect(t.split('\n').length).toBe(10);
  });
});
