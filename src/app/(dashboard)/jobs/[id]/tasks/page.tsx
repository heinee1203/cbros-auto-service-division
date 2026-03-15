import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTasksByJobOrder } from "@/lib/services/tasks";
import { getActiveEntry } from "@/lib/services/time-entries";

const TaskBoardClient = dynamic(
  () => import("@/components/jobs/task-board"),
  { ssr: false, loading: () => <div className="h-96 bg-surface-200 animate-pulse rounded-lg" /> }
);

export default async function JobTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;

  const [tasks, technicians, overrunSettings, activeEntry] = await Promise.all([
    getTasksByJobOrder(id),
    prisma.user.findMany({
      where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
    Promise.all([
      prisma.setting.findUnique({ where: { key: "hour_overrun_warning_pct" } }),
      prisma.setting.findUnique({
        where: { key: "hour_overrun_critical_pct" },
      }),
    ]),
    session?.user ? getActiveEntry(session.user.id) : null,
  ]);

  return (
    <TaskBoardClient
      tasks={JSON.parse(JSON.stringify(tasks))}
      jobOrderId={id}
      technicians={technicians}
      overrunSettings={{
        warningPct: parseInt(overrunSettings[0]?.value || "80"),
        criticalPct: parseInt(overrunSettings[1]?.value || "100"),
      }}
      activeClockEntry={
        activeEntry
          ? JSON.parse(JSON.stringify(activeEntry))
          : null
      }
      currentUserId={session?.user?.id}
    />
  );
}
