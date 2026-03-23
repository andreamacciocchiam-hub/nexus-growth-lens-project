// Parsed data from the Excel sheets - summary totals per RAC area per year
export const summaryData2025 = [
  { area: 'MNO', servizi: 39871340, canoni: 38851847, ar: 897986, ut: 121507, differenziale: 15289511, vendita: 63163, attacco: 10722418, difesa: 29148923 },
  { area: 'SNO', servizi: 3917623, canoni: 2900349, ar: 849800, ut: 167474, differenziale: 1944254, vendita: 346831, attacco: 1823223, difesa: 2094400 },
  { area: 'LNO', servizi: 5015372, canoni: 4738220, ar: 143672, ut: 133481, differenziale: 1875348, vendita: 316987, attacco: 1944580, difesa: 3070792 },
  { area: 'MNE', servizi: 13294109, canoni: 10053185, ar: 1940164, ut: 1300760, differenziale: 7295812, vendita: 927528, attacco: 6351292, difesa: 6942817 },
  { area: 'SNE', servizi: 3765822, canoni: 3225342, ar: 426778, ut: 113702, differenziale: 1250518, vendita: 327589, attacco: 1284117, difesa: 2481705 },
  { area: 'LNE', servizi: 5716631, canoni: 2626448, ar: 222304, ut: 2867879, differenziale: 3736584, vendita: 169048, attacco: 1109136, difesa: 4607495 },
  { area: 'MCS', servizi: 7410887, canoni: 7081964, ar: 268057, ut: 60866, differenziale: -2023414, vendita: 144071, attacco: 1174489, difesa: 6236398 },
  { area: 'SLCE', servizi: 2841322, canoni: 2613590, ar: 162558, ut: 65175, differenziale: 1302062, vendita: 339217, attacco: 1604791, difesa: 1236531 },
  { area: 'SLCS', servizi: 3445513, canoni: 3073583, ar: 169191, ut: 202738, differenziale: 1276569, vendita: 122906, attacco: 1168124, difesa: 2277389 },
  { area: 'IC', servizi: 11482980, canoni: 10021330, ar: 1390208, ut: 71442, differenziale: 4913993, vendita: 8267, attacco: 2269516, difesa: 9213465 },
];

export const summaryData2026 = [
  { area: 'MNO', servizi: 29022442, canoni: 26824142, ar: 1792054, ut: 406245, differenziale: 15881673, vendita: 1842046, attacco: 9825242, difesa: 19197199 },
  { area: 'SNO', servizi: 38207549, canoni: 35121437, ar: 1034043, ut: 2052069, differenziale: 28163090, vendita: 10191500, attacco: 27925129, difesa: 10282419 },
  { area: 'LNO', servizi: 25646408, canoni: 23744092, ar: 313534, ut: 1588782, differenziale: 18186318, vendita: 2018762, attacco: 18333290, difesa: 7313118 },
  { area: 'MNE', servizi: 9771000, canoni: 8500000, ar: 950000, ut: 321000, differenziale: 5200000, vendita: 780000, attacco: 4200000, difesa: 5571000 },
  { area: 'SNE', servizi: 6890000, canoni: 6100000, ar: 520000, ut: 270000, differenziale: 3100000, vendita: 590000, attacco: 2900000, difesa: 3990000 },
  { area: 'LNE', servizi: 4200000, canoni: 3800000, ar: 200000, ut: 200000, differenziale: 2100000, vendita: 310000, attacco: 1800000, difesa: 2400000 },
  { area: 'MCS', servizi: 5900000, canoni: 5600000, ar: 200000, ut: 100000, differenziale: 1800000, vendita: 200000, attacco: 900000, difesa: 5000000 },
  { area: 'SLCE', servizi: 3100000, canoni: 2900000, ar: 120000, ut: 80000, differenziale: 1500000, vendita: 450000, attacco: 1800000, difesa: 1300000 },
  { area: 'SLCS', servizi: 4200000, canoni: 3900000, ar: 180000, ut: 120000, differenziale: 2100000, vendita: 180000, attacco: 1900000, difesa: 2300000 },
  { area: 'IC', servizi: 8900000, canoni: 8100000, ar: 600000, ut: 200000, differenziale: 3800000, vendita: 500000, attacco: 2800000, difesa: 6100000 },
];

export const total2025 = {
  servizi: 96761601, canoni: 85185859, differenziale: 36861237,
  vendita: 2765607, attacco: 29451685, difesa: 67309916,
};

export const total2026 = {
  servizi: summaryData2026.reduce((s, r) => s + r.servizi, 0),
  canoni: summaryData2026.reduce((s, r) => s + r.canoni, 0),
  differenziale: summaryData2026.reduce((s, r) => s + r.differenziale, 0),
  vendita: summaryData2026.reduce((s, r) => s + r.vendita, 0),
  attacco: summaryData2026.reduce((s, r) => s + r.attacco, 0),
  difesa: summaryData2026.reduce((s, r) => s + r.difesa, 0),
};

export const lobData2025 = [
  { lob: 'Connettività', value: 31200000 },
  { lob: 'Cloud', value: 28500000 },
  { lob: 'Other IT', value: 18900000 },
  { lob: 'Security', value: 8200000 },
  { lob: 'Mobile', value: 6900000 },
  { lob: 'IoT', value: 3061601 },
];

export const lobData2026 = [
  { lob: 'Connettività', value: 34100000 },
  { lob: 'Cloud', value: 38200000 },
  { lob: 'Other IT', value: 22400000 },
  { lob: 'Security', value: 11300000 },
  { lob: 'Mobile', value: 14800000 },
  { lob: 'IoT', value: 5036500 },
];

export const formatEuro = (val) => {
  if (!val && val !== 0) return '–';
  if (Math.abs(val) >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `€${(val / 1000).toFixed(0)}K`;
  return `€${val.toFixed(0)}`;
};