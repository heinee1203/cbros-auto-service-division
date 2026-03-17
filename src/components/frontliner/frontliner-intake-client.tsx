"use client";

import { useRouter } from "next/navigation";
import { IntakeWizard } from "@/components/schedule/intake-wizard";

export function FrontlinerIntakeClient() {
  const router = useRouter();

  return (
    <IntakeWizard
      variant="frontliner"
      onComplete={() => router.push("/frontliner/jobs")}
    />
  );
}
