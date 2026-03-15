import { notFound } from "next/navigation";
import { getEstimateRequestById } from "@/lib/services/estimate-requests";
import { EstimateDetailClient } from "@/components/estimates/estimate-detail-client";

interface Props {
  params: { id: string };
}

export default async function EstimateDetailPage({ params }: Props) {
  const estimateRequest = await getEstimateRequestById(params.id);

  if (!estimateRequest) {
    notFound();
  }

  return <EstimateDetailClient estimateRequest={estimateRequest} />;
}
