export type RunnerStatus = "available" | "busy" | "delivery" | "offline";

export type PricingModel = "flat_rate" | "per_item" | "custom";

export interface Pricing {
  model: PricingModel;
  price?: number;
  description?: string;
}

export interface Service {
  id: string;
  name: string;
  pricing: Pricing;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
}

export interface Runner {
  id: string;
  name: string;
  area: string;
  distanceKm: number;
  avatarInitials: string;
  avatarColor: string;
  status: RunnerStatus;
  statusNote?: string; // e.g. "back 8am"
  rating: number | null;
  jobsCompleted: number;
  acceptRate: number | null;
  services: Service[];
  milestones: string[];
  reviews: Review[];
  whatsappNumber: string;
  scheduleFrom?: string;
  scheduleTo?: string;
  lastSeenAt?: string | null;
}

export type JobStatus = "pending" | "confirmed" | "done" | "expired" | "cancelled";

export interface JobRequest {
  id: string;
  requesterId?: string;
  runnerId: string | null; // null = broadcast
  serviceType: string;
  takeFrom: string;
  deliverTo: string;
  notes?: string;
  status: JobStatus;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  jobId: string | null;
  read: boolean;
  createdAt: number;
}

export interface ReportRow {
  id: string;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  reporterName: string;
  reportedName: string;
  reportedId: string;
}

export interface AdminRunnerRow {
  id: string;
  name: string;
  area: string | null;
  status: string | null;
  whatsapp: string | null;
  services: unknown;
  isApproved: boolean;
  isSuspended: boolean;
  createdAt: string;
}

export interface AdminJobRow {
  id: string;
  serviceType: string;
  status: string;
  takeFrom: string;
  deliverTo: string;
  requesterName: string;
  runnerName: string | null;
  total: string | null;
  createdAt: string;
}
