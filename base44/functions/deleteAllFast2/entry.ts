import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { anno, entityName = 'Deal' } = body;

  const entity = base44.asServiceRole.entities[entityName];
  if (!entity) {
    return Response.json({ error: `Entity ${entityName} not found` }, { status: 400 });
  }

  const BATCH_SIZE = 200;  // fetch 200 alla volta
  const CHUNK_SIZE = 20;   // delete 20 in parallelo
  const CHUNK_DELAY = 150; // delay solo tra chunk, non tra singoli record
  const MAX_DURATION = 50000;

  const startTime = Date.now();
  let totalDeleted = 0;
  let rounds = 0;
  let done = false;

  while (Date.now() - startTime < MAX_DURATION) {
    const batch = anno
      ? await entity.filter({ anno }, null, BATCH_SIZE, 0)
      : await entity.list(null, BATCH_SIZE, 0);

    if (!batch || batch.length === 0) { done = true; break; }

    rounds++;

    // Delete in chunk paralleli invece di 1 per volta
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      const chunk = batch.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(r => entity.delete(r.id))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      totalDeleted += succeeded;

      // Se 429, aspetta di più
      const hit429 = results.some(r =>
        r.status === 'rejected' && r.reason?.message?.includes('429')
      );
      await sleep(hit429 ? 2000 : CHUNK_DELAY);
    }

    if (batch.length < BATCH_SIZE) { done = true; break; }
  }

  return Response.json({ success: true, totalDeleted, rounds, done });
});