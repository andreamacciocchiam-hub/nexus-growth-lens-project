import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  try {
    // Delete all deals
    const deals = await base44.asServiceRole.entities.Deal.list(null, 10000);
    let deletedDeals = 0;
    for (const deal of deals) {
      await base44.asServiceRole.entities.Deal.delete(deal.id);
      deletedDeals++;
    }
    console.log(`Deleted ${deletedDeals} deals`);

    // Delete all portfolio clients
    const ptfClienti = await base44.asServiceRole.entities.PortafoglioCliente.list(null, 10000);
    let deletedPtf = 0;
    for (const ptf of ptfClienti) {
      await base44.asServiceRole.entities.PortafoglioCliente.delete(ptf.id);
      deletedPtf++;
    }
    console.log(`Deleted ${deletedPtf} portfolio clients`);

    return Response.json({
      success: true,
      deletedDeals,
      deletedPtf,
      message: 'All data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});