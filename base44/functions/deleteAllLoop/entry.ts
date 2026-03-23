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

  const startTime = Date.now();
  const maxDuration = 50000; // 50 secondi
  let totalDeleted = 0;
  let rounds = 0;
  let done = false;

  while (Date.now() - startTime < maxDuration) {
    const batch = anno
      ? await entity.filter({ anno }, null, 50, 0)
      : await entity.list(null, 50, 0);

    if (!batch || batch.length === 0) {
      done = true;
      break;
    }

    rounds++;
    for (const record of batch) {
      try {
        await entity.delete(record.id);
        totalDeleted++;
      } catch (e) {
        if (e?.message?.includes('429')) {
          await sleep(2000);
        }
      }
      await sleep(300);
    }

    if (batch.length < 50) {
      done = true;
      break;
    }
  }

  return Response.json({ success: true, totalDeleted, rounds, done });
});