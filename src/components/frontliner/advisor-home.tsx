"use client";

import Link from "next/link";
import {
  JOB_ORDER_STATUS_LABELS,
  JOB_ORDER_STATUS_COLORS,
  APPOINTMENT_TYPE_LABELS,
} from "@/types/enums";
import type { JobOrderStatus, AppointmentType } from "@/types/enums";

interface Appointment {
  id: string;
  scheduledTime: Date | string;
  customer: { firstName: string; lastName: string };
  vehicle: { plateNumber: string; make: string; model: string };
  serviceType: string | null;
}

interface ActiveJob {
  id: string;
  jobOrderNumber: string;
  status: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
  };
  primaryTechnician: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  bayAssignments: Array<{ bay: { name: string } }>;
}

interface AdvisorHomeProps {
  firstName: string;
  appointments: Appointment[];
  activeJobs: ActiveJob[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function AdvisorHome({
  firstName,
  appointments,
  activeJobs,
}: AdvisorHomeProps) {
  const readyForPickup = activeJobs.filter((j) => j.status === "FULLY_PAID");
  const displayJobs = activeJobs.slice(0, 6);

  return (
    <div className="space-y-6 p-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-[var(--sch-text)]">
        {getGreeting()}, {firstName} {"👋"}
      </h1>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          href="/frontliner/intake"
          className="flex h-12 min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--sch-accent)] font-semibold text-black transition-colors hover:opacity-90"
        >
          New Intake
        </Link>
        <Link
          href="/frontliner/intake?level=L1"
          className="flex h-12 min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[var(--sch-border)] font-semibold text-[var(--sch-text)] transition-colors hover:bg-[var(--sch-surface)]"
        >
          Quick Job
        </Link>
      </div>

      {/* Today's Appointments */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[var(--sch-text)]">
          Today&apos;s Appointments
        </h2>
        {appointments.length === 0 ? (
          <div className="rounded-xl bg-[var(--sch-card)] p-6 text-center text-[var(--sch-text-muted)]">
            No appointments today
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => {
              const time =
                typeof appt.scheduledTime === "string"
                  ? appt.scheduledTime
                  : appt.scheduledTime instanceof Date
                    ? appt.scheduledTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
              const typeLabel = appt.serviceType
                ? APPOINTMENT_TYPE_LABELS[appt.serviceType as AppointmentType] ||
                  appt.serviceType
                : null;

              return (
                <div
                  key={appt.id}
                  className="rounded-xl bg-[var(--sch-card)] p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-[var(--sch-accent)]">
                        {time}
                      </p>
                      <p className="mt-1 font-semibold text-[var(--sch-text)]">
                        {appt.customer.firstName} {appt.customer.lastName}
                      </p>
                      <p className="font-mono text-sm text-[var(--sch-text-muted)]">
                        {appt.vehicle.plateNumber}
                        {appt.vehicle.make && (
                          <span className="ml-2 font-sans">
                            {appt.vehicle.make} {appt.vehicle.model}
                          </span>
                        )}
                      </p>
                      {typeLabel && (
                        <p className="mt-1 text-xs text-[var(--sch-text-muted)]">
                          {typeLabel}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/frontliner/intake?appointmentId=${appt.id}`}
                      className="ml-3 flex h-10 min-h-[48px] items-center whitespace-nowrap text-sm font-medium text-[var(--sch-accent)]"
                    >
                      Begin Intake &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Jobs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--sch-text)]">
            Active Jobs
          </h2>
          {activeJobs.length > 6 && (
            <Link
              href="/frontliner/jobs"
              className="text-sm font-medium text-[var(--sch-accent)]"
            >
              View all &rarr;
            </Link>
          )}
        </div>
        {activeJobs.length === 0 ? (
          <div className="rounded-xl bg-[var(--sch-card)] p-6 text-center text-[var(--sch-text-muted)]">
            No active jobs
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {displayJobs.map((job) => {
              const statusLabel =
                JOB_ORDER_STATUS_LABELS[job.status as JobOrderStatus] ||
                job.status;
              const statusColor =
                JOB_ORDER_STATUS_COLORS[job.status as JobOrderStatus] || "";
              const bayName =
                job.bayAssignments.length > 0
                  ? job.bayAssignments[0].bay.name
                  : null;

              return (
                <Link
                  key={job.id}
                  href={`/frontliner/jobs/${job.id}`}
                  className="block min-w-[260px] flex-shrink-0 rounded-xl bg-[var(--sch-card)] p-4 transition-colors hover:bg-[var(--sch-surface)]"
                >
                  <p className="font-mono text-lg font-bold text-[var(--sch-text)]">
                    {job.vehicle.plateNumber}
                  </p>
                  <p className="text-sm text-[var(--sch-text-muted)]">
                    {job.vehicle.make} {job.vehicle.model}
                  </p>
                  <div className="mt-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--sch-text-muted)]">
                    {bayName && <span>{bayName}</span>}
                    {bayName && job.primaryTechnician && (
                      <span>&middot;</span>
                    )}
                    {job.primaryTechnician && (
                      <span>
                        {job.primaryTechnician.firstName}{" "}
                        {job.primaryTechnician.lastName}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Ready for Pickup */}
      {readyForPickup.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-[var(--sch-text)]">
            Ready for Pickup
          </h2>
          <div className="space-y-3">
            {readyForPickup.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-xl bg-[var(--sch-card)] p-4"
              >
                <div>
                  <p className="font-mono text-lg font-bold text-[var(--sch-text)]">
                    {job.vehicle.plateNumber}
                  </p>
                  <p className="text-sm text-[var(--sch-text-muted)]">
                    {job.customer.firstName} {job.customer.lastName}
                  </p>
                </div>
                <Link
                  href={`/frontliner/release/${job.id}`}
                  className="flex h-10 min-h-[48px] items-center rounded-lg bg-[var(--sch-accent)] px-4 font-semibold text-black transition-colors hover:opacity-90"
                >
                  Release &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
