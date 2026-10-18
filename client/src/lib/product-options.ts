export const productCategories = [
  "FRESH_PRODUCE", "DAIRY_PRODUCTS", "MEAT_AND_SEAFOOD", "BAKERY_ITEMS",
  "PANTRY_STAPLES", "CANNED_AND_JARRED_GOODS", "SNACKS_AND_CONFECTIONERY",
  "FROZEN_FOODS", "BEVERAGES", "HOUSEHOLD_SUPPLIES", "PERSONAL_CARE_PRODUCTS",
  "BABY_PRODUCTS", "PET_SUPPLIES", "HEALTH_AND_WELLNESS", "INTERNATIONAL_FOODS",
  "MEDICINE", "OTHER",
] as const

export function categoryLabel(category: string) {
  return category.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase())
}
