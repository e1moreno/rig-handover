import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/read.js';
import { readStatus } from './status.js';
import { DigestPage, NoRunLog } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Page and JSON read a night the same way, so they never disagree (ADR 0001).
  const digestFor = (night: string) => (/^\d{4}-\d{2}-\d{2}$/.test(night) ? readNight(config.runsDir, night) : null);

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = digestFor(night);
    if (!digest) {
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <NoRunLog night={night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = digestFor(night);
    if (!digest) return c.json({ error: 'no run log', night }, 404);
    return c.json(digest);
  });

  return app;
}
