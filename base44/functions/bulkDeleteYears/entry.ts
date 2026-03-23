import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const years = body.years || ['2025', '2026'];

    let totalDeleted = 0;

    for (const anno of years) {
      let batchNum = 0;
      while (batchNum < 200) {
        const batch = await base44.asServiceRole.entities.Deal.filter({ anno }, null, 50, 0);
        if (!batch || batch.length === 0) break;

        for (let i = 0; i < batch.length; i++) {
          try {
            await base44.asServiceRole.entities.Deal.delete(batch[i].id);
            totalDeleted++;
          } catch (e) {
            if (e.message.includes('429') || e.message.includes('rate')) {
              await new Promise(r => setTimeout(r, 5000));
              continue;
            }
            throw e;
          }
          // Delay per evitare spike rate limit
          if (i % 10 === 9) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        batchNum++;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return Response.json({ success: true, totalDeleted, years });
  } catch (error) {
    console.error('Delete error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});