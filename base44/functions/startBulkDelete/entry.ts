import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { years } = await req.json().catch(() => ({}));
  const targetYears = years || ['2025', '2026'];

  // ✅ Lancia tutti gli anni in parallelo
  await Promise.all(
    targetYears.map(anno =>
      base44.asServiceRole.functions.invoke('deleteChunk', { anno, totalDeleted: 0 })
    )
  );

  return Response.json({ started: true, years: targetYears });
});