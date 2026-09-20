export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FoodSource =
  | 'manual'
  | 'openfoodfacts'
  | 'barcode'
  | 'quick'
  | 'custom'
  | 'favorite'
  | 'template'
  | 'usda'
  | 'indian'
  | 'copy';

export interface MacroTargets {
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

export interface Profile extends MacroTargets {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
}

export interface NutritionMicros {
  fiber: number;
  sodium: number; // mg
  sugar: number;
}

export interface FoodEntry {
  id: string;
  userId: string;
  loggedDate: string;
  mealType: MealType;
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  servingQty: number;
  servingUnit: string;
  barcode?: string | null;
  source: FoodSource;
  createdAt: string;
}

export interface FoodEntryInput {
  loggedDate: string;
  mealType: MealType;
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
  servingQty: number;
  servingUnit: string;
  barcode?: string | null;
  source: FoodSource;
}

export type NutritionBasis = 'g' | 'ml';

export interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  nutritionBasis: NutritionBasis;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100?: number;
  sodiumPer100?: number;
  sugarPer100?: number;
  servingSize: number;
  servingUnit: NutritionBasis | string;
  barcode?: string;
  imageUrl?: string;
  provider?: 'openfoodfacts' | 'usda' | 'indian' | 'custom';
}

export interface MacroTotals extends NutritionMicros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CustomFood {
  id: string;
  userId: string;
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  servingQty: number;
  servingUnit: string;
  createdAt: string;
}

export interface CustomFoodInput {
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
  servingQty: number;
  servingUnit: string;
}

/** Snapshot used for favorites / template items / one-tap re-add */
export interface FoodSnapshot {
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  servingQty: number;
  servingUnit: string;
  barcode?: string | null;
  source: FoodSource;
}

export interface FavoriteFood {
  id: string;
  userId: string;
  snapshot: FoodSnapshot;
  createdAt: string;
}

export interface MealTemplate {
  id: string;
  userId: string;
  name: string;
  mealType: MealType;
  items: FoodSnapshot[];
  createdAt: string;
}

export interface MealTemplateInput {
  name: string;
  mealType: MealType;
  items: FoodSnapshot[];
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const DEFAULT_TARGETS: MacroTargets = {
  calorieTarget: 2000,
  proteinTarget: 150,
  carbsTarget: 200,
  fatTarget: 65,
};

export interface WeightEntry {
  id: string;
  userId: string;
  loggedDate: string;
  weightKg: number;
  note?: string | null;
  createdAt: string;
}

export interface WeightEntryInput {
  loggedDate: string;
  weightKg: number;
  note?: string | null;
}

export interface DayNutritionSummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  mealCalories: Record<MealType, number>;
}

export interface StreakStats {
  currentStreak: number;
  weekOnTarget: number;
  weekDays: number;
  scoreLabel: string;
}

export function entryToSnapshot(e: FoodEntry): FoodSnapshot {
  return {
    name: e.name,
    brand: e.brand,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber: e.fiber ?? 0,
    sodium: e.sodium ?? 0,
    sugar: e.sugar ?? 0,
    servingQty: e.servingQty,
    servingUnit: e.servingUnit,
    barcode: e.barcode,
    source: e.source === 'copy' ? 'manual' : e.source,
  };
}

export function snapshotKey(s: FoodSnapshot): string {
  return [
    s.name.trim().toLowerCase(),
    (s.brand ?? '').trim().toLowerCase(),
    s.calories,
    s.servingQty,
    s.servingUnit,
  ].join('|');
}
