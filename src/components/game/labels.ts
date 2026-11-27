import type { Category } from "@config/game";

/** Category names as players see them. Server-safe. */
export const categoryLabel: Record<Category, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  retail: "Retail",
  grocery: "Grocery",
  entertainment: "Entertainment",
  service: "Service",
  automotive: "Automotive",
  other: "Other",
};
