import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { anno } = await req.json().catch(() => ({}));
  if (!anno) return Response.json({ error: 'anno required' }, { status: 400 });

  const result = await base44.asServiceRole.entities.Deal.deleteMany({ anno: String(anno) });

  return Response.json({ success: true, deleted: result.deleted, done: true, anno: String(anno) });
});