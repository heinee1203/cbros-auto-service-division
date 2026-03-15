"use client";

import {
  CalendarAppointment,
  groupByDate,
  formatTimeSlot,
} from "./calendar-types";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_TYPE_COLORS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  type AppointmentType,
  type AppointmentStatus,
} from "@/types/enums";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ListViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  isLoading: boolean;
}

// Map color names from enums to Badge variant names
const COLOR_TO_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "accent" | "outline"> = {
  blue: "accent",
  green: "success",
  amber: "warning",
  purple: "accent",
  surface: "default",
  red: "danger",
};

function toBadgeVariant(color: string): "default" | "success" | "warning" | "danger" | "accent" | "outline" {
  return COLOR_TO_VARIANT[color] || "default";
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { weekday: "long" });
}

export default function ListView({
  currentDate,
  appointments,
  onAppointmentClick,
  isLoading,
}: ListViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-surface-400">
        Loading appointments...
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No Appointments"
        description="No appointments found in this period."
      />
    );
  }

  const grouped = groupByDate(appointments);
  const sortedKeys = Array.from(grouped.keys()).sort();

  return (
    <div className="divide-y divide-surface-200">
      {sortedKeys.map((dateKey) => {
        const dayAppointments = grouped.get(dateKey)!;
        const dayOfWeek = getDayOfWeek(dateKey);

        return (
          <div key={dateKey}>
            {/* Sticky date header */}
            <div className="sticky top-0 bg-surface-50 px-4 py-2 text-sm font-semibold text-primary border-b border-surface-200">
              {formatDate(dateKey)} &middot; {dayOfWeek} &middot;{" "}
              {dayAppointments.length} appointment
              {dayAppointments.length !== 1 ? "s" : ""}
            </div>

            {/* Appointment rows */}
            {dayAppointments.map((appt) => {
              const typeColor =
                APPOINTMENT_TYPE_COLORS[appt.type as AppointmentType] || "surface";
              const statusColor =
                APPOINTMENT_STATUS_COLORS[appt.status as AppointmentStatus] || "surface";

              const vehicle = appt.vehicle
                ? `${appt.vehicle.make} ${appt.vehicle.model} · ${appt.vehicle.plateNumber}`
                : "";

              return (
                <div
                  key={appt.id}
                  onClick={() => onAppointmentClick(appt)}
                  className="px-4 py-3 hover:bg-surface-50 cursor-pointer border-b border-surface-100 flex items-center gap-4"
                >
                  {/* Time */}
                  <span className="text-sm font-mono text-surface-500 w-20 flex-shrink-0">
                    {formatTimeSlot(appt.scheduledTime)}
                  </span>

                  {/* Type badge */}
                  <Badge variant={toBadgeVariant(typeColor)}>
                    {APPOINTMENT_TYPE_LABELS[appt.type as AppointmentType] || appt.type}
                  </Badge>

                  {/* Customer name */}
                  <span className="text-sm font-medium text-primary flex-1 min-w-0 truncate">
                    {appt.customer.firstName} {appt.customer.lastName}
                  </span>

                  {/* Vehicle */}
                  {vehicle && (
                    <span className="text-sm text-surface-400 hidden sm:block">
                      {vehicle}
                    </span>
                  )}

                  {/* Status badge */}
                  <Badge variant={toBadgeVariant(statusColor)}>
                    {APPOINTMENT_STATUS_LABELS[appt.status as AppointmentStatus] || appt.status}
                  </Badge>

                  {/* Duration */}
                  <span className="text-xs text-surface-400 w-16 text-right">
                    {appt.duration} min
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
