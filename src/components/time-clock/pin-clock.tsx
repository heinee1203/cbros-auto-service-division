"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  clockInAction,
  clockOutAction,
  forceClockOutAndInAction,
  startBreakAction,
  endBreakAction,
} from "@/lib/actions/time-entry-actions";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { enqueueClockAction, getClockQueueCount } from "@/lib/offline/clock-queue";
import { WifiOff } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ClockState = "idle" | "authenticated" | "clocked_in" | "summary";

interface AssignedTask {
  taskId: string;
  taskName: string;
  taskStatus: string;
  jobOrderId: string;
  jobOrderNumber: string;
}

interface ActiveEntry {
  id: string;
  clockIn: string;
  taskId: string;
  taskName: string;
  jobOrderId: string;
  jobOrderNumber: string;
  breakMinutes: number;
  onBreak: boolean;
}

interface ClockStatus {
  activeEntry: ActiveEntry | null;
  dailyTotalMinutes: number;
  dailyHours: string;
  assignedTasks: AssignedTask[];
}

interface SummaryData {
  taskName: string;
  jobOrderNumber: string;
  durationMinutes: number;
  dailyHours: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface PinClockProps {
  preAuthUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function PinClock({ preAuthUser }: PinClockProps = {}) {
  const { data: session, status: sessionStatus } = useSession();

  // State machine
  const [clockState, setClockState] = useState<ClockState>("idle");

  // PIN entry
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const pinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock status
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Timer
  const [timerDisplay, setTimerDisplay] = useState("00:00:00");
  const frameRef = useRef<number | null>(null);

  // Break state
  const [onBreak, setOnBreak] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Conflict handling
  const [conflictTask, setConflictTask] = useState<{
    taskId: string;
    jobOrderId: string;
    taskName: string;
  } | null>(null);

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tech info
  const [techName, setTechName] = useState("");

  // Offline support
  const { isOnline } = useNetworkStatus();
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // ---------------------------------------------------------------------------
  // PIN auto-clear after 5s of inactivity
  // ---------------------------------------------------------------------------
  const resetPinTimeout = useCallback(() => {
    if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    if (pin.length > 0) {
      pinTimeoutRef.current = setTimeout(() => {
        setPin("");
        setPinError("");
      }, 5000);
    }
  }, [pin.length]);

  useEffect(() => {
    resetPinTimeout();
    return () => {
      if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    };
  }, [pin, resetPinTimeout]);

  // ---------------------------------------------------------------------------
  // Check offline queue count on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== "undefined") {
      getClockQueueCount().then(setOfflineQueueCount).catch(() => {});
    }
  }, []);

  // ---------------------------------------------------------------------------
  // If session exists on mount (e.g. browser refresh), fetch status
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user && clockState === "idle") {
      setTechName(session.user.firstName || session.user.name || "");
      fetchClockStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  // ---------------------------------------------------------------------------
  // Pre-authenticated user (frontliner mode — skip PIN entry)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (preAuthUser && clockState === "idle") {
      setTechName(`${preAuthUser.firstName} ${preAuthUser.lastName}`);
      setClockState("authenticated");
      fetchClockStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preAuthUser]);

  // ---------------------------------------------------------------------------
  // Timer effect for clocked-in state
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (clockState !== "clocked_in" || !clockStatus?.activeEntry) return;

    const clockInTime = clockStatus.activeEntry.clockIn;

    const update = () => {
      const elapsed = Date.now() - new Date(clockInTime).getTime();
      setTimerDisplay(formatElapsed(elapsed));
      frameRef.current = requestAnimationFrame(update);
    };
    frameRef.current = requestAnimationFrame(update);

    const onVisChange = () => {
      if (!document.hidden) {
        setTimerDisplay(
          formatElapsed(Date.now() - new Date(clockInTime).getTime())
        );
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [clockState, clockStatus?.activeEntry]);

  // ---------------------------------------------------------------------------
  // Auto-return to idle after summary
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (clockState !== "summary") return;
    summaryTimeoutRef.current = setTimeout(() => {
      handleLogout();
    }, 10000);
    return () => {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockState]);

  // ---------------------------------------------------------------------------
  // Fetch clock status
  // ---------------------------------------------------------------------------
  async function fetchClockStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/clock/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data: ClockStatus = await res.json();
      setClockStatus(data);

      if (data.activeEntry) {
        setOnBreak(data.activeEntry.onBreak);
        setClockState("clocked_in");
      } else {
        setClockState("authenticated");
      }
    } catch {
      toast.error("Failed to load clock status");
      setClockState("authenticated");
    } finally {
      setStatusLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // PIN handlers
  // ---------------------------------------------------------------------------
  function handleDigit(digit: string) {
    if (pin.length >= 6 || pinLoading) return;
    setPin((p) => p + digit);
    setPinError("");
  }

  function handleClear() {
    setPin("");
    setPinError("");
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
    setPinError("");
  }

  async function handlePinSubmit() {
    if (pin.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }

    setPinLoading(true);
    setPinError("");

    try {
      const result = await signIn("pin", {
        pin,
        redirect: false,
      });

      if (result?.error) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPinError("Invalid PIN");
        setPin("");
      } else {
        setPin("");
        // Small delay to let session update
        setTimeout(async () => {
          // Re-fetch session info
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (sessionData?.user) {
            setTechName(sessionData.user.firstName || sessionData.user.name || "");
          }
          await fetchClockStatus();
        }, 300);
      }
    } catch {
      setPinError("Authentication failed");
      setPin("");
    } finally {
      setPinLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Clock actions
  // ---------------------------------------------------------------------------
  async function handleClockIn(taskId: string, jobOrderId: string, taskName: string) {
    setActionLoading(true);
    try {
      if (!isOnline) {
        await enqueueClockAction("clock_in", { pin, taskId, jobOrderId });
        const count = await getClockQueueCount();
        setOfflineQueueCount(count);
        toast.success("Offline punch recorded — will sync when connected");
        // Show confirmation UI even offline
        setClockStatus((prev) => ({
          ...(prev || { dailyTotalMinutes: 0, dailyHours: "0h 0m", assignedTasks: [] }),
          activeEntry: {
            id: `offline-${Date.now()}`,
            clockIn: new Date().toISOString(),
            taskId,
            taskName,
            jobOrderId,
            jobOrderNumber: clockStatus?.assignedTasks.find((t) => t.taskId === taskId)?.jobOrderNumber || "",
            breakMinutes: 0,
            onBreak: false,
          },
        }));
        setClockState("clocked_in");
        return;
      }

      const result = await clockInAction(taskId, jobOrderId, "PIN_CLOCK");

      if (!result.success) {
        if (result.error === "Already clocked in") {
          setConflictTask({ taskId, jobOrderId, taskName });
          return;
        }
        toast.error(result.error || "Clock in failed");
        return;
      }

      toast.success("Clocked in!");
      await fetchClockStatus();
    } catch {
      toast.error("Clock in failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleForceSwitch() {
    if (!conflictTask) return;
    setActionLoading(true);
    try {
      const result = await forceClockOutAndInAction(
        conflictTask.taskId,
        conflictTask.jobOrderId,
        "PIN_CLOCK"
      );

      if (!result.success) {
        toast.error(result.error || "Switch failed");
        return;
      }

      toast.success("Switched tasks!");
      setConflictTask(null);
      await fetchClockStatus();
    } catch {
      toast.error("Switch failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClockOut() {
    if (!clockStatus?.activeEntry) return;
    setActionLoading(true);
    try {
      if (!isOnline) {
        await enqueueClockAction("clock_out", {
          pin,
          taskId: clockStatus.activeEntry.taskId,
          jobOrderId: clockStatus.activeEntry.jobOrderId,
        });
        const count = await getClockQueueCount();
        setOfflineQueueCount(count);
        toast.success("Offline punch recorded — will sync when connected");

        const clockInTime = new Date(clockStatus.activeEntry.clockIn).getTime();
        const durationMinutes = Math.floor((Date.now() - clockInTime) / 60000);

        setSummary({
          taskName: clockStatus.activeEntry.taskName,
          jobOrderNumber: clockStatus.activeEntry.jobOrderNumber,
          durationMinutes,
          dailyHours: clockStatus.dailyHours,
        });
        setOnBreak(false);
        setClockState("summary");
        return;
      }

      const result = await clockOutAction(clockStatus.activeEntry.id);

      if (!result.success) {
        toast.error(result.error || "Clock out failed");
        return;
      }

      const durationMinutes =
        (result.data?.durationMinutes as number) ?? 0;

      // Fetch updated daily total
      let dailyHours = clockStatus.dailyHours;
      try {
        const res = await fetch("/api/clock/status");
        if (res.ok) {
          const data: ClockStatus = await res.json();
          dailyHours = data.dailyHours;
          setClockStatus(data);
        }
      } catch {
        // Use existing
      }

      setSummary({
        taskName: clockStatus.activeEntry.taskName,
        jobOrderNumber: clockStatus.activeEntry.jobOrderNumber,
        durationMinutes,
        dailyHours,
      });
      setOnBreak(false);
      setClockState("summary");
      toast.success("Clocked out!");
    } catch {
      toast.error("Clock out failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartBreak() {
    if (!clockStatus?.activeEntry) return;
    setBreakLoading(true);
    try {
      const result = await startBreakAction(clockStatus.activeEntry.id);
      if (!result.success) {
        toast.error(result.error || "Failed to start break");
        return;
      }
      setOnBreak(true);
      toast.success("Break started");
    } catch {
      toast.error("Failed to start break");
    } finally {
      setBreakLoading(false);
    }
  }

  async function handleEndBreak() {
    if (!clockStatus?.activeEntry) return;
    setBreakLoading(true);
    try {
      const result = await endBreakAction(clockStatus.activeEntry.id);
      if (!result.success) {
        toast.error(result.error || "Failed to end break");
        return;
      }
      setOnBreak(false);
      toast.success("Break ended");
    } catch {
      toast.error("Failed to end break");
    } finally {
      setBreakLoading(false);
    }
  }

  async function handleLogout() {
    if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    await signOut({ redirect: false });
    setClockState("idle");
    setClockStatus(null);
    setPin("");
    setPinError("");
    setTechName("");
    setSummary(null);
    setOnBreak(false);
    setConflictTask(null);
  }

  function handleClockInAgain() {
    if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    setSummary(null);
    setClockState("authenticated");
    fetchClockStatus();
  }

  function clearSummaryTimeout() {
    if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
  }

  // ---------------------------------------------------------------------------
  // Status badge color
  // ---------------------------------------------------------------------------
  function statusBadgeClass(status: string): string {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "QUEUED":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  }

  // ---------------------------------------------------------------------------
  // Render: Idle (PIN entry)
  // ---------------------------------------------------------------------------
  function renderIdle() {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

    return (
      <div className="flex flex-col items-center w-full max-w-sm mx-auto">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="font-mono font-bold text-gray-950 text-2xl">AS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AutoServ Pro</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your PIN to clock in</p>
        </div>

        {/* PIN dots */}
        <div
          className={`flex justify-center gap-3 mb-6 transition-transform ${
            shake ? "animate-shake" : ""
          }`}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? "bg-amber-500 scale-110"
                  : "bg-gray-700 border border-gray-600"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {pinError && (
          <p className="text-sm text-red-400 font-medium text-center mb-4">
            {pinError}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {digits.map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={pinLoading}
              className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-2xl font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={pinLoading}
            className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-400 transition-all duration-150 active:scale-95"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit("0")}
            disabled={pinLoading}
            className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-2xl font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={pinLoading}
            className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 transition-all duration-150 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7h11a1 1 0 011 1v12a1 1 0 01-1 1H10l-7-7z"
              />
            </svg>
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={handlePinSubmit}
          disabled={pinLoading || pin.length < 4}
          className="w-full max-w-xs mt-6 py-4 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-lg rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {pinLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Verifying...
            </span>
          ) : (
            "Enter"
          )}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Authenticated (task select)
  // ---------------------------------------------------------------------------
  function renderAuthenticated() {
    if (statusLoading) {
      return (
        <div className="flex flex-col items-center justify-center">
          <svg
            className="animate-spin h-10 w-10 text-amber-500 mb-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-400 text-lg">Loading tasks...</p>
        </div>
      );
    }

    const tasks = clockStatus?.assignedTasks || [];

    return (
      <div className="flex flex-col items-center w-full max-w-md mx-auto">
        {/* Welcome */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Welcome, {techName}
          </h1>
          <p className="text-gray-400 mt-1">
            {clockStatus?.dailyHours
              ? <span>Today: <span className="font-mono">{clockStatus.dailyHours}</span></span>
              : "Select a task to clock in"}
          </p>
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No assigned tasks</p>
            <p className="text-gray-600 text-sm mt-2">
              Ask your supervisor for task assignments
            </p>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {tasks.map((task) => (
              <button
                key={task.taskId}
                onClick={() =>
                  handleClockIn(task.taskId, task.jobOrderId, task.taskName)
                }
                disabled={actionLoading}
                className="w-full p-4 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 rounded-xl text-left transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-lg truncate">
                      {task.taskName}
                    </p>
                    <p className="text-gray-400 text-sm mt-0.5 font-mono">
                      {task.jobOrderNumber}
                    </p>
                  </div>
                  <span
                    className={`ml-3 px-2.5 py-1 text-xs font-medium rounded-full border ${statusBadgeClass(
                      task.taskStatus
                    )}`}
                  >
                    {task.taskStatus.replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Conflict dialog */}
        {conflictTask && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-white text-lg font-bold mb-2">
                Switch Task?
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                You are currently clocked in to another task. Switch to{" "}
                <span className="text-amber-400 font-medium">
                  {conflictTask.taskName}
                </span>
                ? This will automatically clock you out of the current task.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConflictTask(null)}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForceSwitch}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Switching..." : "Switch"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Log out */}
        <button
          onClick={handleLogout}
          className="mt-8 py-3 px-8 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
        >
          Log Out
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Clocked In
  // ---------------------------------------------------------------------------
  function renderClockedIn() {
    const entry = clockStatus?.activeEntry;
    if (!entry) return null;

    return (
      <div className="flex flex-col items-center w-full max-w-md mx-auto">
        {/* Timer */}
        <div className="text-center mb-8">
          <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">
            {onBreak ? "On Break" : "Working"}
          </p>
          <p
            className={`font-mono font-bold transition-colors ${
              onBreak ? "text-6xl text-orange-400 animate-pulse" : "text-7xl text-amber-500"
            }`}
          >
            {timerDisplay}
          </p>
        </div>

        {/* Task info */}
        <div className="text-center mb-10">
          <p className="text-white text-xl font-semibold">{entry.taskName}</p>
          <p className="text-gray-400 text-sm mt-1 font-mono">{entry.jobOrderNumber}</p>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-xs space-y-3">
          {/* Break toggle */}
          {onBreak ? (
            <button
              onClick={handleEndBreak}
              disabled={breakLoading}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              {breakLoading ? "Ending Break..." : "End Break"}
            </button>
          ) : (
            <button
              onClick={handleStartBreak}
              disabled={breakLoading}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold text-lg rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              {breakLoading ? "Starting..." : "Take Break"}
            </button>
          )}

          {/* Clock out */}
          <button
            onClick={handleClockOut}
            disabled={actionLoading || onBreak}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            {actionLoading ? "Clocking Out..." : "Clock Out"}
          </button>

          {/* Switch task */}
          <button
            onClick={() => {
              setClockState("authenticated");
              fetchClockStatus();
            }}
            disabled={onBreak}
            className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors disabled:opacity-30"
          >
            Switch Task
          </button>
        </div>

        {/* Daily total */}
        {clockStatus?.dailyHours && (
          <p className="text-gray-600 text-xs mt-6">
            Today&apos;s total: <span className="font-mono">{clockStatus.dailyHours}</span>
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Summary
  // ---------------------------------------------------------------------------
  function renderSummary() {
    if (!summary) return null;

    return (
      <div
        className="flex flex-col items-center w-full max-w-sm mx-auto"
        onClick={clearSummaryTimeout}
      >
        {/* Check icon */}
        <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Clocked Out</h2>

        {/* Details */}
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-5 mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Task</span>
            <span className="text-white font-medium text-sm">
              {summary.taskName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Job Order</span>
            <span className="text-white font-medium text-sm font-mono">
              {summary.jobOrderNumber}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Duration</span>
            <span className="text-amber-400 font-bold text-sm font-mono">
              {formatDuration(summary.durationMinutes)}
            </span>
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between">
            <span className="text-gray-400 text-sm">Daily Total</span>
            <span className="text-white font-bold text-sm font-mono">
              {summary.dailyHours}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full mt-8 space-y-3">
          <button
            onClick={handleClockInAgain}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-lg rounded-xl transition-all duration-150 active:scale-[0.98]"
          >
            Clock In Again
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
          >
            Log Out
          </button>
        </div>

        <p className="text-gray-600 text-xs mt-6">
          Auto-logout in 10 seconds...
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center p-6 overflow-auto">
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>

      {!isOnline && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm z-50">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline mode — punches will sync when connected</span>
        </div>
      )}
      {offlineQueueCount > 0 && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 text-xs text-gray-400 text-center z-50">
          {offlineQueueCount} pending offline punch{offlineQueueCount > 1 ? "es" : ""}
        </div>
      )}

      {clockState === "idle" && (preAuthUser ? (
        <div className="flex flex-col items-center justify-center">
          <svg
            className="animate-spin h-10 w-10 text-amber-500 mb-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400 text-lg">Loading...</p>
        </div>
      ) : renderIdle())}
      {clockState === "authenticated" && renderAuthenticated()}
      {clockState === "clocked_in" && renderClockedIn()}
      {clockState === "summary" && renderSummary()}
    </div>
  );
}
