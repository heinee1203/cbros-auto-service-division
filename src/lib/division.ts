import type { UserDivision } from "@/types/enums";
import { MECHANICAL_CATEGORIES, BODY_PAINT_CATEGORIES, type ServiceGroupName } from "./constants";

/**
 * Maps a user division to the service category group filter value
 * used in Job Orders and Frontliner views.
 */
export function divisionToCategoryGroup(division: UserDivision): string {
  switch (division) {
    case "MECHANICAL":
      return "AUTO_REPAIR";
    case "BODY_PAINT":
      return "BODY_PAINT";
    default:
      return "ALL";
  }
}

/**
 * Returns the service categories relevant to a division.
 * ALL returns undefined (no filter).
 */
export function getDivisionCategories(
  division: UserDivision
): string[] | undefined {
  switch (division) {
    case "MECHANICAL":
      return [...MECHANICAL_CATEGORIES];
    case "BODY_PAINT":
      return [...BODY_PAINT_CATEGORIES];
    default:
      return undefined;
  }
}

/**
 * Builds a Prisma where clause to filter jobs by division via their task service categories.
 * Returns an empty object for ALL (no filtering).
 */
export function divisionJobFilter(division: UserDivision): Record<string, unknown> {
  const categories = getDivisionCategories(division);
  if (!categories) return {};
  return {
    tasks: {
      some: {
        deletedAt: null,
        serviceCatalog: {
          category: { in: categories },
        },
      },
    },
  };
}

/**
 * Builds a Prisma where clause to filter users by division.
 * ALL users can see everyone; division-specific users see their own + ALL.
 */
export function divisionUserFilter(division: UserDivision): Record<string, unknown> {
  if (division === "ALL") return {};
  return {
    division: { in: [division, "ALL"] },
  };
}

/**
 * Maps division to the default service group tab name in the service selector.
 */
export function divisionToServiceGroup(division: UserDivision): ServiceGroupName {
  switch (division) {
    case "MECHANICAL":
      return "Auto Service";
    case "BODY_PAINT":
      return "Body & Paint";
    default:
      return "Auto Service";
  }
}
