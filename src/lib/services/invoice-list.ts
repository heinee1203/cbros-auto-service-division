import { prisma } from "@/lib/prisma";

interface GetInvoicesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string; // "ALL" | "UNPAID" | "PARTIAL" | "PAID"
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getInvoices(params: GetInvoicesParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const where: any = { deletedAt: null, isLatest: true };

  // Filter by payment status
  if (status && status !== "ALL") {
    where.paymentStatus = status;
  }

  // Search by invoice number, customer name, plate number
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { jobOrder: { customer: { firstName: { contains: search } } } },
      { jobOrder: { customer: { lastName: { contains: search } } } },
      { jobOrder: { vehicle: { plateNumber: { contains: search } } } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        jobOrder: {
          select: {
            id: true,
            jobOrderNumber: true,
            customer: { select: { firstName: true, lastName: true } },
            vehicle: { select: { plateNumber: true, make: true, model: true } },
          },
        },
        chargeAccount: {
          select: { companyName: true },
        },
        _count: { select: { payments: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
