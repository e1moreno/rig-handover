import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28', () => {
  const night = readNight('runs', '2026-10-28')!;
  const row = (job: string) => night.rows.find((r) => r.job === job)!;

  it('has 5 jobs sorted by name and 1 bad line', () => {
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('counts retries and takes the last status', () => {
    expect(row('fixtures/refresh')).toMatchObject({ retries: 3, runs: 4, lastStatus: 'ok', lastError: null });
  });

  it('keeps the error of a failed last line', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a null owner as null', () => {
    expect(row('digest/render').owner).toBeNull();
  });

  it('keeps the offset in times', () => {
    expect(row('fixtures/refresh').firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row('fixtures/refresh').lastAt).toBe('2026-10-29T01:37:00+01:00');
  });
});

describe('readNight edges', () => {
  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts invalid shapes as bad lines and skips blank lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    const ok = '{"at":"t","job":"a","status":"ok","owner":null}';
    writeFileSync(join(dir, 'n.jsonl'), `${ok}\n\n{"at":"t","job":"a","status":"weird","owner":null}\n${ok}\n`);
    const n = readNight(dir, 'n')!;
    expect(n.badLines).toBe(1);
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]!.runs).toBe(2);
  });
});
