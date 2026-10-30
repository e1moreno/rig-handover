import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightCounts = { ok: number; retry: number; fail: number };

// counts is null when the night's file cannot be read; the board shows — and keeps the night.
export type NightLine = { night: string; counts: NightCounts | null };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightLine[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts per night = jobs by their last status.
export function nightLines(runsDir: string): NightLine[] {
  return nightsOnDisk(runsDir).map((night) => {
    const digest = readNight(runsDir, night);
    if (!digest) return { night, counts: null };
    const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
    for (const row of digest.rows) counts[row.lastStatus]++;
    return { night, counts };
  });
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightLines(config.runsDir),
  };
}
