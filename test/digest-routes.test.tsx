import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const ok = (job: string, owner: string | null) => JSON.stringify({ at: '2026-10-01T02:00:00+01:00', job, status: 'ok', owner });
const retry = (job: string, owner: string | null) => JSON.stringify({ at: '2026-10-01T02:10:00+01:00', job, status: 'retry', owner });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(
    join(runsDir, '2026-10-01.jsonl'),
    [
      ok('notes/backup', 'ana'),
      retry('fixtures/refresh', 'ops'),
      retry('fixtures/refresh', 'ops'),
      retry('fixtures/refresh', 'ops'),
      ok('fixtures/refresh', 'ops'),
      JSON.stringify({ at: '2026-10-01T03:00:00+01:00', job: 'notes/backup', status: 'fail', owner: 'ana', error: 'quota exceeded' }),
      ok('lane/sync', 'lane-07'),
      ok('digest/render', null),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-10-02.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-03.jsonl'), `${ok('lane/sync', 'lane-07')}\n{"at":"x","job":"a/b\n`);
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// Job names in the HTML table body, in the order they are rendered.
const htmlJobs = (html: string) => [...html.matchAll(/<tr[^>]*>\s*<td>([^<]+)<\/td>/g)].map((m) => m[1]);

describe('digest page and JSON for a night with runs', () => {
  const jobs = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'];

  it('answers 200 with the jobs sorted by name', async () => {
    const res = await app.request('/digest/2026-10-01');
    expect(res.status).toBe(200);
    expect(htmlJobs(await res.text())).toEqual(jobs);
  });

  it('answers 200 with the same jobs in the same order as the page', async () => {
    const html = await (await app.request('/digest/2026-10-01')).text();
    const res = await app.request('/api/digest/2026-10-01');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(htmlJobs(html));
  });

  it('shows a dash for a null owner', async () => {
    const html = await (await app.request('/digest/2026-10-01')).text();
    expect(html).toMatch(/<td>digest\/render<\/td>\s*<td>—<\/td>/);
  });

  it('flags the 3-retry row and the failed row as warn', async () => {
    const html = await (await app.request('/digest/2026-10-01')).text();
    const warned = [...html.matchAll(/<tr class="warn">\s*<td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(warned).toEqual(['fixtures/refresh', 'notes/backup']);
  });
});

describe('digest for a night without a file', () => {
  it('answers 404 on the page', async () => {
    expect((await app.request('/digest/2026-09-30')).status).toBe(404);
  });

  it('answers 404 on the JSON', async () => {
    expect((await app.request('/api/digest/2026-09-30')).status).toBe(404);
  });
});

describe('digest for a malformed night', () => {
  it('answers 404 on the page', async () => {
    expect((await app.request('/digest/nope')).status).toBe(404);
  });

  it('answers 404 on the JSON', async () => {
    expect((await app.request('/api/digest/nope')).status).toBe(404);
  });
});

describe('digest for an empty night', () => {
  it('says nothing ran on the page', async () => {
    const res = await app.request('/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('gives no rows in the JSON', async () => {
    const res = await app.request('/api/digest/2026-10-02');
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });
});

describe('digest for a night with a bad line', () => {
  it('still answers 200 and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-10-03');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ badLines: 1, rows: [expect.objectContaining({ job: 'lane/sync' })] });
  });

  it('tells the reader on the page that a line could not be read', async () => {
    const res = await app.request('/digest/2026-10-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 line in the log could not be read');
  });
});
