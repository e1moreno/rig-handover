// Plan morning-digest § 1. The shared contract for the run log reader, the page and the JSON.
export type DigestStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night. Times are ISO strings exactly as in the log, offset kept.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log; views render it as —
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// rows sorted by job; badLines counts lines that did not parse (never thrown).
export type DigestNight = { night: string; rows: DigestRow[]; badLines: number };

// Reads runs/<night>.jsonl. Returns null when the file does not exist (routes answer 404);
// an empty file gives rows: [].
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
