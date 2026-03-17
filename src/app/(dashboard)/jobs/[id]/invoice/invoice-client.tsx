"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Pencil,
  Trash2,
  Plus,
  Printer,
  Share2,
  Link,
  Check,
  X,
  Copy,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatPeso, formatDate, centavosToPesos, pesosToCentavos, cn } from "@/lib/utils";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
  type EstimateLineItemGroup,
  type PaymentStatus,
} from "@/types/enums";
import {
  generateInvoiceAction,
  toggleBillingModeAction,
  updateInvoiceAction,
  applyDiscountAction,
  addInvoiceLineItemAction,
  updateInvoiceLineItemAction,
  deleteInvoiceLineItemAction,
  generateShareLinkAction,
} from "@/lib/actions/invoice-actions";
import PaymentForm from "@/components/invoices/payment-form";
import PaymentHistory from "@/components/invoices/payment-history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceClientProps {
  job: {
    id: string;
    jobOrderNumber: string;
    status: string;
    priority: string;
    isInsuranceJob: boolean;
    customer: {
      firstName: string;
      lastName: string;
      phone: string | null;
      email: string | null;
      address: string | null;
    };
    vehicle: {
      plateNumber: string;
      make: string;
      model: string;
      year: number | null;
      color: string | null;
      vin: string | null;
    };
  };
  invoice: any | null;
  payments: any[];
  shopInfo: Record<string, string>;
  userRole: string;
  canEdit: boolean;
  canProcessPayment: boolean;
  canViewAnalytics: boolean;
}

interface LineItem {
  id: string;
  group: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  sortOrder: number;
}

