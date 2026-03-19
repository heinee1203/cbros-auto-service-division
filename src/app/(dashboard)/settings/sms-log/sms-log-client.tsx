"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { formatPhone, formatDateTime } from "@/lib/utils";
import { SMS_TYPE_LABELS, SMS_STATUS_COLORS } from "@/types/enums";
import type { SmsType } from "@/types/enums";

interface SmsLogEntry {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  type: string;
  message: string;
  status: string;
  error: string | null;
  createdAt: string;
}

interface SmsLogClientProps {
  initialLogs: SmsLogEntry[];
  dailyCount: number;
  dailyLimit: number;
}

export function SmsLogClient({
  initialLogs,
  dailyCount,
  dailyLimit,
}: SmsLogClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered =
    statusFilter === "ALL"
      ? initialLogs
      : initialLogs.filter((l) => l.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="rounded-lg p-1.5 hover:bg-surface-100"
          >
            <ArrowLeft className="w-5 h-5 text-surface-500" />
          </Link>
          <MessageSquare className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-surface-900">SMS Log</h1>
        </div>
        <div className="text-sm text-surface-500">
          <span className="font-mono font-semibold text-surface-900">
            {dailyCount}
          </span>{" "}
          / {dailyLimit} sent today
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["ALL", "SENT", "FAILED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-white"
                : "border border-surface-300 text-surface-700 hover:bg-surface-50"
            }`}
          >
            {s === "ALL" ? "All" : s === "SENT" ? "Sent" : "Failed"}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-surface-200 bg-white px-5 py-12 text-center text-surface-500">
          No SMS messages {statusFilter !== "ALL" ? `with status "${statusFilter}"` : "yet"}.
        </div>
      ) : (
        <div className="rounded-lg border border-surface-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-surface-500">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-3 py-3 font-medium">Recipient</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-3 text-surface-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-medium text-surface-900">
                      {log.recipientName || "—"}
                    </div>
                    <div className="text-xs text-surface-500 font-mono">
                      {formatPhone(log.recipientPhone)}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {SMS_TYPE_LABELS[log.type as SmsType] || log.type}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        SMS_STATUS_COLORS[log.status] ?? ""
                      }`}
                    >
                      {log.status}
                    </span>
                    {log.error && (
                      <p className="mt-1 text-xs text-danger-600 max-w-[200px] truncate">
                        {log.error}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-surface-600 max-w-xs truncate">
                    {log.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
