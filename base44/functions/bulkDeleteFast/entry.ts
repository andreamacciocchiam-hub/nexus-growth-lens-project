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
      console.log(`Starting bulk delete for ${anno}`);

      let safetyCount = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.Deal.filter({ anno }, null, 200, 0);

        if (!batch || batch.length === 0) {
          console.log(`Done ${anno}: total deleted ${totalDeleted}`);
          break;
        }

        // Delete in parallel chunks of 5 with rate-limit retry
        const CHUNK = 5;
        for (let i = 0; i < batch.length; i += CHUNK) {
          const chunk = batch.slice(i, i + CHUNK);
          await Promise.all(chunk.map(async (record) => {
            let attempts = 0;
            while (attempts < 3) {
              try {
                await base44.asServiceRole.entities.Deal.delete(record.id);
                totalDeleted++;
                return;
              } catch (e) {
                attempts++;
                if (attempts < 3) {
                  await new Promise(r => setTimeout(r, 500 * attempts));
                } else {
                  console.error(`Failed to delete ${record.id}: ${e.message}`);
                }
              }
            }
          }));
          // Small pause between chunks to avoid rate limit
          await new Promise(r => setTimeout(r, 100));
        }

        safetyCount++;
        if (safetyCount > 500) break; // Safety limit
      }
    }

    return Response.json({
      success: true,
      totalDeleted,
      message: `Eliminated ${totalDeleted} records from ${years.join(', ')}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});