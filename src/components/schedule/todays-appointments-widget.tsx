"use client";

import { useRouter } from "next/navigation";
import { APPOINTMENT_TYPE_COLORS } from "@/types/enums";

interface AppointmentItem {
  id: string;
  type: string;
  scheduledTime: string;
  status: string;
  customer: { firstName: string; lastName: string };
  vehicle?: { plateNumber: string; make: string; model: string } | null;
}

const DOT_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  surface: "bg-surface-400",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function TodaysAppointmentsWidget({
  appointments,
}: {
  appointments: AppointmentItem[];
}) {
  const router = useRouter();
  const displayItems = appointments.slice(0, 5);
  const hasMore = appointments.length > 5;

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary">
          Today&apos;s Appointments
        </h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
          {appointments.length}
        </span>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-surface-400">No appointments today.</p>
      ) : (
        <div className="space-y-3">
          {displayItems.map((appt) => {
            const colorName =
              APPOINTMENT_TYPE_COLORS[
                appt.type as keyof typeof APPOINTMENT_TYPE_COLORS
              ] ?? "surface";
            const dotClass = DOT_COLOR_MAP[colorName] ?? "bg-surface-400";

            return (
              <div
                key={appt.id}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}
                />
                <span className="text-surface-500 font-mono text-xs w-[72px] flex-shrink-0">
                  {formatTime(appt.scheduledTime)}
                </span>
                <span className="text-primary font-medium truncate">
                  {appt.customer.lastName}
                </span>
                {appt.vehicle && (
                  <span className="text-surface-400 text-xs truncate">
                    {appt.vehicle.plateNumber}
                  </span>
                )}
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={() => router.push("/schedule/appointments")}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors mt-1"
            >
              View all &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
