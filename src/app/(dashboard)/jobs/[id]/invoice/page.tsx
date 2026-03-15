import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getJobInvoice } from "@/lib/services/invoices";
import { getInvoicePayments } from "@/lib/services/payments";
import { prisma } from "@/lib/prisma";
import InvoiceClient from "./invoice-client";

export default async function JobInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) return notFound();

  // Fetch job order with customer and vehicle
  const job = await prisma.jobOrder.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      jobOrderNumber: true,
      status: true,
      priority: true,
      isInsuranceJob: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          address: true,
        },
      },
      vehicle: {
        select: {
          plateNumber: true,
          make: true,
          model: true,
          year: true,
          color: true,
          vin: true,
        },
      },
    },
  });

  if (!job) return notFound();

  // Fetch invoice (latest)
  const invoice = await getJobInvoice(id);

  // Fetch payments if invoice exists
  const payments = invoice ? await getInvoicePayments(invoice.id) : [];

  // Fetch shop settings for header
  const shopSettings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "shop_name",
          "shop_address",
          "shop_phone",
          "shop_email",
          "shop_tin",
          "shop_logo_url",
        ],
      },
    },
  });
  const shopInfo = Object.fromEntries(
    shopSettings.map((s) => [s.key, s.value])
  );

  // Serialize dates
  const serializedInvoice = invoice
    ? JSON.parse(JSON.stringify(invoice))
    : null;
  const serializedPayments = JSON.parse(JSON.stringify(payments));

  return (
    <InvoiceClient
      job={JSON.parse(JSON.stringify(job))}
      invoice={serializedInvoice}
      payments={serializedPayments}
      shopInfo={shopInfo}
      userRole={session.user.role}
      canEdit={can(session.user.role, "invoices:edit")}
      canProcessPayment={can(session.user.role, "payments:process")}
      canViewAnalytics={can(session.user.role, "analytics:view")}
    />
  );
}
