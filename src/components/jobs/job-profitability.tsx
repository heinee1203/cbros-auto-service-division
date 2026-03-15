"use client";

import { formatPeso } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface JobProfitabilityProps {
  data: {
    revenue: number;
    laborCost: number;
    materialsCost: number;
    subletCost: number;
    totalCost: number;
    grossProfit: number;
    marginPercent: number;
    estimateTotal: number;
    varianceAmount: number;
    variancePercent: number;
  };
}

export function JobProfitabilityCard({ data }: JobProfitabilityProps) {
  const marginColor =
    data.marginPercent >= 30 ? "text-green-600" :
    data.marginPercent >= 15 ? "text-amber-600" : "text-red-600";

  const marginBg =
    data.marginPercent >= 30 ? "bg-green-50 border-green-200" :
    data.marginPercent >= 15 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`rounded-lg border p-5 space-y-4 ${marginBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <DollarSign className="w-4 h-4" />
          Job Profitability
        </div>
        <span className={`text-2xl font-bold font-mono ${marginColor}`}>
          {data.marginPercent.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-surface-500">Revenue</p>
          <p className="font-semibold text-primary">{formatPeso(data.revenue)}</p>
        </div>
        <div>
          <p className="text-surface-500">Total Cost</p>
          <p className="font-semibold text-primary">{formatPeso(data.totalCost)}</p>
        </div>
        <div>
          <p className="text-surface-500">Labor Cost</p>
          <p className="font-mono text-sm">{formatPeso(data.laborCost)}</p>
        </div>
        <div>
          <p className="text-surface-500">Materials Cost</p>
          <p className="font-mono text-sm">{formatPeso(data.materialsCost)}</p>
        </div>
        {data.subletCost > 0 && (
          <div>
            <p className="text-surface-500">Sublet Cost</p>
            <p className="font-mono text-sm">{formatPeso(data.subletCost)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-200">
        <div>
          <p className="text-sm text-surface-500">Gross Profit</p>
          <p className={`text-lg font-bold font-mono ${marginColor}`}>
            {formatPeso(data.grossProfit)}
          </p>
        </div>
        {data.varianceAmount !== 0 && (
          <div className="flex items-center gap-1 text-xs">
            {data.varianceAmount > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span className={data.varianceAmount > 0 ? "text-green-600" : "text-red-600"}>
              {formatPeso(Math.abs(data.varianceAmount))} vs estimate
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
