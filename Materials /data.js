// data.js
// Static Harris job schedule data.
// In production this would be a fetch() to your Azure SQL API endpoint.
//
// Each job has:
//   materials[]  — what needs to be ordered, how much, and typical lead time in weeks
//   startDate    — when the job's IC phase begins (materials must be on-site by then)

const HARRIS_JOBS = [
  {
    id: "JOB-2026-041",
    name: "Eastgate Hospital Expansion",
    client: "Eastgate Health System",
    region: "Mid-Atlantic",
    startDate: "2026-09-08",
    materials: [
      { name: "Structural steel",    unit: "tons",  qty: 48,  leadWeeks: 14, fredSeries: "WPU101" },
      { name: "HVAC ductwork",       unit: "lf",    qty: 2200,leadWeeks: 8,  fredSeries: "WPU1191" },
      { name: "Copper pipe",         unit: "lf",    qty: 3400,leadWeeks: 6,  fredSeries: "WPU102502" },
    ]
  },
  {
    id: "JOB-2026-038",
    name: "Riverside Distribution Hub",
    client: "Riverside Logistics",
    region: "Southeast",
    startDate: "2026-08-18",
    materials: [
      { name: "Structural steel",    unit: "tons",  qty: 120, leadWeeks: 14, fredSeries: "WPU101" },
      { name: "Prefab wall panels",  unit: "panels",qty: 64,  leadWeeks: 10, fredSeries: "WPU0561" },
    ]
  },
  {
    id: "JOB-2026-045",
    name: "Lakeview Manufacturing Plant",
    client: "Lakeview Industrial",
    region: "Midwest",
    startDate: "2026-10-06",
    materials: [
      { name: "Structural steel",    unit: "tons",  qty: 210, leadWeeks: 14, fredSeries: "WPU101" },
      { name: "Copper pipe",         unit: "lf",    qty: 5100,leadWeeks: 6,  fredSeries: "WPU102502" },
      { name: "HVAC ductwork",       unit: "lf",    qty: 3800,leadWeeks: 8,  fredSeries: "WPU1191" },
      { name: "Electrical conduit",  unit: "lf",    qty: 9200,leadWeeks: 5,  fredSeries: "WPU1012" },
    ]
  },
  {
    id: "JOB-2026-033",
    name: "Southpark Arena Phase 2",
    client: "Metro Sports Authority",
    region: "Southeast",
    startDate: "2026-08-04",
    materials: [
      { name: "Structural steel",    unit: "tons",  qty: 340, leadWeeks: 14, fredSeries: "WPU101" },
      { name: "Prefab wall panels",  unit: "panels",qty: 112, leadWeeks: 10, fredSeries: "WPU0561" },
    ]
  },
  {
    id: "JOB-2026-049",
    name: "Central Office Retrofit",
    client: "Meridian Properties",
    region: "Mid-Atlantic",
    startDate: "2026-11-03",
    materials: [
      { name: "HVAC ductwork",       unit: "lf",    qty: 1400,leadWeeks: 8,  fredSeries: "WPU1191" },
      { name: "Electrical conduit",  unit: "lf",    qty: 4800,leadWeeks: 5,  fredSeries: "WPU1012" },
      { name: "Copper pipe",         unit: "lf",    qty: 2100,leadWeeks: 6,  fredSeries: "WPU102502" },
    ]
  },
];

// FRED series we track — labels for display
const FRED_SERIES = {
  "WPU101":    { label: "Structural steel (WPU101)",    unit: "index" },
  "WPU102502": { label: "Copper and brass mill shapes", unit: "index" },
  "WPU1191":   { label: "HVAC equipment (WPU1191)",     unit: "index" },
  "WPU0561":   { label: "Millwork / prefab (WPU0561)",  unit: "index" },
  "WPU1012":   { label: "Aluminum / conduit (WPU1012)", unit: "index" },
};

// Returns all unique FRED series IDs used across all jobs
function getAllSeriesIds() {
  const ids = new Set();
  HARRIS_JOBS.forEach(job => job.materials.forEach(m => ids.add(m.fredSeries)));
  return [...ids];
}
