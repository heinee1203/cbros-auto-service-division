import { prisma } from "@/lib/prisma";

// Types
export interface ChargeAccountDetail {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tinNumber: string | null;
  creditLimit: number | null;
  creditTerms: string;
  currentBalance: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    balanceDue: number;
    paymentStatus: string;
    dueDate: Date | null;
    createdAt: Date;
    jobOrder: {
      id: string;
      jobOrderNumber: string;
      customer: { id: string; firstName: string; lastName: string };
      vehicle: {
        id: string;
        make: string;
        model: string;
        year: number | null;
        plateNumber: string | null;
      };
    };
  }>;
  customers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  }>;
  aging: AgingBreakdown;
}

export interface AgingBreakdown {
  current: number;
  thirtyDay: number;
  sixtyDay: number;
  ninetyPlus: number;
  total: number;
}

function calculateAgingBucket(
  dueDate: Date | null,
  today: Date
): "current" | "thirtyDay" | "sixtyDay" | "ninetyPlus" {
  if (!dueDate) return "current";
  const daysPast = Math.floor(
    (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysPast <= 30) return "current";
  if (daysPast <= 60) return "thirtyDay";
  if (daysPast <= 90) return "sixtyDay";
  return "ninetyPlus";
}

// List all active charge accounts (for dropdowns and list page)
export async function getChargeAccounts() {
  return prisma.chargeAccount.findMany({
    orderBy: { companyName: "asc" },
  });
}

// Get single account with full details
export async function getChargeAccountById(
  id: string
): Promise<ChargeAccountDetail | null> {
  const account = await prisma.chargeAccount.findUnique({
    where: { id },
    include: {
      invoices: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          jobOrder: {
            include: {
              customer: {
                select: { id: true, firstName: true, lastName: true },
              },
              vehicle: {
                select: {
                  id: true,
                  make: true,
                  model: true,
                  year: true,
                  plateNumber: true,
                },
              },
            },
          },
        },
      },
      customers: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
    },
  });

  if (!account) return null;

  const today = new Date();
  const aging = computeAgingFromInvoices(account.invoices, today);

  return {
    ...account,
    aging,
  } as ChargeAccountDetail;
}

// Create new account
export async function createChargeAccount(data: {
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  tinNumber?: string;
  creditLimit?: number;
  creditTerms?: string;
  notes?: string;
  createdBy: string;
}) {
  return prisma.chargeAccount.create({
    data: {
      companyName: data.companyName,
      contactPerson: data.contactPerson,
      phone: data.phone,
      email: data.email,
      address: data.address,
      tinNumber: data.tinNumber,
      creditLimit: data.creditLimit,
      creditTerms: data.creditTerms ?? "NET_30",
      notes: data.notes,
      createdBy: data.createdBy,
    },
  });
}

// Update account
export async function updateChargeAccount(
  id: string,
  data: Partial<{
    companyName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    tinNumber: string;
    creditLimit: number;
    creditTerms: string;
    notes: string;
    isActive: boolean;
  }>
) {
  return prisma.chargeAccount.update({
    where: { id },
    data,
  });
}

// Recalculate current balance (sum of unpaid charge invoices)
export async function recalculateAccountBalance(
  accountId: string
): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: {
      chargeAccountId: accountId,
      invoiceType: "CHARGE",
      paymentStatus: { not: "FULLY_PAID" },
      deletedAt: null,
    },
    _sum: { balanceDue: true },
  });

  const balance = result._sum.balanceDue ?? 0;

  await prisma.chargeAccount.update({
    where: { id: accountId },
    data: { currentBalance: balance },
  });

  return balance;
}

// Helper to compute aging from a list of invoices
function computeAgingFromInvoices(
  invoices: Array<{
    balanceDue: number;
    paymentStatus: string;
    dueDate: Date | null;
    invoiceType?: string;
  }>,
  today: Date
): AgingBreakdown {
  const aging: AgingBreakdown = {
    current: 0,
    thirtyDay: 0,
    sixtyDay: 0,
    ninetyPlus: 0,
    total: 0,
  };

  for (const inv of invoices) {
    if (inv.paymentStatus === "FULLY_PAID") continue;
    if (inv.invoiceType && inv.invoiceType !== "CHARGE") continue;

    const bucket = calculateAgingBucket(inv.dueDate, today);
    aging[bucket] += inv.balanceDue;
    aging.total += inv.balanceDue;
  }

  return aging;
}

// Get AR aging for an account
export async function getAccountAging(
  accountId: string
): Promise<AgingBreakdown> {
  const invoices = await prisma.invoice.findMany({
    where: {
      chargeAccountId: accountId,
      invoiceType: "CHARGE",
      paymentStatus: { not: "FULLY_PAID" },
      deletedAt: null,
    },
    select: { balanceDue: true, paymentStatus: true, dueDate: true },
  });

  return computeAgingFromInvoices(invoices, new Date());
}

// Get AR summary across all accounts
export async function getARSummary(): Promise<{
  totalOutstanding: number;
  current: number;
  thirtyDay: number;
  sixtyDay: number;
  ninetyPlus: number;
  byAccount: Array<{
    id: string;
    companyName: string;
    current: number;
    thirtyDay: number;
    sixtyDay: number;
    ninetyPlus: number;
    total: number;
  }>;
}> {
  const accounts = await prisma.chargeAccount.findMany({
    where: { isActive: true },
    include: {
      invoices: {
        where: {
          invoiceType: "CHARGE",
          paymentStatus: { not: "FULLY_PAID" },
          deletedAt: null,
        },
        select: { balanceDue: true, paymentStatus: true, dueDate: true },
      },
    },
    orderBy: { companyName: "asc" },
  });

  const today = new Date();
  let totalOutstanding = 0;
  let totalCurrent = 0;
  let totalThirtyDay = 0;
  let totalSixtyDay = 0;
  let totalNinetyPlus = 0;

  const byAccount = accounts
    .map((account) => {
      const aging = computeAgingFromInvoices(account.invoices, today);
      totalOutstanding += aging.total;
      totalCurrent += aging.current;
      totalThirtyDay += aging.thirtyDay;
      totalSixtyDay += aging.sixtyDay;
      totalNinetyPlus += aging.ninetyPlus;

      return {
        id: account.id,
        companyName: account.companyName,
        ...aging,
      };
    })
    .filter((a) => a.total > 0);

  return {
    totalOutstanding,
    current: totalCurrent,
    thirtyDay: totalThirtyDay,
    sixtyDay: totalSixtyDay,
    ninetyPlus: totalNinetyPlus,
    byAccount,
  };
}
