"use client";

import { useState, useEffect, useCallback } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { LiveFloorGrid } from "./live-floor-grid";
import { LiveFloorStatsBar } from "./live-floor-stats";
import { FloorJobSection } from "./floor-job-section";
import { BayAssignmentDetail } from "./bay-assignment-detail";
import { BayAssignModal } from "./bay-assign-modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { LiveFloorBay, LiveFloorStats, LiveFloorJob } from "./live-floor-types";

export default function LiveFloor() {
  const [bays, setBays] = useState<LiveFloorBay[]>([]);
  const [stats, setStats] = useState<LiveFloorStats>({ queueLength: 0, activeServices: 0, availableTechs: 0, totalTechs: 0 });
  const [jobs, setJobs] = useState<LiveFloorJob[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBay, setSelectedBay] = useState<LiveFloorBay | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bays/live-floor");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setBays(data.bays);
      setStats(data.stats);
      setJobs(data.activeJobs);
    } catch {
      toast.error("Failed to load floor data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBayClick = (bay: LiveFloorBay) => {
    setSelectedBay(bay);
    if (bay.assignments.length > 0) {
      setDetailOpen(true);
    } else {
      setAssignOpen(true);
    }
  };

  const handleUpdated = () => {
    setDetailOpen(false);
    setAssignOpen(false);
    setSelectedBay(null);
    fetchData();
  };

  // Map LiveFloor assignment to TimelineAssignment shape for BayAssignmentDetail
  const activeAssignment = selectedBay?.assignments[0];
  const mappedAssignment = activeAssignment ? {
    id: activeAssignment.id,
    bayId: selectedBay!.id,
    jobOrderId: activeAssignment.jobOrder.id,
    startDate: activeAssignment.startDate,
    endDate: null as string | null,
    notes: null as string | null,
    jobOrder: {
      id: activeAssignment.jobOrder.id,
      jobOrderNumber: activeAssignment.jobOrder.jobOrderNumber,
      status: activeAssignment.jobOrder.status,
      priority: activeAssignment.jobOrder.priority,
      customer: {
        firstName: activeAssignment.jobOrder.customer.firstName,
        lastName: activeAssignment.jobOrder.customer.lastName,
      },
      vehicle: activeAssignment.jobOrder.vehicle ? {
        plateNumber: activeAssignment.jobOrder.vehicle.plateNumber,
        make: activeAssignment.jobOrder.vehicle.make,
        model: activeAssignment.jobOrder.vehicle.model,
        color: activeAssignment.jobOrder.vehicle.color || "",
      } : null,
      primaryTechnician: activeAssignment.jobOrder.primaryTechnician ? {
        firstName: activeAssignment.jobOrder.primaryTechnician.firstName,
        lastName: activeAssignment.jobOrder.primaryTechnician.lastName,
      } : null,
    },
  } : null;

  return (
    <div className="space-y-6">
      <LiveFloorStatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          Loading floor status...
        </div>
      ) : bays.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Bays"
          description="Create bays in Settings to start scheduling."
        />
      ) : (
        <LiveFloorGrid bays={bays} onBayClick={handleBayClick} />
      )}

      {!loading && jobs.length > 0 && <FloorJobSection jobs={jobs} />}

      <BayAssignmentDetail
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedBay(null);
        }}
        assignment={mappedAssignment}
        bayName={selectedBay?.name || ""}
        bayColor={selectedBay?.color || "#6B7280"}
        allBays={bays.map((b) => ({ id: b.id, name: b.name }))}
        onUpdated={handleUpdated}
      />

      <BayAssignModal
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false);
          setSelectedBay(null);
        }}
        prefilledBayId={selectedBay?.id}
        allBays={bays.map((b) => ({ id: b.id, name: b.name }))}
        onAssigned={handleUpdated}
      />
    </div>
  );
}
