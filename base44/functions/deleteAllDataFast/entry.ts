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

  // Prende i primi 50 record e li cancella sequenzialmente con pausa
  const batch = anno
    ? await entity.filter({ anno }, null, 50, 0)
    : await entity.list(null, 50, 0);

  if (!batch || batch.length === 0) {
    return Response.json({ success: true, deleted: 0, done: true });
  }

  let deleted = 0;
  for (const record of batch) {
    let ok = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await entity.delete(record.id);
        ok = true;
        break;
      } catch (e) {
        const is429 = e?.message?.includes('429') || e?.message?.includes('Rate limit');
        if (is429) {
          await sleep(1000 * (attempt + 1));
        } else {
          break;
        }
      }
    }
    if (ok) deleted++;
    await sleep(400); // pausa fissa tra ogni delete
  }

  return Response.json({
    success: true,
    deleted,
    batchSize: batch.length,
    done: batch.length < 50
  });
});