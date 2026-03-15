import { prisma } from "@/lib/prisma";

export async function logActivity(data: {
  jobOrderId: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  userId: string;
}) {
  return prisma.jobActivity.create({
    data: {
      jobOrderId: data.jobOrderId,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      userId: data.userId,
    },
  });
}

export async function getJobActivities(
  jobOrderId: string,
  params?: { limit?: number; cursor?: string; type?: string }
) {
  const limit = params?.limit ?? 50;

  const where: Record<string, unknown> = { jobOrderId };

  if (params?.cursor) {
    where.createdAt = { lt: new Date(params.cursor) };
  }

  if (params?.type) {
    where.type = params.type;
  }

  const activities = await prisma.jobActivity.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const nextCursor =
    activities.length === limit
      ? activities[activities.length - 1].createdAt.toISOString()
      : null;

  return { activities, nextCursor };
}

export async function addJobNote(
  jobOrderId: string,
  content: string,
  mentions: string[],
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  if (!user) throw new Error("User not found");

  const fullName = `${user.firstName} ${user.lastName}`;

  const activity = await prisma.jobActivity.create({
    data: {
      jobOrderId,
      type: "note",
      title: `${fullName} added a note`,
      description: content,
      metadata: mentions.length > 0 ? JSON.stringify({ mentions }) : null,
      userId,
    },
  });

  if (mentions.length > 0) {
    const jobOrder = await prisma.jobOrder.findUnique({
      where: { id: jobOrderId },
      select: { jobOrderNumber: true },
    });

    const truncatedContent =
      content.length > 100 ? `${content.slice(0, 100)}...` : content;

    await prisma.notification.createMany({
      data: mentions.map((recipientId) => ({
        recipientId,
        type: "GENERAL",
        title: `Mentioned by ${fullName}`,
        message: `You were mentioned in a note on job ${jobOrder?.jobOrderNumber ?? jobOrderId}: "${truncatedContent}"`,
        isRead: false,
        entityType: "JOB_ORDER",
        entityId: jobOrderId,
      })),
    });
  }

  return activity;
}
