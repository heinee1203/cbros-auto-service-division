import { prisma } from "@/lib/prisma";
import { formatPeso, generateDocNumber } from "@/lib/utils";
import { logActivity } from "@/lib/services/job-activities";

// ---------------------------------------------------------------------------
// 1. recordPayment
// ---------------------------------------------------------------------------
export async function recordPayment(
  invoiceId: string,
  data: {
    amount: number;
    method: string;
    referenceNumber?: string;
    last4Digits?: string;
    approvalCode?: string;
    checkBank?: string;
    checkDate?: string;
    notes?: string;
  },
  userId: string
) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { jobOrder: { select: { id: true } } },
  });

  const now = new Date();

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: data.amount,
      method: data.method,
      referenceNumber: data.referenceNumber ?? null,
      last4Digits: data.last4Digits ?? null,
      approvalCode: data.approvalCode ?? null,
      checkBank: data.checkBank ?? null,
      checkDate: data.checkDate ? new Date(data.checkDate) : null,
      notes: data.notes ?? null,
      paidAt: now,
      createdBy: userId,
    },
  });

  // Update invoice totals
  const newTotalPaid = invoice.totalPaid + data.amount;
  const newBalanceDue = invoice.grandTotal - newTotalPaid;

  let paymentStatus: string;
  if (newTotalPaid >= invoice.grandTotal) {
    paymentStatus = "PAID";
  } else if (newTotalPaid > 0) {
    paymentStatus = "PARTIAL";
  } else {
    paymentStatus = "UNPAID";
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      totalPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      paymentStatus,
      ...(paymentStatus === "PAID" ? { paidInFullAt: now } : {}),
    },
  });

  // Update job order status
  const jobOrderId = invoice.jobOrder.id;

  if (paymentStatus === "PAID") {
    await prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: { status: "FULLY_PAID", updatedBy: userId },
    });
  } else if (paymentStatus === "PARTIAL") {
    await prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: { status: "PARTIAL_PAYMENT", updatedBy: userId },
    });
  }

  // Log activity
  await logActivity({
    jobOrderId,
    type: "payment_received",
    title: `Payment of ${formatPeso(data.amount)} received via ${data.method}`,
    metadata: { paymentId: payment.id, invoiceId, amount: data.amount, method: data.method },
    userId,
  });

  // Notify OWNER/MANAGER users
  const managers = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "MANAGER"] }, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (managers.length > 0) {
    await prisma.notification.createMany({
      data: managers.map((m) => ({
        recipientId: m.id,
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        message: `Payment of ${formatPeso(data.amount)} received via ${data.method}`,
        isRead: false,
        entityType: "INVOICE",
        entityId: invoiceId,
      })),
    });
  }

  return payment;
}

// ---------------------------------------------------------------------------
// 2. getInvoicePayments
// ---------------------------------------------------------------------------
export async function getInvoicePayments(invoiceId: string) {
  const payments = await prisma.payment.findMany({
    where: { invoiceId, deletedAt: null },
    orderBy: { paidAt: "desc" },
  });

  // Fetch creator info for each payment
  const creatorIds = Array.from(new Set(payments.map((p) => p.createdBy).filter((id): id is string => id !== null)));
  const creators = creatorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];

  const creatorMap = new Map(creators.map((c) => [c.id, { firstName: c.firstName, lastName: c.lastName }]));

  return payments.map((p) => ({
    ...p,
    creator: p.createdBy ? creatorMap.get(p.createdBy) ?? null : null,
  }));
}

