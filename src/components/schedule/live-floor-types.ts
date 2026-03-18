export interface LiveFloorBay {
  id: string;
  name: string;
  type: string;
  color: string | null;
  sortOrder: number;
  assignments: LiveFloorAssignment[];
}

export interface LiveFloorAssignment {
  id: string;
  startDate: string;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    status: string;
    priority: string;
    createdAt: string;
    customer: { id: string; firstName: string; lastName: string };
    vehicle: { plateNumber: string; make: string; model: string; color: string | null };
    primaryTechnician: { id: string; firstName: string; lastName: string } | null;
    tasks: { assignedTechnician: { id: string; firstName: string } | null }[];
    estimates?: {
      id: string;
      versions: {
        id: string;
        techReviewSignedAt: string | null;
        mgmtApprovalSignedAt: string | null;
      }[];
    }[];
  };
}

export interface LiveFloorStats {
  queueLength: number;
  activeServices: number;
  availableTechs: number;
  totalTechs: number;
  pendingEstimates: number;
}

export interface LiveFloorJob {
  id: string;
  jobOrderNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  customer: { firstName: string; lastName: string };
  vehicle: { plateNumber: string; make: string; model: string };
  primaryTechnician: { id: string; firstName: string } | null;
  assignedBayId: string | null;
  bayName: string | null;
  services: string[];
  incompleteIntake: boolean;
}

export const BAY_STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "#10B981",
  CHECKED_IN: "#F59E0B",
  QC_PENDING: "#8B5CF6",
  QC_PASSED: "#3B82F6",
  AWAITING_PAYMENT: "#F97316",
  DEFAULT: "#6B7280",
};

export const DARK_STATUS_PILLS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "rgba(148,163,184,0.2)", text: "#94A3B8", label: "Pending" },
  CHECKED_IN: { bg: "rgba(245,158,11,0.2)", text: "#FBBF24", label: "Waitlist" },
  IN_PROGRESS: { bg: "rgba(16,185,129,0.2)", text: "#34D399", label: "In-Service" },
  QC_PENDING: { bg: "rgba(139,92,246,0.2)", text: "#A78BFA", label: "QC" },
  QC_PASSED: { bg: "rgba(59,130,246,0.2)", text: "#60A5FA", label: "QC Passed" },
  QC_FAILED_REWORK: { bg: "rgba(239,68,68,0.2)", text: "#F87171", label: "Rework" },
  AWAITING_PAYMENT: { bg: "rgba(249,115,22,0.2)", text: "#FB923C", label: "Pickup" },
  PARTIAL_PAYMENT: { bg: "rgba(234,179,8,0.2)", text: "#FACC15", label: "Partial Pay" },
  FULLY_PAID: { bg: "rgba(16,185,129,0.2)", text: "#34D399", label: "Paid" },
  RELEASED: { bg: "rgba(100,116,139,0.2)", text: "#94A3B8", label: "Done" },
  CANCELLED: { bg: "rgba(100,116,139,0.15)", text: "#64748B", label: "Cancelled" },
};
