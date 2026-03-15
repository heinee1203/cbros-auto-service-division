import { notFound } from "next/navigation";
import { getVehicleById } from "@/lib/services/vehicles";
import { VehicleDetailClient } from "./vehicle-detail-client";

interface Props {
  params: { id: string };
}

export default async function VehicleDetailPage({ params }: Props) {
  const vehicle = await getVehicleById(params.id);

  if (!vehicle) {
    notFound();
  }

  return <VehicleDetailClient vehicle={vehicle} />;
}
