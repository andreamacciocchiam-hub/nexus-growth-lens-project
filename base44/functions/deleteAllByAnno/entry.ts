import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { entityName, anno } = body;

  if (!entityName) return Response.json({ error: 'entityName required' }, { status: 400 });

  try {
    // ✅ client normale — NO asServiceRole
    const result = await base44.entities[entityName].deleteMany({ anno: String(anno) });
    const deleted = result?.deleted ?? 0;
    return Response.json({ success: true, deleted });
  } catch (e) {
    console.error('deleteMany error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});