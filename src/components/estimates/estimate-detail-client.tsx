"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronRight,
  Phone,
  Mail,
  Car,
  AlertTriangle,
  Shield,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  startEstimateAction,
  updateEstimateStatusAction,
} from "@/lib/actions/estimate-actions";
import {
  ESTIMATE_REQUEST_STATUS_LABELS,
  ESTIMATE_REQUEST_STATUS_COLORS,
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
} from "@/types/enums";
import type { EstimateRequestStatus } from "@/types/enums";
import {
  formatDate,
  formatPeso,
  formatPlateNumber,
  formatPhone,
  cn,
} from "@/lib/utils";
import { EstimateBuilder } from "./estimate-builder";

// ---------------------------------------------------------------------------
// Types — inferred from getEstimateRequestById return shape
// ---------------------------------------------------------------------------

interface LineItem {
  id: string;
  group: string;
  description: string;
  serviceCatalogId: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  markup: number;
  subtotal: number;
  notes: string | null;
  estimatedHours: number | null;
  assignedTechnicianId: string | null;
  sortOrder: number;
}

interface EstimateVersion {
  id: string;
  versionNumber: number;
  versionLabel: string;
  subtotalLabor: number;
  subtotalParts: number;
  subtotalMaterials: number;
  subtotalPaint: number;
  subtotalSublet: number;
  subtotalOther: number;
  vatRate: number;
  vatAmount: number;
  discountType: string | null;
  discountValue: number;
  discountReason: string | null;
  grandTotal: number;
  termsAndConditions: string | null;
  estimatedDays: number | null;
  approvalToken: string | null;
  lineItems: LineItem[];
}

interface Estimate {
  id: string;
  versions: EstimateVersion[];
}

interface JobOrder {
  id: string;
  jobOrderNumber: string;
  status: string;
  createdAt: Date;
}

interface EstimateRequest {
  id: string;
  requestNumber: string;
  status: string;
  customerConcern: string;
  requestedCategories: string;
  isInsuranceClaim: boolean;
  claimNumber: string | null;
  adjusterName: string | null;
  adjusterContact: string | null;
  createdAt: Date;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string;
    jobOrders: JobOrder[];
  };
  estimates: Estimate[];
}

interface Props {
  estimateRequest: EstimateRequest;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EstimateDetailClient({ estimateRequest }: Props) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const hasEstimate =
    estimateRequest.estimates.length > 0 &&
    estimateRequest.estimates[0].versions.length > 0;

  // ── Mode A — Inquiry View ──────────────────────────────────────────────
  if (!hasEstimate) {
    return (
      <InquiryView
        estimateRequest={estimateRequest}
        starting={starting}
        onStart={async () => {
          setStarting(true);
          const result = await startEstimateAction(estimateRequest.id);
          if (result.success) {
            toast.success("Estimate started — you can now add line items.");
            router.refresh();
          } else {
            toast.error(result.error ?? "Failed to start estimate.");
          }
          setStarting(false);
        }}
      />
    );
  }