const LINE_ITEM_GROUPS: EstimateLineItemGroup[] = [
  "LABOR",
  "PARTS",
  "MATERIALS",
  "PAINT",
  "SUBLET",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InvoiceClient({
  job,
  invoice,
  payments,
  shopInfo,
  userRole,
  canEdit,
  canProcessPayment,
  canViewAnalytics,
}: InvoiceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Edit states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    description: string;
    quantity: string;
    unit: string;
    unitCost: string;
  }>({ description: "", quantity: "", unit: "", unitCost: "" });

  // Add item states
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    description: "",
    quantity: "1",
    unit: "pcs",
    unitCost: "",
  });

  // Discount states
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    type: "flat" as "flat" | "percentage",
    value: "",
    reason: "",
  });

  // Notes state
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [notesChanged, setNotesChanged] = useState(false);

  // Share link state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // No Invoice State
  // -------------------------------------------------------------------------
  if (!invoice) {
    const canGenerate =
      job.status === "QC_PASSED" || job.status === "AWAITING_PAYMENT";

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <FileText className="h-16 w-16 text-surface-300 mb-4" />
        {canGenerate ? (
          <>
            <h2 className="text-lg font-semibold text-primary mb-2">
              Ready to Generate Invoice
            </h2>
            <p className="text-sm text-surface-500 mb-6 text-center max-w-md">
              QC has passed. Generate the invoice to proceed with payment
              collection.
            </p>
            <button
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await generateInvoiceAction(job.id);
                  if (result.success) {
                    router.refresh();
                  } else {
                    setError(result.error ?? "Failed to generate invoice");
                  }
                });
              }}
              disabled={isPending}
              className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "Generating..." : "Generate Invoice"}
            </button>
            {error && (
              <p className="mt-3 text-sm text-danger-600">{error}</p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-primary mb-2">
              Invoice Not Available
            </h2>
            <p className="text-sm text-surface-500 text-center max-w-md">
              Invoice will be available after QC passes. Current job status
              must be QC Passed or Awaiting Payment.
            </p>
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Grouped line items
  // -------------------------------------------------------------------------
  const lineItems: LineItem[] = invoice.lineItems ?? [];
  const groupedItems = LINE_ITEM_GROUPS.map((group) => ({
    group,
    label:
      ESTIMATE_LINE_ITEM_GROUP_LABELS[group] ?? group,
    items: lineItems.filter((item: LineItem) => item.group === group),
    subtotal: lineItems
      .filter((item: LineItem) => item.group === group)
      .reduce((sum: number, item: LineItem) => sum + item.subtotal, 0),
  })).filter((g) => g.items.length > 0 || addingGroup === g.group);

  // Totals
  const subtotal = lineItems.reduce(
    (sum: number, item: LineItem) => sum + item.subtotal,
    0
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  function startEdit(item: LineItem) {
    setEditingItemId(item.id);
    setEditForm({
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitCost: centavosToPesos(item.unitCost),
    });
  }

  function cancelEdit() {
    setEditingItemId(null);
    setEditForm({ description: "", quantity: "", unit: "", unitCost: "" });
  }

  function saveEdit(itemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateInvoiceLineItemAction(itemId, job.id, {
        description: editForm.description,
        quantity: parseFloat(editForm.quantity),
        unit: editForm.unit,
        unitCost: pesosToCentavos(editForm.unitCost),
      });
      if (result.success) {
        cancelEdit();
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update line item");
      }
    });
  }

  function handleAddItem(group: string) {
    setError(null);
    startTransition(async () => {
      const result = await addInvoiceLineItemAction(invoice.id, job.id, {
        group,
        description: addForm.description,
        quantity: parseFloat(addForm.quantity),
        unit: addForm.unit,
        unitCost: pesosToCentavos(addForm.unitCost),
        sortOrder: lineItems.length,
      });
      if (result.success) {
        setAddingGroup(null);
        setAddForm({ description: "", quantity: "1", unit: "pcs", unitCost: "" });
        router.refresh();
      } else {
        setError(result.error ?? "Failed to add line item");
      }
    });
  }

  function handleDeleteItem(itemId: string) {
    if (!confirm("Delete this line item?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteInvoiceLineItemAction(itemId, job.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to delete line item");
      }
    });
  }

  function handleToggleBillingMode(mode: string) {
    setError(null);
    startTransition(async () => {
      const result = await toggleBillingModeAction(invoice.id, job.id, mode);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to toggle billing mode");
      }
    });
  }

  function handleApplyDiscount() {
    setError(null);
    startTransition(async () => {
      const discountValue =
        discountForm.type === "flat"
          ? pesosToCentavos(discountForm.value)
          : parseFloat(discountForm.value) * 100; // basis points
      const result = await applyDiscountAction(invoice.id, job.id, {
        discountType: discountForm.type,
        discountValue,
        discountReason: discountForm.reason,
      });
      if (result.success) {
        setShowDiscount(false);
        setDiscountForm({ type: "flat", value: "", reason: "" });
        router.refresh();
      } else {
        setError(result.error ?? "Failed to apply discount");
      }
    });
  }

  function handleSaveNotes() {
    setError(null);
    startTransition(async () => {
      const result = await updateInvoiceAction(invoice.id, job.id, {
        notes: notes || null,
      });
      if (result.success) {
        setNotesChanged(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to save notes");
      }
    });
  }

  function handleShareLink() {
    setError(null);
    startTransition(async () => {
      const result = await generateShareLinkAction(invoice.id, job.id);
      if (result.success && result.data?.token) {
        const url = `${window.location.origin}/approve/invoice/${result.data.token}`;
        setShareUrl(url);
      } else {
        setError(result.error ?? "Failed to generate share link");
      }
    });
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // -------------------------------------------------------------------------
  // Discount display helpers
  // -------------------------------------------------------------------------
  function getDiscountAmount(): number {
    if (!invoice.discountType || invoice.discountValue <= 0) return 0;
    if (invoice.discountType === "flat") return invoice.discountValue;
    // percentage: discountValue is in basis points
    return Math.round(subtotal * (invoice.discountValue / 10000));
  }

  const discountAmount = getDiscountAmount();
  const discountLabel =
    invoice.discountType === "percentage"
      ? `Discount (${(invoice.discountValue / 100).toFixed(1)}%)`
      : "Discount (Flat)";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white;
          }
          nav,
          aside,
          [data-sidebar],
          [data-topbar] {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Error banner */}
        {error && (
          <div className="no-print bg-danger-50 border border-danger-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-danger-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-danger-400 hover:text-danger-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ====================== INVOICE HEADER ====================== */}
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Shop Info */}
            <div>
              <h2 className="text-xl font-bold text-primary">
                {shopInfo.shop_name || "Auto Body Shop"}
              </h2>
              {shopInfo.shop_address && (
                <p className="text-sm text-surface-500 mt-1">
                  {shopInfo.shop_address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {shopInfo.shop_phone && (
                  <p className="text-sm text-surface-500">
                    {shopInfo.shop_phone}
                  </p>
                )}
                {shopInfo.shop_email && (
                  <p className="text-sm text-surface-500">
                    {shopInfo.shop_email}
                  </p>
                )}
              </div>
              {shopInfo.shop_tin && (
                <p className="text-xs text-surface-400 mt-1">
                  TIN: <span className="font-mono">{shopInfo.shop_tin}</span>
                </p>
              )}
            </div>

            {/* Invoice Details */}
            <div className="text-right">
              <h3 className="text-lg font-semibold text-primary">INVOICE</h3>
              <p className="text-sm font-medium font-mono text-primary mt-1">
                {invoice.invoiceNumber}
              </p>
              <p className="text-sm text-surface-500">
                Date: <span className="font-mono">{formatDate(invoice.createdAt)}</span>
              </p>
              {invoice.dueDate && (
                <p className="text-sm text-surface-500">
                  Due: <span className="font-mono">{formatDate(invoice.dueDate)}</span>
                </p>
              )}
              <p className="text-sm text-surface-500">
                Job: <span className="font-mono">{job.jobOrderNumber}</span>
              </p>
              <div className="mt-2">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    PAYMENT_STATUS_COLORS[
                      invoice.paymentStatus as PaymentStatus
                    ] ?? "bg-surface-200 text-surface-600"
                  )}
                >
                  {PAYMENT_STATUS_LABELS[
                    invoice.paymentStatus as PaymentStatus
                  ] ?? invoice.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Billing Mode Toggle */}
          {canEdit && (
            <div className="no-print mt-4 pt-4 border-t border-surface-200">
              <div className="flex items-center gap-3">
                <span className="text-sm text-surface-500">Billing Mode:</span>
                <div className="flex rounded-lg border border-surface-300 overflow-hidden">
                  <button
                    onClick={() => handleToggleBillingMode("estimated")}
                    disabled={isPending}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      invoice.billingMode === "estimated"
                        ? "bg-accent-600 text-white"
                        : "bg-white text-surface-600 hover:bg-surface-50"
                    )}
                  >
                    Estimated
                  </button>
                  <button
                    onClick={() => handleToggleBillingMode("actual")}
                    disabled={isPending}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      invoice.billingMode === "actual"
                        ? "bg-accent-600 text-white"
                        : "bg-white text-surface-600 hover:bg-surface-50"
                    )}
                  >
                    Actual
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ====================== CUSTOMER + VEHICLE ====================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer */}
          <div className="bg-white rounded-lg border border-surface-200 p-6">
            <h4 className="text-sm font-semibold text-primary mb-3">
              Bill To
            </h4>
            <p className="text-sm font-medium text-primary">
              {job.customer.firstName} {job.customer.lastName}
            </p>
            {job.customer.phone && (
              <p className="text-sm text-surface-500">{job.customer.phone}</p>
            )}
            {job.customer.email && (
              <p className="text-sm text-surface-500">{job.customer.email}</p>
            )}
            {job.customer.address && (
              <p className="text-sm text-surface-500 mt-1">
                {job.customer.address}
              </p>
            )}
          </div>

          {/* Vehicle */}
          <div className="bg-white rounded-lg border border-surface-200 p-6">
            <h4 className="text-sm font-semibold text-primary mb-3">
              Vehicle
            </h4>
            <p className="text-sm font-medium text-primary">
              {[job.vehicle.year, job.vehicle.make, job.vehicle.model]
                .filter(Boolean)
                .join(" ")}
            </p>
            {job.vehicle.color && (
              <p className="text-sm text-surface-500">
                Color: {job.vehicle.color}
              </p>
            )}
            <p className="text-sm text-surface-500">
              Plate: {job.vehicle.plateNumber}
            </p>
            {job.vehicle.vin && (
              <p className="text-sm text-surface-500">VIN: {job.vehicle.vin}</p>
            )}
          </div>
        </div>

        {/* ====================== LINE ITEMS TABLE ====================== */}
        <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
          <div className="p-6 pb-0">
            <h4 className="text-lg font-semibold text-primary">Line Items</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left px-6 py-3 text-xs font-medium text-surface-500 uppercase">
                    Description
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-surface-500 uppercase">
                    Qty
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-surface-500 uppercase">
                    Unit
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-surface-500 uppercase">
                    Unit Price
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-surface-500 uppercase">
                    Subtotal
                  </th>
                  {canEdit && (
                    <th className="no-print text-right px-3 py-3 text-xs font-medium text-surface-500 uppercase w-20">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {groupedItems.map((group) => (
                  <GroupSection
                    key={group.group}
                    group={group.group}
                    label={group.label}
                    items={group.items}
                    groupSubtotal={group.subtotal}
                    canEdit={canEdit}
                    editingItemId={editingItemId}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onDeleteItem={handleDeleteItem}
                    isPending={isPending}
                    addingGroup={addingGroup}
                    setAddingGroup={setAddingGroup}
                    addForm={addForm}
                    setAddForm={setAddForm}
                    onAddItem={handleAddItem}
                  />
                ))}

                {/* Show empty groups for adding */}
                {canEdit &&
                  LINE_ITEM_GROUPS.filter(
                    (g) =>
                      !groupedItems.some((gi) => gi.group === g) &&
                      addingGroup === g
                  ).map((g) => (
                    <GroupSection
                      key={g}
                      group={g}
                      label={ESTIMATE_LINE_ITEM_GROUP_LABELS[g] ?? g}
                      items={[]}
                      groupSubtotal={0}
                      canEdit={canEdit}
                      editingItemId={editingItemId}
                      editForm={editForm}
                      setEditForm={setEditForm}
                      onStartEdit={startEdit}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={saveEdit}
                      onDeleteItem={handleDeleteItem}
                      isPending={isPending}
                      addingGroup={addingGroup}
                      setAddingGroup={setAddingGroup}
                      addForm={addForm}
                      setAddForm={setAddForm}
                      onAddItem={handleAddItem}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          {/* Add item to new group */}
          {canEdit && (
            <div className="no-print px-6 py-3 border-t border-surface-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-surface-500">Add item to:</span>
                {LINE_ITEM_GROUPS.map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setAddingGroup(g);
                      setAddForm({
                        description: "",
                        quantity: "1",
                        unit: "pcs",
                        unitCost: "",
                      });
                    }}
                    className="text-xs text-accent-600 hover:text-accent-700 font-medium"
                  >
                    {ESTIMATE_LINE_ITEM_GROUP_LABELS[g] ?? g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ====================== TOTALS ====================== */}
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <div className="max-w-sm ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Subtotal</span>
              <span className="font-mono font-medium text-primary">
                {formatPeso(subtotal)}
              </span>
            </div>

            {/* Discount */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-surface-500">{discountLabel}</span>
                  {invoice.discountReason && (
                    <p className="text-xs text-surface-400">
                      {invoice.discountReason}
                    </p>
                  )}
                </div>
                <span className="font-mono font-medium text-danger-600">
                  -{formatPeso(discountAmount)}
                </span>
              </div>
            )}

            {/* Apply Discount button */}
            {canEdit && !showDiscount && (
              <div className="no-print">
                <button
                  onClick={() => setShowDiscount(true)}
                  className="text-xs text-accent-600 hover:text-accent-700 font-medium"
                >
                  {discountAmount > 0 ? "Change Discount" : "Apply Discount"}
                </button>
              </div>
            )}

            {/* Discount form */}
            {showDiscount && (
              <div className="no-print bg-surface-50 rounded-lg p-4 space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="discountType"
                      checked={discountForm.type === "flat"}
                      onChange={() =>
                        setDiscountForm({ ...discountForm, type: "flat" })
                      }
                      className="text-accent-600"
                    />
                    Flat Amount
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="discountType"
                      checked={discountForm.type === "percentage"}
                      onChange={() =>
                        setDiscountForm({ ...discountForm, type: "percentage" })
                      }
                      className="text-accent-600"
                    />
                    Percentage
                  </label>
                </div>
                <div>
                  <label className="text-xs text-surface-500">
                    {discountForm.type === "flat"
                      ? "Amount (Pesos)"
                      : "Percentage (%)"}
                  </label>
                  <input
                    type="number"
                    step={discountForm.type === "flat" ? "0.01" : "0.1"}
                    value={discountForm.value}
                    onChange={(e) =>
                      setDiscountForm({ ...discountForm, value: e.target.value })
                    }
                    className="w-full mt-1 rounded-lg border border-surface-300 px-3 py-1.5 text-sm"
                    placeholder={
                      discountForm.type === "flat" ? "0.00" : "0.0"
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-surface-500">Reason</label>
                  <textarea
                    value={discountForm.reason}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        reason: e.target.value,
                      })
                    }
                    className="w-full mt-1 rounded-lg border border-surface-300 px-3 py-1.5 text-sm"
                    rows={2}
                    placeholder="Reason for discount..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyDiscount}
                    disabled={
                      isPending || !discountForm.value || !discountForm.reason
                    }
                    className="bg-accent-600 hover:bg-accent-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {isPending ? "Applying..." : "Apply"}
                  </button>
                  <button
                    onClick={() => setShowDiscount(false)}
                    className="border border-surface-300 text-surface-600 hover:bg-surface-50 px-3 py-1.5 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* VAT */}
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">VATable Amount</span>
              <span className="font-mono font-medium text-primary">
                {formatPeso(invoice.vatableAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">VAT (12%)</span>
              <span className="font-mono font-medium text-primary">
                {formatPeso(invoice.vatAmount)}
              </span>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between pt-2 border-t border-surface-200">
              <span className="text-base font-bold text-primary">
                Grand Total
              </span>
              <span className="text-lg font-bold font-mono text-accent-600">
                {formatPeso(invoice.grandTotal)}
              </span>
            </div>

            {/* Insurance Split */}
            {job.isInsuranceJob && (
              <>
                <div className="flex justify-between text-sm pt-2 border-t border-surface-200">
                  <span className="text-surface-500">Insurance Pays</span>
                  <span className="font-mono font-medium text-primary">
                    {formatPeso(invoice.insurancePays)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Customer Copay</span>
                  <span className="font-mono font-medium text-primary">
                    {formatPeso(invoice.customerCopay)}
                  </span>
                </div>
              </>
            )}

            {/* Payment Summary */}
            {invoice.totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm pt-2 border-t border-surface-200">
                  <span className="text-surface-500">Total Paid</span>
                  <span className="font-mono font-medium text-success-600">
                    {formatPeso(invoice.totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500 font-medium">
                    Balance Due
                  </span>
                  <span className="font-mono font-bold text-danger-600">
                    {formatPeso(invoice.balanceDue)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ====================== VARIANCE (Analytics) ====================== */}
        {canViewAnalytics && (
          <div className="bg-surface-50 rounded-lg border border-surface-200 p-6">
            <h4 className="text-sm font-semibold text-primary mb-3">
              Cost Variance
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-surface-400">Estimated Total</p>
                <p className="text-sm font-mono font-medium text-primary">
                  {formatPeso(invoice.estimatedTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Actual Total</p>
                <p className="text-sm font-mono font-medium text-primary">
                  {formatPeso(invoice.actualTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Variance</p>
                {(() => {
                  const variance =
                    invoice.actualTotal - invoice.estimatedTotal;
                  const variancePercent =
                    invoice.estimatedTotal > 0
                      ? (variance / invoice.estimatedTotal) * 100
                      : 0;
                  const isOver = variance > 0;
                  return (
                    <p
                      className={cn(
                        "text-sm font-mono font-medium",
                        isOver ? "text-danger-600" : "text-success-600"
                      )}
                    >
                      {isOver ? "+" : ""}
                      {formatPeso(variance)} ({variancePercent.toFixed(1)}%)
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ====================== NOTES ====================== */}
        <div className="bg-white rounded-lg border border-surface-200 p-6">
          <h4 className="text-sm font-semibold text-primary mb-3">Notes</h4>
          {canEdit ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesChanged(true);
                }}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Invoice notes..."
              />
              {notesChanged && (
                <div className="no-print mt-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isPending}
                    className="bg-accent-600 hover:bg-accent-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {isPending ? "Saving..." : "Save Notes"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-surface-500">
              {invoice.notes || "No notes."}
            </p>
          )}
        </div>

        {/* ====================== ACTION BUTTONS ====================== */}
        <div className="no-print sticky bottom-0 bg-white border-t border-surface-200 -mx-6 px-6 py-4 md:relative md:mx-0 md:border-t-0 md:bg-transparent md:p-0">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (invoice.shareToken) {
                  window.open(`/view/invoice/${invoice.shareToken}`, '_blank');
                } else {
                  startTransition(async () => {
                    const result = await generateShareLinkAction(invoice.id, job.id);
                    if (result.success && result.data?.token) {
                      window.open(`/view/invoice/${result.data.token}`, '_blank');
                    } else {
                      setError(result.error ?? "Failed to generate print link");
                    }
                  });
                }
              }}
              disabled={isPending}
              className="flex items-center gap-2 border border-surface-300 text-surface-600 hover:bg-surface-50 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {isPending ? "Opening..." : "Print Invoice"}
            </button>

            <button
              onClick={handleShareLink}
              disabled={isPending}
              className="flex items-center gap-2 border border-surface-300 text-surface-600 hover:bg-surface-50 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              {isPending ? "Generating..." : "Share Link"}
            </button>
          </div>

          {/* Share URL */}
          {shareUrl && (
            <div className="mt-3 flex items-center gap-2 bg-surface-50 rounded-lg p-3">
              <Link className="h-4 w-4 text-surface-400 flex-shrink-0" />
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-transparent text-sm text-surface-600 border-none outline-none"
              />
              <button
                onClick={copyShareUrl}
                className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-medium flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      {canProcessPayment && invoice && invoice.paymentStatus !== "PAID" && (
        <PaymentForm
          invoiceId={invoice.id}
          jobOrderId={job.id}
          balanceDue={invoice.grandTotal - (invoice.totalPaid ?? 0)}
          onPaymentRecorded={() => router.refresh()}
        />
      )}

      {/* Payment History */}
      {invoice && payments.length > 0 && (
        <PaymentHistory
          payments={payments}
          invoiceGrandTotal={invoice.grandTotal}
          totalPaid={invoice.totalPaid ?? 0}
          balanceDue={invoice.grandTotal - (invoice.totalPaid ?? 0)}
          jobOrderId={job.id}
          canVoid={canProcessPayment}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupSection Sub-component
// ---------------------------------------------------------------------------

interface GroupSectionProps {
  group: string;
  label: string;
  items: LineItem[];
  groupSubtotal: number;
  canEdit: boolean;
  editingItemId: string | null;
  editForm: {
    description: string;
    quantity: string;
    unit: string;
    unitCost: string;
  };
  setEditForm: (form: {
    description: string;
    quantity: string;
    unit: string;
    unitCost: string;
  }) => void;
  onStartEdit: (item: LineItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  isPending: boolean;
  addingGroup: string | null;
  setAddingGroup: (group: string | null) => void;
  addForm: { description: string; quantity: string; unit: string; unitCost: string };
  setAddForm: (form: {
    description: string;
    quantity: string;
    unit: string;
    unitCost: string;
  }) => void;
  onAddItem: (group: string) => void;
}

function GroupSection({
  group,
  label,
  items,
  groupSubtotal,
  canEdit,
  editingItemId,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteItem,
  isPending,
  addingGroup,
  setAddingGroup,
  addForm,
  setAddForm,
  onAddItem,
}: GroupSectionProps) {
  return (
    <>
      {/* Group header */}
      <tr className="bg-surface-50">
        <td
          colSpan={canEdit ? 6 : 5}
          className="px-6 py-2 text-xs font-semibold text-surface-600 uppercase tracking-wide"
        >
          {label}
        </td>
      </tr>

      {/* Items */}
      {items.map((item) => (
        <tr key={item.id} className="hover:bg-surface-50">
          {editingItemId === item.id ? (
            <>
              <td className="px-6 py-2">
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full rounded border border-surface-300 px-2 py-1 text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.01"
                  value={editForm.quantity}
                  onChange={(e) =>
                    setEditForm({ ...editForm, quantity: e.target.value })
                  }
                  className="w-20 rounded border border-surface-300 px-2 py-1 text-sm text-right"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={editForm.unit}
                  onChange={(e) =>
                    setEditForm({ ...editForm, unit: e.target.value })
                  }
                  className="w-16 rounded border border-surface-300 px-2 py-1 text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.01"
                  value={editForm.unitCost}
                  onChange={(e) =>
                    setEditForm({ ...editForm, unitCost: e.target.value })
                  }
                  className="w-24 rounded border border-surface-300 px-2 py-1 text-sm text-right"
                />
              </td>
              <td className="px-6 py-2 text-right text-sm font-medium text-surface-400">
                --
              </td>
              <td className="no-print px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onSaveEdit(item.id)}
                    disabled={isPending}
                    className="p-1 text-success-600 hover:text-success-700"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="p-1 text-surface-400 hover:text-surface-600"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </>
          ) : (
            <>
              <td className="px-6 py-2 text-sm text-primary">
                {item.description}
              </td>
              <td className="px-3 py-2 text-sm font-mono text-right text-primary">
                {item.quantity}
              </td>
              <td className="px-3 py-2 text-sm text-surface-500">
                {item.unit}
              </td>
              <td className="px-3 py-2 text-sm font-mono text-right text-primary">
                {formatPeso(item.unitCost)}
              </td>
              <td className="px-6 py-2 text-sm font-mono text-right font-medium text-primary">
                {formatPeso(item.subtotal)}
              </td>
              {canEdit && (
                <td className="no-print px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onStartEdit(item)}
                      className="p-1 text-surface-400 hover:text-accent-600"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1 text-surface-400 hover:text-danger-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </>
          )}
        </tr>
      ))}

      {/* Add item row */}
      {addingGroup === group && (
        <tr className="bg-accent-50/30">
          <td className="px-6 py-2">
            <input
              type="text"
              value={addForm.description}
              onChange={(e) =>
                setAddForm({ ...addForm, description: e.target.value })
              }
              className="w-full rounded border border-surface-300 px-2 py-1 text-sm"
              placeholder="Description"
              autoFocus
            />
          </td>
          <td className="px-3 py-2">
            <input
              type="number"
              step="0.01"
              value={addForm.quantity}
              onChange={(e) =>
                setAddForm({ ...addForm, quantity: e.target.value })
              }
              className="w-20 rounded border border-surface-300 px-2 py-1 text-sm text-right"
            />
          </td>
          <td className="px-3 py-2">
            <input
              type="text"
              value={addForm.unit}
              onChange={(e) =>
                setAddForm({ ...addForm, unit: e.target.value })
              }
              className="w-16 rounded border border-surface-300 px-2 py-1 text-sm"
            />
          </td>
          <td className="px-3 py-2">
            <input
              type="number"
              step="0.01"
              value={addForm.unitCost}
              onChange={(e) =>
                setAddForm({ ...addForm, unitCost: e.target.value })
              }
              className="w-24 rounded border border-surface-300 px-2 py-1 text-sm text-right"
              placeholder="0.00"
            />
          </td>
          <td className="px-6 py-2 text-right text-sm text-surface-400">--</td>
          <td className="no-print px-3 py-2 text-right">
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => onAddItem(group)}
                disabled={isPending || !addForm.description || !addForm.unitCost}
                className="p-1 text-success-600 hover:text-success-700 disabled:opacity-50"
                title="Add"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAddingGroup(null)}
                className="p-1 text-surface-400 hover:text-surface-600"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      )}

      {/* Group subtotal */}
      {items.length > 0 && (
        <tr className="bg-surface-50/50">
          <td
            colSpan={canEdit ? 4 : 4}
            className="px-6 py-2 text-xs text-right font-medium text-surface-500"
          >
            {label} Subtotal
          </td>
          <td className="px-6 py-2 text-sm font-mono text-right font-semibold text-primary">
            {formatPeso(groupSubtotal)}
          </td>
          {canEdit && <td className="no-print px-3 py-2" />}
        </tr>
      )}
    </>
  );
}
