"use client";

import { useRouter, useSearchParams } from "next/navigation";
import EstimateCardBuilder from "./estimate-card-builder";

interface EstimateEditWrapperProps {
  versionId: string;
  returnTo?: string;
  initialLineItems: {
    id: string;
    group: string;
    description: string;
    serviceCatalogId: string | null;
    quantity: number;
    unit: string;
    unitCost: number;
    markup: number;
    subtotal: number;
    notes: string | null;
    estimatedHours: number | null;
    sortOrder: number;
  }[];
  initialVersion: {
    subtotalLabor: number;
    subtotalParts: number;
    subtotalMaterials: number;
    subtotalPaint: number;
    subtotalSublet: number;
    subtotalOther: number;
    discountType: string | null;
    discountValue: number;
    grandTotal: number;
  };
}

export function EstimateEditWrapper({
  versionId,
  returnTo,
  initialLineItems,
  initialVersion,
}: EstimateEditWrapperProps) {
  const router = useRouter();
  return (
    <EstimateCardBuilder
      versionId={versionId}
      initialLineItems={initialLineItems}
      initialVersion={initialVersion}
      onSave={() => router.push(returnTo || "/schedule/registry")}
    />
  );
}