  // ── Mode B — Estimate Builder ──────────────────────────────────────────
  const version = estimateRequest.estimates[0].versions[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <Link href="/estimates" className="hover:text-accent transition-colors">
          Estimates
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-mono font-bold text-primary">
          {estimateRequest.requestNumber}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">
            {estimateRequest.customer.firstName}{" "}
            {estimateRequest.customer.lastName} —{" "}
            <span className="font-mono">
              {formatPlateNumber(estimateRequest.vehicle.plateNumber)}
            </span>
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {estimateRequest.vehicle.make} {estimateRequest.vehicle.model}
            {estimateRequest.vehicle.year
              ? ` (${estimateRequest.vehicle.year})`
              : ""}
            {" · "}
            {estimateRequest.vehicle.color}
          </p>
        </div>
        <StatusBadge status={estimateRequest.status} />
      </div>

      <EstimateBuilder
        estimateRequestId={estimateRequest.id}
        version={version}
        status={estimateRequest.status}
        approvalToken={version.approvalToken}
        customerId={estimateRequest.customer.id}
        vehicleId={estimateRequest.vehicle.id}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inquiry View — Mode A
// ---------------------------------------------------------------------------

function InquiryView({
  estimateRequest,
  starting,
  onStart,
}: {
  estimateRequest: EstimateRequest;
  starting: boolean;
  onStart: () => void;
}) {
  let categories: string[] = [];
  try {
    categories = JSON.parse(estimateRequest.requestedCategories ?? "[]");
  } catch {
    categories = [];
  }

  const pastJobs = estimateRequest.vehicle.jobOrders ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <Link href="/estimates" className="hover:text-accent transition-colors">
          Estimates
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-mono font-bold text-primary">
          {estimateRequest.requestNumber}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">
            Inquiry Details
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Created {formatDate(estimateRequest.createdAt)}
          </p>
        </div>
        <StatusBadge status={estimateRequest.status} />
      </div>

      {/* Customer Card */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <h2 className="text-sm font-semibold text-primary mb-3">Customer</h2>
        <div className="space-y-2">
          <p className="font-medium text-primary">
            {estimateRequest.customer.firstName}{" "}
            {estimateRequest.customer.lastName}
          </p>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Phone className="w-3.5 h-3.5" />
            <span>{formatPhone(estimateRequest.customer.phone)}</span>
          </div>
          {estimateRequest.customer.email && (
            <div className="flex items-center gap-2 text-sm text-surface-500">
              <Mail className="w-3.5 h-3.5" />
              <span>{estimateRequest.customer.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Card */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <h2 className="text-sm font-semibold text-primary mb-3">Vehicle</h2>
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-surface-400" />
          <div>
            <p className="font-mono font-bold text-lg text-primary">
              {formatPlateNumber(estimateRequest.vehicle.plateNumber)}
            </p>
            <p className="text-sm text-surface-500">
              {estimateRequest.vehicle.make} {estimateRequest.vehicle.model}
              {estimateRequest.vehicle.year
                ? ` (${estimateRequest.vehicle.year})`
                : ""}
              {" · "}
              {estimateRequest.vehicle.color}
            </p>
          </div>
        </div>

        {pastJobs.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-700">
              This vehicle has been here before &mdash; {pastJobs.length}{" "}
              previous job{pastJobs.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Concern Section */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <h2 className="text-sm font-semibold text-primary mb-3">
          Customer Concern
        </h2>
        <p className="text-sm text-surface-600 whitespace-pre-wrap">
          {estimateRequest.customerConcern}
        </p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {categories.map((cat) => (
              <Badge key={cat} variant="accent">
                {cat}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Insurance Section */}
      {estimateRequest.isInsuranceClaim && (
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-primary">
              Insurance Claim
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {estimateRequest.claimNumber && (
              <div>
                <span className="block text-xs font-medium text-surface-500 mb-0.5">
                  Claim Number
                </span>
                <span className="font-mono text-primary">
                  {estimateRequest.claimNumber}
                </span>
              </div>
            )}
            {estimateRequest.adjusterName && (
              <div>
                <span className="block text-xs font-medium text-surface-500 mb-0.5">
                  Adjuster Name
                </span>
                <span className="text-primary">
                  {estimateRequest.adjusterName}
                </span>
              </div>
            )}
            {estimateRequest.adjusterContact && (
              <div>
                <span className="block text-xs font-medium text-surface-500 mb-0.5">
                  Adjuster Contact
                </span>
                <span className="text-primary">
                  {estimateRequest.adjusterContact}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Estimate Button */}
      <button
        onClick={onStart}
        disabled={starting}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors disabled:opacity-50"
      >
        {starting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting Estimate...
          </>
        ) : (
          "Start Estimate"
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared — Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const label =
    ESTIMATE_REQUEST_STATUS_LABELS[status as EstimateRequestStatus] ?? status;
  const colorClass =
    ESTIMATE_REQUEST_STATUS_COLORS[status as EstimateRequestStatus] ??
    "bg-surface-100 text-surface-500";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        colorClass
      )}
    >
      {label}
    </span>
  );
}
