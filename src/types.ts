
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
}

export interface ScanResult {
  text: string;
  name?: string;
}

export interface WeatherInfo {
  condition: string;
  temp: number;
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
  isHOA?: boolean;
  priority?: boolean;
  segment?: string;
  aiScore?: number;
  aiScoreLabel?: string;
  aiScoreReasoning?: string;
}

export interface Invoice {
  id: string;
  customer?: string;
  amount: number;
  status: "PAID" | "PENDING" | "OVERDUE" | "DRAFT";
  date: string;
  dueDate?: string;
  items?: Record<string, unknown>[];
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  category?: string;
  status?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  location?: string;
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
