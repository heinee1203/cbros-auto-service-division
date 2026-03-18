"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ClipboardList, History } from "lucide-react";

const RegistryView = dynamic(
  () =>
    import("@/components/schedule/registry-view").then((m) => ({
      default: m.RegistryView,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ color: "var(--sch-text-muted)" }}
        className="p-8 text-center"
      >
        Loading...
      </div>
    ),
  }
);

const RegistryEstimatesTab = dynamic(
  () =>
    import("@/components/schedule/registry-estimates-tab").then((m) => ({
      default: m.RegistryEstimatesTab,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ color: "var(--sch-text-muted)" }}
        className="p-8 text-center"
      >
        Loading...
      </div>
    ),
  }
);

export default function RegistryPage() {
  const [activeTab, setActiveTab] = useState<"estimates" | "jobs">("estimates");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex gap-1 px-4 pt-3 pb-2"
        style={{ borderBottom: "1px solid var(--sch-border)" }}
      >
        <button
          onClick={() => setActiveTab("estimates")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "estimates" ? "" : "opacity-60 hover:opacity-80"
          }`}
          style={{
            background:
              activeTab === "estimates"
                ? "rgba(245,158,11,0.15)"
                : "transparent",
            color:
              activeTab === "estimates"
                ? "var(--sch-accent)"
                : "var(--sch-text-muted)",
            border:
              activeTab === "estimates"
                ? "1px solid var(--sch-accent)"
                : "1px solid transparent",
          }}
        >
          <ClipboardList className="h-4 w-4" />
          Estimates
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "jobs" ? "" : "opacity-60 hover:opacity-80"
          }`}
          style={{
            background:
              activeTab === "jobs" ? "rgba(245,158,11,0.15)" : "transparent",
            color:
              activeTab === "jobs"
                ? "var(--sch-accent)"
                : "var(--sch-text-muted)",
            border:
              activeTab === "jobs"
                ? "1px solid var(--sch-accent)"
                : "1px solid transparent",
          }}
        >
          <History className="h-4 w-4" />
          Job History
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "estimates" ? <RegistryEstimatesTab /> : <RegistryView />}
      </div>
    </div>
  );
}
