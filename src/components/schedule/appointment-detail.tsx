"use client";

import { useState } from "react";
import { SlideOver } from "@/components/ui/slide-over";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  updateAppointmentStatusAction,
  cancelAppointmentAction,
} from "@/lib/actions/scheduler-actions";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_TYPE_COLORS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
} from "@/types/enums";
import { formatDate } from "@/lib/utils";
import { formatTimeSlot, getBadgeVariant } from "./calendar-types";
import type { CalendarAppointment } from "./calendar-types";
import { AppointmentForm } from "./appointment-form";
import { toast } from "sonner";
import {
  Phone,
  Car,
  Calendar,
  FileText,
  User,
  Pencil,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";

// ── Props ──────────────────────────────────────────────────────────────────
interface AppointmentDetailProps {
  open: boolean;
  onClose: () => void;
  appointment: CalendarAppointment | null;
  onUpdated: () => void;
}

export function AppointmentDetail({
  open,
  onClose,
  appointment,
  onUpdated,
}: AppointmentDetailProps) {
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  if (!appointment) return null;

  const { customer, vehicle, estimate, createdByUser } = appointment;

  // ── Status change handler ──────────────────────────────────────────────
  const handleStatusChange = async (newStatus: string) => {
    if (!appointment) return;
    setUpdating(true);
    const result = await updateAppointmentStatusAction(appointment.id, {
      status: newStatus,
    });
    if (result.success) {
      toast.success(
        `Appointment ${newStatus.toLowerCase().replace("_", " ")}`
      );
      onUpdated();
      onClose();
    } else {
      toast.error(result.error || "Failed to update");
    }
    setUpdating(false);
  };

  // ── Cancel handler ─────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!appointment) return;
    setCancelling(true);
    const result = await cancelAppointmentAction(
      appointment.id,
      cancelReason
    );
    if (result.success) {
      toast.success("Appointment cancelled");
      onUpdated();
      onClose();
    } else {
      toast.error(result.error || "Failed to cancel");
    }
    setCancelling(false);
    setCancelDialogOpen(false);
    setCancelReason("");
  };

  // ── Edit / Reschedule ──────────────────────────────────────────────────
  const handleOpenEdit = () => {
    setEditOpen(true);
  };

  const handleEditSaved = () => {
    setEditOpen(false);
    onUpdated();
    onClose();
  };

  // ── Status-dependent action buttons ────────────────────────────────────
  const renderActions = () => {
    const status = appointment.status;

    const editBtn = (
      <button
        key="edit"
        onClick={handleOpenEdit}
        disabled={updating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-white/10 text-slate-300 hover:bg-white/5 rounded-xl disabled:opacity-50"
      >
        <Pencil className="w-4 h-4" />
        Edit
      </button>
    );

    const rescheduleBtn = (
      <button
        key="reschedule"
        onClick={handleOpenEdit}
        disabled={updating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-white/10 text-slate-300 hover:bg-white/5 rounded-xl disabled:opacity-50"
      >
        <Calendar className="w-4 h-4" />
        Reschedule
      </button>
    );

    const cancelBtn = (
      <button
        key="cancel"
        onClick={() => setCancelDialogOpen(true)}
        disabled={updating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl disabled:opacity-50"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
    );

    switch (status) {
      case "SCHEDULED":
        return (
          <div className="flex flex-col gap-2">
            {editBtn}
            <button
              onClick={() => handleStatusChange("CONFIRMED")}
              disabled={updating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Confirm
            </button>
            {cancelBtn}
          </div>
        );
      case "CONFIRMED":
        return (
          <div className="flex flex-col gap-2">
            {editBtn}
            <button
              onClick={() => handleStatusChange("ARRIVED")}
              disabled={updating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Mark Arrived
            </button>
            {cancelBtn}
          </div>
        );
      case "ARRIVED":
        return (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleStatusChange("COMPLETED")}
              disabled={updating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Mark Completed
            </button>
          </div>
        );
      case "NO_SHOW":
      case "CANCELLED":
        return <div className="flex flex-col gap-2">{rescheduleBtn}</div>;
      case "COMPLETED":
      default:
        return null;
    }
  };

  // ── Icon row helper ────────────────────────────────────────────────────
  const iconClass = "w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0";

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={`${customer.firstName} ${customer.lastName}`}
        footer={renderActions()}
      >
        <div className="space-y-4" style={{ background: '#0F1729', margin: '-24px', padding: '24px' }}>
          {/* Header badges */}
          <div className="flex items-center gap-2">
            <Badge
              variant={getBadgeVariant(
                APPOINTMENT_TYPE_COLORS[
                  appointment.type as keyof typeof APPOINTMENT_TYPE_COLORS
                ] || "surface"
              )}
            >
              {APPOINTMENT_TYPE_LABELS[
                appointment.type as keyof typeof APPOINTMENT_TYPE_LABELS
              ] || appointment.type}
            </Badge>
            <Badge
              variant={getBadgeVariant(
                APPOINTMENT_STATUS_COLORS[
                  appointment.status as keyof typeof APPOINTMENT_STATUS_COLORS
                ] || "surface"
              )}
            >
              {APPOINTMENT_STATUS_LABELS[
                appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
              ] || appointment.status}
            </Badge>
          </div>

          {/* Customer */}
          <div className="flex items-start gap-3">
            <Phone className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Customer</p>
              <a
                href={`tel:${customer.phone}`}
                className="text-sm text-accent-600 hover:underline"
              >
                {customer.phone}
              </a>
              {customer.company && (
                <p className="text-sm text-white">{customer.company}</p>
              )}
            </div>
          </div>

          {/* Vehicle */}
          <div className="flex items-start gap-3">
            <Car className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Vehicle</p>
              {vehicle ? (
                <>
                  <p className="text-sm text-white">
                    {vehicle.make} {vehicle.model}
                    {vehicle.year ? ` (${vehicle.year})` : ""}
                  </p>
                  <p className="text-sm text-white">{vehicle.plateNumber}</p>
                  <p className="text-sm text-white">{vehicle.color}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No vehicle</p>
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="flex items-start gap-3">
            <Calendar className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Schedule</p>
              <p className="text-sm text-white">
                {formatDate(appointment.scheduledDate)}
              </p>
              <p className="text-sm text-white">
                {formatTimeSlot(appointment.scheduledTime)}
              </p>
              <p className="text-sm text-white">
                {appointment.duration} min
              </p>
            </div>
          </div>

          {/* Linked Estimate */}
          {estimate && (
            <div className="flex items-start gap-3">
              <FileText className={iconClass} />
              <div>
                <p className="text-xs text-slate-400">Linked Estimate</p>
                <a
                  href={`/estimates/${estimate.id}`}
                  className="text-sm text-accent-600 hover:underline"
                >
                  {estimate.requestNumber}
                </a>
              </div>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="flex items-start gap-3">
              <AlertTriangle className={iconClass} />
              <div>
                <p className="text-xs text-slate-400">Notes</p>
                <p className="text-sm text-white">{appointment.notes}</p>
              </div>
            </div>
          )}

          {/* Created by */}
          <div className="flex items-start gap-3">
            <User className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Created by</p>
              <p className="text-sm text-white">
                {createdByUser.firstName} {createdByUser.lastName}
              </p>
              <p className="text-sm text-white">
                {formatDate(appointment.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </SlideOver>

      {/* Cancel confirm dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setCancelReason("");
        }}
        onConfirm={handleCancel}
        title="Cancel Appointment"
        message={
          <div className="space-y-3">
            <p>Are you sure you want to cancel this appointment?</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-white/20 rounded-lg text-sm text-white bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            />
          </div>
        }
        confirmLabel="Cancel Appointment"
        variant="danger"
        loading={cancelling}
      />

      {/* Edit / Reschedule form */}
      <AppointmentForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        appointment={appointment}
        onSaved={handleEditSaved}
      />
    </>
  );
}
