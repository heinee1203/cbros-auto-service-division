"use client";

import dynamic from "next/dynamic";

const RegistryView = dynamic(
  () =>
    import("@/components/schedule/registry-view").then((m) => ({
      default: m.RegistryView,
    })),
  { ssr: false }
);

export default function RegistryPage() {
  return <RegistryView />;
}
