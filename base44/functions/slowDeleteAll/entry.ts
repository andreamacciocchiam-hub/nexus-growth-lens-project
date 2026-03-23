import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  let totalDeleted = 0;
  let round = 0;

  while (true) {
    round++;
    const batch = await base44.asServiceRole.entities.Deal.list('-created_date', 200, 0);
    if (!batch || batch.length === 0) break;

    // Delete sequentially to avoid rate limits
    for (const record of batch) {
      try {
        await base44.asServiceRole.entities.Deal.delete(record.id);
        totalDeleted++;
      } catch (e) {
        // If rate limited, wait longer
        if (e.message?.includes('429') || e.message?.includes('Rate limit')) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      // Small delay between each delete
      await new Promise(r => setTimeout(r, 50));
    }

    console.log(`Round ${round}: deleted ${totalDeleted} so far`);

    if (batch.length < 200) break;
    await new Promise(r => setTimeout(r, 500));
  }

  return Response.json({ success: true, deleted: totalDeleted });
});