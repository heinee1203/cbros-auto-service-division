"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarAppointment,
  CalendarView,
  CalendarFilters,
  getMonthRange,
  getWeekRange,
  getDayRange,
} from "./calendar-types";
import { CalendarHeader } from "./calendar-header";
import MonthView from "./month-view";
import WeekView from "./week-view";
import DayView from "./day-view";
import ListView from "./list-view";
import { AppointmentForm } from "./appointment-form";
import { AppointmentDetail } from "./appointment-detail";

interface AppointmentsCalendarProps {
  canManage: boolean;
}

export default function AppointmentsCalendar({ canManage }: AppointmentsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form slide-over state
  const [formOpen, setFormOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState<CalendarAppointment | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>();

  // Detail slide-over state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      let range: { start: Date; end: Date };
      switch (view) {
        case "month":
        case "list":
          range = getMonthRange(currentDate);
          break;
        case "week":
          range = getWeekRange(currentDate);
          break;
        case "day":
          range = getDayRange(currentDate);
          break;
      }

      const params = new URLSearchParams({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      });
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("type", filters.type);

      const res = await fetch(`/api/appointments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, view, filters]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // ── Event handlers ─────────────────────────────────────────────────────

  const handleNewAppointment = () => {
    setEditAppointment(null);
    setFormDefaultDate(undefined);
    setFormOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleAppointmentClick = (appointment: CalendarAppointment) => {
    setSelectedAppointment(appointment);
    setDetailOpen(true);
  };

  const handleSaved = () => {
    fetchAppointments();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
        onNewAppointment={handleNewAppointment}
        canManage={canManage}
      />

      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          onDateClick={handleDateClick}
          onAppointmentClick={handleAppointmentClick}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
        />
      )}
      {view === "list" && (
        <ListView
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
          isLoading={isLoading}
        />
      )}

      {canManage && (
        <AppointmentForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          appointment={editAppointment}
          defaultDate={formDefaultDate}
          onSaved={handleSaved}
        />
      )}

      <AppointmentDetail
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onUpdated={handleSaved}
      />
    </div>
  );
}
