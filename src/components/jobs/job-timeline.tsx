"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  PlayCircle,
  StopCircle,
  Coffee,
  Camera,
  MessageSquare,
  Package,
  FileText,
  CheckCircle2,
  UserCheck,
  ClipboardCheck,
  Activity,
  Loader2,
} from "lucide-react";

interface TimelineActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

interface JobTimelineProps {
  jobOrderId: string;
  initialActivities?: TimelineActivity[];
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

const ACTIVITY_ICON_MAP: Record<
  string,
  { icon: typeof Activity; colorClass: string; bgClass: string }
> = {
  status_change: {
    icon: ArrowRight,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-100",
  },
  clock_in: {
    icon: PlayCircle,
    colorClass: "text-green-600",
    bgClass: "bg-green-100",
  },
  clock_out: {
    icon: StopCircle,
    colorClass: "text-red-600",
    bgClass: "bg-red-100",
  },
  break_start: {
    icon: Coffee,
    colorClass: "text-amber-600",
    bgClass: "bg-amber-100",
  },
  break_end: {
    icon: PlayCircle,
    colorClass: "text-green-600",
    bgClass: "bg-green-100",
  },
  photo_upload: {
    icon: Camera,
    colorClass: "text-purple-600",
    bgClass: "bg-purple-100",
  },
  note: {
    icon: MessageSquare,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-100",
  },
  material_logged: {
    icon: Package,
    colorClass: "text-amber-600",
    bgClass: "bg-amber-100",
  },
  supplement_created: {
    icon: FileText,
    colorClass: "text-purple-600",
    bgClass: "bg-purple-100",
  },
  task_status_change: {
    icon: CheckCircle2,
    colorClass: "text-green-600",
    bgClass: "bg-green-100",
  },
  assignment_change: {
    icon: UserCheck,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-100",
  },
  qc_result: {
    icon: ClipboardCheck,
    colorClass: "text-purple-600",
    bgClass: "bg-purple-100",
  },
};

const DEFAULT_ICON = {
  icon: Activity,
  colorClass: "text-gray-600",
  bgClass: "bg-gray-100",
};

const LIMIT = 50;

export function JobTimeline({
  jobOrderId,
  initialActivities,
}: JobTimelineProps) {
  const [activities, setActivities] = useState<TimelineActivity[]>(
    initialActivities ?? []
  );
  const [loading, setLoading] = useState(!initialActivities);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchActivities = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(
        `/api/jobs/${jobOrderId}/timeline?${params.toString()}`
      );
      if (!res.ok) return null;
      return res.json() as Promise<{
        activities: TimelineActivity[];
        nextCursor: string | null;
      }>;
    },
    [jobOrderId]
  );

  useEffect(() => {
    if (initialActivities) {
      setNextCursor(
        initialActivities.length === LIMIT
          ? initialActivities[initialActivities.length - 1].createdAt
          : null
      );
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchActivities().then((result) => {
      if (cancelled || !result) return;
      setActivities(result.activities);
      setNextCursor(result.nextCursor);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initialActivities, fetchActivities]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchActivities(nextCursor);
    if (result) {
      setActivities((prev) => [...prev, ...result.activities]);
      setNextCursor(result.nextCursor);
    }
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-surface-400 text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="border-l-2 border-surface-200 ml-4">
      {activities.map((activity) => {
        const config = ACTIVITY_ICON_MAP[activity.type] ?? DEFAULT_ICON;
        const Icon = config.icon;

        return (
          <div key={activity.id} className="relative pl-8 pb-6">
            <div
              className={`absolute -left-[17px] w-8 h-8 rounded-full flex items-center justify-center ${config.bgClass}`}
            >
              <Icon className={`h-4 w-4 ${config.colorClass}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">
                {activity.title}
              </p>
              {activity.description && (
                <p className="text-sm text-surface-500 mt-1">
                  {activity.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-surface-400">
                  {relativeTime(activity.createdAt)}
                </span>
                <span className="text-xs text-surface-400">
                  {activity.user.firstName} {activity.user.lastName}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {nextCursor && (
        <div className="pl-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-2 text-sm text-accent-600 hover:bg-accent-50 rounded-lg disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
