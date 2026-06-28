// data.js
// Harris manufacturing work orders and job site data.
// In production: fetch from Azure SQL via your Flask API.

const JOB_SITES = [
  { id: "EHE",  name: "Eastgate Hospital Expansion",   city: "Philadelphia",     lat: 39.9526,  lon: -75.1652 },
  { id: "RDH",  name: "Riverside Distribution Hub",    city: "Charlotte",        lat: 35.2271,  lon: -80.8431 },
  { id: "LMP",  name: "Lakeview Manufacturing Plant",  city: "Columbus",         lat: 39.9612,  lon: -82.9988 },
  { id: "SPA",  name: "Southpark Arena Phase 2",       city: "Atlanta",          lat: 33.7490,  lon: -84.3880 },
  { id: "COR",  name: "Central Office Retrofit",       city: "Washington DC",    lat: 38.9072,  lon: -77.0369 },
];

const STAGES = ["Queued","Fabrication","Assembly","QC","Ready to ship","Shipped"];

const WORK_ORDERS = [
  // Eastgate Hospital
  { id:"WO-8801", assembly:"4-pipe hydronic MEP rack A",   jobId:"EHE", priority:"Critical", stage:"QC",             shipBy:"2026-07-14", blockedReason:null },
  { id:"WO-8802", assembly:"4-pipe hydronic MEP rack B",   jobId:"EHE", priority:"Critical", stage:"Assembly",        shipBy:"2026-07-14", blockedReason:null },
  { id:"WO-8803", assembly:"Chilled water pump skid",      jobId:"EHE", priority:"High",     stage:"Fabrication",     shipBy:"2026-07-21", blockedReason:"Steel delivery delayed — PO-4401" },
  { id:"WO-8804", assembly:"Domestic HW module",           jobId:"EHE", priority:"Standard", stage:"Queued",          shipBy:"2026-08-04", blockedReason:null },

  // Riverside
  { id:"WO-8805", assembly:"HVAC ductwork package 1",      jobId:"RDH", priority:"High",     stage:"Ready to ship",   shipBy:"2026-07-10", blockedReason:null },
  { id:"WO-8806", assembly:"HVAC ductwork package 2",      jobId:"RDH", priority:"High",     stage:"QC",              shipBy:"2026-07-10", blockedReason:null },
  { id:"WO-8807", assembly:"Structural brace set",         jobId:"RDH", priority:"Standard", stage:"Fabrication",     shipBy:"2026-07-28", blockedReason:"Awaiting engineer sign-off" },

  // Lakeview
  { id:"WO-8808", assembly:"Conveyor steel frame — bay 1", jobId:"LMP", priority:"Critical", stage:"Fabrication",     shipBy:"2026-08-11", blockedReason:null },
  { id:"WO-8809", assembly:"Conveyor steel frame — bay 2", jobId:"LMP", priority:"Critical", stage:"Queued",          shipBy:"2026-08-11", blockedReason:null },
  { id:"WO-8810", assembly:"HVAC rooftop curb set",        jobId:"LMP", priority:"High",     stage:"Assembly",        shipBy:"2026-08-18", blockedReason:null },
  { id:"WO-8811", assembly:"Electrical conduit rack",      jobId:"LMP", priority:"Standard", stage:"Queued",          shipBy:"2026-09-02", blockedReason:null },

  // Southpark Arena
  { id:"WO-8812", assembly:"Seating steel module A",       jobId:"SPA", priority:"Critical", stage:"Shipped",         shipBy:"2026-07-07", blockedReason:null },
  { id:"WO-8813", assembly:"Seating steel module B",       jobId:"SPA", priority:"Critical", stage:"Ready to ship",   shipBy:"2026-07-14", blockedReason:null },
  { id:"WO-8814", assembly:"Structural beam package",      jobId:"SPA", priority:"High",     stage:"Assembly",        shipBy:"2026-07-21", blockedReason:"QC hold — weld inspection pending" },

  // Central Office
  { id:"WO-8815", assembly:"HVAC split-system package",   jobId:"COR", priority:"Standard", stage:"Queued",          shipBy:"2026-09-15", blockedReason:null },
  { id:"WO-8816", assembly:"Electrical panel assembly",   jobId:"COR", priority:"Standard", stage:"Queued",          shipBy:"2026-09-15", blockedReason:null },
];

// Weather thresholds the shop supervisor cares about for delivery day
const WEATHER_THRESHOLDS = {
  windSpeed:   48,   // km/h — above this, flatbed transport is risky
  precipitation: 5,  // mm — above this, outdoor installation is affected
  weatherCode: 65,   // WMO code >= 65 is heavy rain or worse
};

function getSiteById(id) {
  return JOB_SITES.find(s => s.id === id);
}

// Get the unique job sites that have active (non-shipped) work orders
function getActiveSites() {
  const activeJobIds = [...new Set(
    WORK_ORDERS
      .filter(wo => wo.stage !== "Shipped")
      .map(wo => wo.jobId)
  )];
  return JOB_SITES.filter(s => activeJobIds.includes(s.id));
}
