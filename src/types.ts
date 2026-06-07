// @ts-nocheck

export interface Crew {
  id: string;
  name: string;
  status: "ON_SITE" | "TRANSPORT" | "OFF_DUTY";
  job: string;
  progress: number;
  leader: string;
  equip: string;
  phone: string;
}

export interface Lead {
  id: string;
  name: string;
  address: string;
  propSize: string;
  matchReason: string;
  score: number;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  status: "ACTIVE" | "ON_CALL" | "INACTIVE";
  contact: string;
  nextDelivery: string;
}

export interface CallOutcome {
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  transcript?: string;
  text?: string;
  nextStep?: string;
  summary?: string;
}

export interface ScanResult {
  text: string;
  name?: string;
  brand?: string;
  category?: string;
  suggestedUnit?: string;
  barcode?: string;
}

export interface WeatherInfo {
  condition: string;
  temp: number;
  forecast?: string;
}

export interface Customer {
  id?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  status?: string;
  address?: string;
  propertySize?: string;
  notes?: string;
  magicLinkSentAt?: string;
  magicLinkSentCount?: number;
  isHOA?: boolean;
  priority?: boolean;
  segment?: string;
  aiScore?: number;
  aiScoreLabel?: string;
  aiScoreReasoning?: string;
  semanticBriefing?: any;
  semanticEnrichment?: any;
  semanticInsights?: any;
}

export interface Invoice {
  id: string;
  customer?: string;
  client?: string;
  amount: number;
  status: "PAID" | "PENDING" | "OVERDUE" | "DRAFT" | "paid" | string;
  date: string;
  dueDate?: string;
  items?: Record<string, unknown>[];
  isArchived?: boolean;
}

export interface InventoryItem {
  id?: string;
  name: string;
  sku: string;
  stock?: number;
  category?: string;
  status?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | string;
  location?: string;
  imageUrl?: string;
  item?: string;
  vendor?: string;
  brand?: string;
  barcode?: string;
  partNumber?: string;
  quantity?: number;
  minThreshold?: number;
  unit?: string;
  unitPrice?: number;
  unitCost?: number;
  isArchived?: boolean;
  lastScannedAt?: string | number | Date | any;
}

export interface Job {
  id: string;
  title: string;
  client?: string;
  status: "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  date?: string;
  assignedTo?: string;
  revenue?: number;
  address?: string;
  notes?: string;
  checklist?: { id: string; text: string; completed: boolean }[];
  progress?: number;
}

export interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  score?: number;
  actionable?: boolean;
  roi?: string;
}
