// data.js
// Estimating-specific configuration.
// Defines which FRED indices matter for construction estimating
// and the contingency logic the estimating team agreed on.

const ESTIMATE_INDICES = [
  {
    id:          "WPU101",
    label:       "Structural steel",
    category:    "Metals",
    description: "Steel mill products — beams, columns, plate",
    unit:        "PPI index",
    bidCategory: "steel",
  },
  {
    id:          "WPU102502",
    label:       "Copper & brass",
    category:    "Metals",
    description: "Copper pipe, fittings, brass components",
    unit:        "PPI index",
    bidCategory: "copper",
  },
  {
    id:          "WPU1012",
    label:       "Aluminum / conduit",
    category:    "Metals",
    description: "Aluminum mill shapes, electrical conduit",
    unit:        "PPI index",
    bidCategory: "electrical",
  },
  {
    id:          "WPU0561",
    label:       "Prefab & millwork",
    category:    "Fabrication",
    description: "Prefabricated structural components, millwork",
    unit:        "PPI index",
    bidCategory: "prefab",
  },
  {
    id:          "WPU1191",
    label:       "HVAC equipment",
    category:    "Mechanical",
    description: "Heating, cooling, and ventilation equipment",
    unit:        "PPI index",
    bidCategory: "hvac",
  },
  {
    id:          "PCU2382--2382--",
    label:       "Building construction labor",
    category:    "Labor",
    description: "Producer price index for building construction services",
    unit:        "PPI index",
    bidCategory: "labor",
  },
  {
    id:          "WPU0811",
    label:       "Lumber & wood",
    category:    "Materials",
    description: "Lumber, plywood, and wood products",
    unit:        "PPI index",
    bidCategory: "lumber",
  },
];

// Bid line items the estimator fills in.
// Each maps to a FRED index for contingency calculation.
const BID_LINE_ITEMS = [
  { key: "steel",      label: "Structural steel",      fredId: "WPU101",         placeholder: "e.g. 850000" },
  { key: "copper",     label: "Copper / piping",       fredId: "WPU102502",      placeholder: "e.g. 220000" },
  { key: "hvac",       label: "HVAC equipment",        fredId: "WPU1191",        placeholder: "e.g. 310000" },
  { key: "prefab",     label: "Prefab modules",        fredId: "WPU0561",        placeholder: "e.g. 640000" },
  { key: "electrical", label: "Electrical / conduit",  fredId: "WPU1012",        placeholder: "e.g. 180000" },
  { key: "lumber",     label: "Lumber / wood",         fredId: "WPU0811",        placeholder: "e.g. 95000"  },
  { key: "labor",      label: "Labor (construction)",  fredId: "PCU2382--2382--",placeholder: "e.g. 1200000"},
];

// Contingency rules agreed with the estimating team.
// Based on trailing 12-month YoY price change.
function getContingencyRate(yoyChangePct) {
  if (yoyChangePct === null || yoyChangePct === undefined) return 0.03; // default 3% if no data
  if (yoyChangePct > 10) return 0.10;   // extreme inflation — 10% contingency
  if (yoyChangePct > 6)  return 0.07;   // high inflation — 7%
  if (yoyChangePct > 3)  return 0.05;   // moderate inflation — 5%
  if (yoyChangePct > 0)  return 0.03;   // mild inflation — 3%
  if (yoyChangePct > -3) return 0.02;   // stable/slight deflation — 2%
  return 0.01;                           // deflation — 1% (minimum)
}

function contingencyLabel(rate) {
  if (rate >= 0.10) return { text: "Extreme",  cls: "badge-high" };
  if (rate >= 0.07) return { text: "High",     cls: "badge-high" };
  if (rate >= 0.05) return { text: "Moderate", cls: "badge-med"  };
  if (rate >= 0.03) return { text: "Standard", cls: "badge-low"  };
  return                    { text: "Minimal",  cls: "badge-low"  };
}
