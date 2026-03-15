import { prisma } from "@/lib/prisma";

export async function getAllSettings() {
  return prisma.setting.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
}

export async function getSettingsByCategory(category: string) {
  return prisma.setting.findMany({
    where: { category },
    orderBy: { key: "asc" },
  });
}

export async function getSetting(key: string) {
  return prisma.setting.findUnique({
    where: { key },
  });
}

export async function getSettingValue<T>(
  key: string,
  defaultValue: T
): Promise<T> {
  const setting = await prisma.setting.findUnique({
    where: { key },
  });
  if (!setting) return defaultValue;
  try {
    return JSON.parse(setting.value) as T;
  } catch {
    return defaultValue;
  }
}

export async function updateSetting(
  key: string,
  value: string,
  userId: string
) {
  return prisma.setting.update({
    where: { key },
    data: {
      value,
      updatedBy: userId,
    },
  });
}

export async function updateSettings(
  updates: Array<{ key: string; value: string }>,
  userId: string
) {
  return prisma.$transaction(
    updates.map((update) =>
      prisma.setting.update({
        where: { key: update.key },
        data: {
          value: update.value,
          updatedBy: userId,
        },
      })
    )
  );
}
