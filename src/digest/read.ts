import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

type Line = { at: string; job: string; status: DigestStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse at the edge: anything that isn't a well-formed run line is null (a bad line).
function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return { at, job, status: status as DigestStatus, owner, error: error ?? null };
}

export const readNight: ReadNight = (runsDir, night) => {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (!line) {
      badLines++;
      continue;
    }
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    row.lastError = line.error;
    row.lastAt = line.at;
    row.owner = line.owner ?? row.owner;
  }

  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows: sorted, badLines };
};
