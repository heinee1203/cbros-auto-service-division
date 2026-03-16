"use client";

import dynamic from "next/dynamic";

const LiveFloor = dynamic(() => import("@/components/schedule/live-floor"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center py-12"
      style={{ color: "var(--sch-text-muted)" }}
    >
      Loading floor...
    </div>
  ),
});

export default function FloorPage() {
  return <LiveFloor />;
}