// ---------------------------------------------------------------------------
// 3. voidPayment
// ---------------------------------------------------------------------------
export async function voidPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      invoice: {
        include: { jobOrder: { select: { id: true } } },
      },
    },
  });

  // Soft delete the payment
  await prisma.payment.update({
    where: { id: paymentId },
    data: { deletedAt: new Date(), updatedBy: userId },
  });

  // Recalculate invoice from remaining non-deleted payments
  const remainingPayments = await prisma.payment.findMany({
    where: { invoiceId: payment.invoiceId, deletedAt: null },
  });

  const newTotalPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
  const newBalanceDue = payment.invoice.grandTotal - newTotalPaid;

  let paymentStatus: string;
  if (newTotalPaid >= payment.invoice.grandTotal) {
    paymentStatus = "PAID";
  } else if (newTotalPaid > 0) {
    paymentStatus = "PARTIAL";
  } else {
    paymentStatus = "UNPAID";
  }

  const invoiceUpdate: Record<string, unknown> = {
    totalPaid: newTotalPaid,
    balanceDue: newBalanceDue,
    paymentStatus,
    updatedBy: userId,
  };

  // If was PAID and now not, clear paidInFullAt
  if (payment.invoice.paymentStatus === "PAID" && paymentStatus !== "PAID") {
    invoiceUpdate.paidInFullAt = null;
  }

  await prisma.invoice.update({
    where: { id: payment.invoiceId },
    data: invoiceUpdate,
  });

  // Update job status if needed
  const jobOrderId = payment.invoice.jobOrder.id;

  if (payment.invoice.paymentStatus === "PAID" && paymentStatus !== "PAID") {
    // Was fully paid, now it's not
    const newJobStatus = paymentStatus === "PARTIAL" ? "PARTIAL_PAYMENT" : "AWAITING_PAYMENT";
    await prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: { status: newJobStatus, updatedBy: userId },
    });
  }

  // Log activity
  await logActivity({
    jobOrderId,
    type: "payment_voided",
    title: "Payment voided",
    description: `Payment of ${formatPeso(payment.amount)} via ${payment.method} was voided`,
    metadata: { paymentId, invoiceId: payment.invoiceId, amount: payment.amount },
    userId,
  });

  return payment;
}

// ---------------------------------------------------------------------------
// 4. generateReceipt
// ---------------------------------------------------------------------------
export async function generateReceipt(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          jobOrder: {
            include: {
              customer: true,
              vehicle: true,
            },
          },
        },
      },
    },
  });

  // Only generate OR number on the invoice if not already set
  if (!payment.invoice.orNumber) {
    const seqSetting = await prisma.setting.findUnique({
      where: { key: "next_or_sequence" },
    });
    const nextSeq = seqSetting ? parseInt(seqSetting.value, 10) : 1;

    await prisma.setting.upsert({
      where: { key: "next_or_sequence" },
      update: { value: String(nextSeq + 1) },
      create: {
        key: "next_or_sequence",
        value: String(nextSeq + 1),
        category: "numbering",
        description: "Next official receipt sequence number",
      },
    });

    const orNumber = generateDocNumber("OR", nextSeq);

    await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { orNumber },
    });

    return {
      payment,
      orNumber,
      invoice: payment.invoice,
      jobOrder: payment.invoice.jobOrder,
      customer: payment.invoice.jobOrder.customer,
      vehicle: payment.invoice.jobOrder.vehicle,
    };
  }

  return {
    payment,
    orNumber: payment.invoice.orNumber,
    invoice: payment.invoice,
    jobOrder: payment.invoice.jobOrder,
    customer: payment.invoice.jobOrder.customer,
    vehicle: payment.invoice.jobOrder.vehicle,
  };
}

// ---------------------------------------------------------------------------
// 5. getReceiptData
// ---------------------------------------------------------------------------
export async function getReceiptData(paymentId: string) {
  // Fetch shop info from Settings
  const settingKeys = ["shop_name", "shop_address", "shop_phone", "shop_tin"];
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys } },
  });

  const shopInfo: Record<string, string> = {};
  for (const s of settings) {
    shopInfo[s.key] = s.value;
  }

  // Fetch payment with invoice and related data
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          jobOrder: {
            include: {
              customer: true,
              vehicle: true,
            },
          },
        },
      },
    },
  });

  // Calculate running balance: sum of payments with paidAt <= this payment's paidAt
  const paymentsUpToThis = await prisma.payment.findMany({
    where: {
      invoiceId: payment.invoiceId,
      deletedAt: null,
      paidAt: { lte: payment.paidAt },
    },
  });

  const totalPaidUpToThis = paymentsUpToThis.reduce((sum, p) => sum + p.amount, 0);
  const runningBalance = payment.invoice.grandTotal - totalPaidUpToThis;

  return {
    shopInfo: {
      name: shopInfo.shop_name ?? "",
      address: shopInfo.shop_address ?? "",
      phone: shopInfo.shop_phone ?? "",
      tin: shopInfo.shop_tin ?? "",
    },
    payment,
    invoice: payment.invoice,
    orNumber: payment.invoice.orNumber,
    jobOrder: payment.invoice.jobOrder,
    customer: payment.invoice.jobOrder.customer,
    vehicle: payment.invoice.jobOrder.vehicle,
    runningBalance,
    totalPaidUpToThis,
  };
}
