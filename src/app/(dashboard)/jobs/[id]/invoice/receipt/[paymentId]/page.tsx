import { notFound } from "next/navigation";
import { getReceiptData } from "@/lib/services/payments";
import { ReceiptContent } from "@/components/receipt/receipt-content";

interface ReceiptPageProps {
  params: { id: string; paymentId: string };
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  let data;
  try {
    data = await getReceiptData(params.paymentId);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  // Serialize dates for client component
  const serializedData = {
    shopInfo: data.shopInfo,
    payment: {
      id: data.payment.id,
      amount: data.payment.amount,
      method: data.payment.method,
      referenceNumber: data.payment.referenceNumber,
      paidAt: data.payment.paidAt.toISOString(),
      notes: data.payment.notes,
    },
    invoice: {
      invoiceNumber: data.invoice.invoiceNumber,
      grandTotal: data.invoice.grandTotal,
      vatableAmount: data.invoice.vatableAmount,
      vatAmount: data.invoice.vatAmount,
      orNumber: data.invoice.orNumber,
    },
    customer: {
      firstName: data.customer.firstName,
      lastName: data.customer.lastName,
      company: data.customer.company,
    },
    totalPaidUpToThis: data.totalPaidUpToThis,
    runningBalance: data.runningBalance,
  };

  return <ReceiptContent data={serializedData} />;
}
