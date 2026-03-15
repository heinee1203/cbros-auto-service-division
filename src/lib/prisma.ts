import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

// Soft-delete extension using Prisma Client Extensions (not deprecated middleware)
// Auto-injects `where: { deletedAt: null }` on read queries
// AuditLog is excluded — it has no deletedAt field (append-only)
const SOFT_DELETE_MODELS = [
  "User",
  "Customer",
  "Vehicle",
  "EstimateRequest",
  "Estimate",
  "EstimateVersion",
  "EstimateLineItem",
  "JobOrder",
  "IntakeRecord",
  "IntakeDamageMap",
  "IntakeBelonging",
  "Task",
  "TimeEntry",
  "MaterialUsage",
  "SupplementalEstimate",
  "SupplementLineItem",
  "QCInspection",
  "QCChecklistItem",
  "Invoice",
  "InvoiceLineItem",
  "Payment",
  "ReleaseRecord",
  "Warranty",
  "WarrantyClaim",
  "Photo",
  "AdjusterLog",
  "Notification",
] as const;

function addSoftDeleteFilter(args: Record<string, unknown> | undefined) {
  if (!args) args = {};
  if (!args.where) args.where = {};
  const where = args.where as Record<string, unknown>;
  if (where.deletedAt === undefined) {
    where.deletedAt = null;
  }
  return args;
}

type QueryArgs = {
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => unknown;
};

function createModelExtension() {
  return {
    findMany({ args, query }: QueryArgs) {
      return query(addSoftDeleteFilter(args));
    },
    findFirst({ args, query }: QueryArgs) {
      return query(addSoftDeleteFilter(args));
    },
    findUnique({ args, query }: QueryArgs) {
      return query(addSoftDeleteFilter(args));
    },
    count({ args, query }: QueryArgs) {
      return query(addSoftDeleteFilter(args));
    },
    aggregate({ args, query }: QueryArgs) {
      return query(addSoftDeleteFilter(args));
    },
  };
}

// Build the extension object dynamically for all soft-delete models
const queryExtensions: Record<string, ReturnType<typeof createModelExtension>> =
  {};
for (const model of SOFT_DELETE_MODELS) {
  // Prisma expects lowercase first letter for model names in extensions
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  queryExtensions[key] = createModelExtension();
}

export const prisma = basePrisma.$extends({
  query: queryExtensions as never,
});

// For queries that need to include soft-deleted records (e.g., audit/admin views)
export const prismaUnfiltered = basePrisma;

export type PrismaTransactionClient = Parameters<
  Parameters<typeof basePrisma.$transaction>[0]
>[0];
