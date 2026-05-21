
import { Crew, Lead, Vendor } from "./types";

export const mockCrews: Crew[] = [
  {
    id: "alpha",
    name: "Alpha Crew",
    status: "ON_SITE",
    job: "Arbor Lakes HOA",
    progress: 65,
    leader: "Davis",
    equip: "Zero-Turn #4",
    phone: "601-555-0101",
  },
  {
    id: "beta",
    name: "Beta Crew",
    status: "TRANSPORT",
    job: "Schmidt Residence",
    progress: 10,
    leader: "Miller",
    equip: "F-250 Matrix",
    phone: "601-555-0102",
  },
  {
    id: "gamma",
    name: "Gamma Crew",
    status: "ON_SITE",
    job: "Hillside Manor",
    progress: 85,
    leader: "Wilson",
    equip: "Skid Steer 02",
    phone: "601-555-0103",
  },
];

export const mockHotLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Regency Senior Care",
    address: "12 Poplar Springs Dr",
    propSize: "4.5 acres",
    matchReason: "High upsell potential for turf irrigation adjustment",
    score: 95,
  },
  {
    id: "lead-2",
    name: "Meridian Aggregate Yard",
    address: "882 Marion Rd",
    propSize: "1.2 acres",
    matchReason: "Ready for full mulch renovation & grading",
    score: 88,
  },
  {
    id: "lead-3",
    name: "Governor Hills HOA Office",
    address: "492 Hills Ct",
    propSize: "2.8 acres",
    matchReason: "Requires noise-compliant electric clearing quote",
    score: 82,
  },
];

export const mockVendors: Vendor[] = [
  {
    id: "vendor-1",
    name: "Meridian Supply & Mulch",
    category: "Materials",
    status: "ACTIVE",
    contact: "Bob H.",
    nextDelivery: "May 20, 08:00 AM",
  },
  {
    id: "vendor-2",
    name: "Southern Agronomics",
    category: "Chemicals",
    status: "ACTIVE",
    contact: "Sarah J.",
    nextDelivery: "May 22, 10:30 AM",
  },
  {
    id: "vendor-3",
    name: "Elite Mower Repair",
    category: "Fleet Maintenance",
    status: "ON_CALL",
    contact: "Dave M.",
    nextDelivery: "N/A",
  },
];
