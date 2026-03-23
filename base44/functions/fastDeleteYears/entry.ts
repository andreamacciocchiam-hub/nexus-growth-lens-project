import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const years = body.years || ['2025', '2026'];

    let totalDeleted = 0;
    const BATCH_SIZE = 50;
    const DELAY_MS = 500;

    for (const anno of years) {
      console.log(`Starting deletion for year: ${anno}`);
      let batchNum = 0;

      while (true) {
        // ✅ Skip sempre 0 — dopo le delete i record si riposizionano
        const batch = await base44.asServiceRole.entities.Deal.filter(
          { anno },
          null,
          BATCH_SIZE,
          0  // <-- sempre 0, mai incrementare
        );

        if (!batch || batch.length === 0) {
          console.log(`Year ${anno} complete.`);
          break;
        }

        // ✅ Delete in parallelo invece di 1 per volta
        const results = await Promise.allSettled(
          batch.map(r => base44.asServiceRole.entities.Deal.delete(r.id))
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed    = results.filter(r => r.status === 'rejected').length;

        totalDeleted += succeeded;
        batchNum++;

        console.log(`Batch ${batchNum} | deleted: ${succeeded} | failed: ${failed} | total: ${totalDeleted}`);

        if (failed > 0) {
          // Log errori senza bloccare
          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`  Failed id ${batch[i].id}:`, r.reason?.message);
          });
        }

        // Se il batch era incompleto, siamo all'ultimo giro
        if (batch.length < BATCH_SIZE) break;

        await new Promise(t => setTimeout(t, DELAY_MS));
      }
    }

    return Response.json({ success: true, totalDeleted, years });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});