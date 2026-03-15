# Shop Scheduler Module — Design Document

## Goal

Integrate job/appointment scheduling, bay/stall management, and technician work scheduling into AutoServ Pro as a native module. Replaces the standalone cbros-auto scheduler app (React + Vite + Firebase) with a unified experience built on the existing data model.

## Architecture

Custom CSS Grid + date-fns + HTML5 native Drag-and-Drop API. Zero new dependencies. Desktop gets drag-and-drop interactions; tablet/mobile gets dropdown-based reassignment (Option 3 — pragmatic touch handling). All data via Prisma/SQLite, server actions for mutations, API routes for data fetching.

## Phased Build Order

- **Phase A: Foundation** — Schema, seed, enums, permissions, service layer, bay CRUD in settings, sidebar nav
- **Phase B: Appointments** — Calendar views (month/week/day/list), create/edit appointment form, today's appointments dashboard widget
- **Phase C: Bay Schedule** — Gantt timeline (Y=bays, X=days), bay occupancy indicators, drag-to-reschedule (desktop), dropdown reassignment (mobile), auto-assignment suggestions
- **Phase D: Tech Schedule + Integrations** — Tech timeline, capacity indicators, drag task reassignment, integration points (estimate→schedule, appointment→intake, intake→bay, release→bay release, dashboard widget, analytics capacity)

## Schema Additions

### New: Bay
```prisma
model Bay {
  id          String    @id @default(cuid())
  name        String
  type        String    // BayType enum
  capacity    Int       @default(1)
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  notes       String?
  color       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  assignments BayAssignment[]
}
```

### New: BayAssignment
```prisma
model BayAssignment {
  id          String    @id @default(cuid())
  bayId       String
  jobOrderId  String
  startDate   DateTime
  endDate     DateTime?
  notes       String?
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  bay         Bay       @relation(fields: [bayId], references: [id])
  jobOrder    JobOrder  @relation(fields: [jobOrderId], references: [id])
  createdByUser User    @relation(fields: [createdBy], references: [id])
  @@index([bayId, startDate])
  @@index([jobOrderId])
}
```

### New: Appointment
```prisma
model Appointment {
  id              String    @id @default(cuid())
  customerId      String
  vehicleId       String?
  estimateId      String?
  type            String    // AppointmentType enum
  scheduledDate   DateTime
  scheduledTime   String
  duration        Int       @default(60)
  status          String    // AppointmentStatus enum
  notes           String?
  reminderSent    Boolean   @default(false)
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  customer        Customer  @relation(fields: [customerId], references: [id])
  vehicle         Vehicle?  @relation(fields: [vehicleId], references: [id])
  estimate        EstimateRequest? @relation(fields: [estimateId], references: [id])
  createdByUser   User      @relation(fields: [createdBy], references: [id])
  @@index([scheduledDate])
  @@index([customerId])
  @@index([status])
}
```

### Extend: JobOrder
```
scheduledStartDate  DateTime?
scheduledEndDate    DateTime?
assignedBayId       String?
bayAssignments      BayAssignment[]
```

### Extend: User
```
workSchedule        String?   // JSON: {"mon": {"start": "08:00", "end": "17:00"}, ...}
maxConcurrentJobs   Int       @default(2)
bayAssignments      BayAssignment[]
appointments        Appointment[]
```

## Enums (src/types/enums.ts)

- `BayType`: GENERAL, PAINT_BOOTH, DETAIL, PDR, MECHANICAL, WASH
- `AppointmentType`: ESTIMATE_INSPECTION, DROP_OFF, PICK_UP, FOLLOW_UP, CONSULTATION
- `AppointmentStatus`: SCHEDULED, CONFIRMED, ARRIVED, NO_SHOW, CANCELLED, COMPLETED

## Service Layer

### src/lib/services/scheduler.ts
**Appointments:** createAppointment, getAppointments(dateRange, filters), updateAppointment, cancelAppointment, getAppointmentsByDate, convertToEstimate
**Bays:** getBays, createBay, updateBay, deleteBay, assignJobToBay, releaseFromBay, getBayTimeline(dateRange), getBayAvailability, getConflicts
**Technicians:** getTechnicianSchedule, getTechnicianAvailability, getAllTechSchedules, getShopCapacity

### src/lib/actions/scheduler-actions.ts
Server actions wrapping all service functions with auth + Zod validation.

## UI Routes

- `/schedule/appointments` — Calendar with month/week/day/list toggle
- `/schedule/bays` — Gantt-style timeline
- `/schedule/technicians` — Technician schedule timeline

## Components

- `src/components/schedule/calendar-month.tsx` — Month grid with appointment dots
- `src/components/schedule/calendar-week.tsx` — 7-column hourly grid
- `src/components/schedule/calendar-day.tsx` — Single day hourly detail
- `src/components/schedule/calendar-list.tsx` — Table of upcoming appointments
- `src/components/schedule/appointment-form.tsx` — Create/edit slide-over
- `src/components/schedule/bay-timeline.tsx` — Gantt chart (CSS Grid)
- `src/components/schedule/tech-timeline.tsx` — Technician timeline
- `src/components/schedule/bay-management.tsx` — Settings: bay CRUD
- `src/components/schedule/today-appointments.tsx` — Dashboard widget

## Navigation

Sidebar: Schedule (calendar icon) between Jobs and Estimates, with sub-items: Appointments, Bay Schedule, Tech Schedule.

## Permissions

| Action | Roles |
|--------|-------|
| View schedule | OWNER, MANAGER, ADVISOR |
| Create/edit appointments | OWNER, MANAGER, ADVISOR |
| Manage bays (CRUD) | OWNER, MANAGER |
| Assign jobs to bays | OWNER, MANAGER, ADVISOR |
| View tech schedule | OWNER, MANAGER |
| Reassign tasks between techs | OWNER, MANAGER |
| Edit tech work schedules | OWNER, MANAGER |

## Drag-and-Drop Strategy

- Desktop: HTML5 native API (dragstart/dragover/drop)
- Mobile/tablet: Dropdown-based "Move to Bay" / "Reassign Tech" interactions
- Same backend mutations, different UI interaction per device

## Seed Data

6 default bays: Bay 1 (GENERAL, blue), Bay 2 (GENERAL, green), Bay 3 (GENERAL, amber), Paint Booth (PAINT_BOOTH, red), Detail Bay (DETAIL, purple), PDR Station (PDR, pink).

## YAGNI — Not Building

- No Firebase/real-time push (standard Next.js revalidation)
- No TV queue display
- No EOD close-out report (existing analytics suffice)
- No idle lock screen (NextAuth handles sessions)

## Integration Points

1. Estimate approved → "Schedule Drop-Off" button → creates Appointment
2. Appointment ARRIVED → "Begin Intake" button → launches intake wizard
3. Intake/start work → prompt bay assignment with suggestion
4. Task assignment on Kanban → auto-appears on tech schedule
5. Vehicle released → auto-release from bay
6. Dashboard → today's appointments widget
7. Analytics → capacity uses real bay count + tech work schedules
