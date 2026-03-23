/**
 * Enriches deals with current portfolio data.
 * For each deal, if a matching PortafoglioCliente record is found (by ragione_sociale),
 * the deal's organizational fields (rac, area_rac, area_mng, struttura_sales) are
 * overridden with the latest portfolio values (_26 fields = current structure).
 * This ensures 2025 vs 2026 comparisons use the same organizational breakdown.
 */

function normalize(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildPortfolioMap(ptfClienti) {
  const map = new Map();
  for (const p of ptfClienti) {
    const key = normalize(p.ragione_sociale);
    if (key) map.set(key, p);
    // Also index by CF if available
    if (p.cf) map.set(normalize(p.cf), p);
  }
  return map;
}

export function enrichDealsWithPortfolio(deals, ptfClienti) {
  if (!ptfClienti || ptfClienti.length === 0) return deals;
  const map = buildPortfolioMap(ptfClienti);

  return deals.map(deal => {
    const key = normalize(deal.ragione_sociale);
    const ptf = map.get(key);
    if (!ptf) return deal;

    // Override org fields with current portfolio structure (2026 fields)
    return {
      ...deal,
      rac: ptf.rac_26 || ptf.rac || deal.rac,
      area_rac: ptf.area_rac_26 || ptf.area_rac || deal.area_rac,
      area_mng: ptf.area_mng_26 || ptf.area_mng || deal.area_mng,
      struttura_sales: ptf.struttura_sales_26 || ptf.struttura_sales || deal.struttura_sales,
      // Keep original for reference
      _rac_originale: deal.rac,
      _area_rac_originale: deal.area_rac,
      _portafoglio_matched: ptf.portafoglio_nome || '',
    };
  });
}