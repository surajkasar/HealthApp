import { FoodSearchResult } from '../models/food.models';

/** Curated Indian foods — values are per listed serving (approx.). */
export interface IndianPreset {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  servingQty: number;
  servingUnit: string;
}

export const INDIAN_FOOD_PRESETS: IndianPreset[] = [
  { id: 'in-roti', name: 'Roti / Chapati', calories: 120, protein: 3.5, carbs: 18, fat: 3.5, fiber: 2.5, sodium: 150, sugar: 0.5, servingQty: 1, servingUnit: 'piece (40g)' },
  { id: 'in-paratha', name: 'Plain Paratha', calories: 260, protein: 5, carbs: 30, fat: 13, fiber: 3, sodium: 280, sugar: 1, servingQty: 1, servingUnit: 'piece' },
  { id: 'in-naan', name: 'Butter Naan', calories: 320, protein: 8, carbs: 45, fat: 12, fiber: 2, sodium: 400, sugar: 3, servingQty: 1, servingUnit: 'piece' },
  { id: 'in-rice', name: 'Steamed Rice', calories: 200, protein: 4, carbs: 45, fat: 0.5, fiber: 0.6, sodium: 5, sugar: 0, servingQty: 1, servingUnit: 'cup (150g)' },
  { id: 'in-dal', name: 'Dal (cooked)', calories: 180, protein: 12, carbs: 28, fat: 2, fiber: 8, sodium: 350, sugar: 2, servingQty: 1, servingUnit: 'bowl (200g)' },
  { id: 'in-sambar', name: 'Sambar', calories: 140, protein: 6, carbs: 20, fat: 4, fiber: 5, sodium: 500, sugar: 3, servingQty: 1, servingUnit: 'bowl' },
  { id: 'in-idli', name: 'Idli', calories: 60, protein: 2, carbs: 12, fat: 0.2, fiber: 0.8, sodium: 120, sugar: 0.2, servingQty: 1, servingUnit: 'piece' },
  { id: 'in-dosa', name: 'Plain Dosa', calories: 170, protein: 4, carbs: 28, fat: 4.5, fiber: 1.5, sodium: 200, sugar: 0.5, servingQty: 1, servingUnit: 'piece' },
  { id: 'in-masala-dosa', name: 'Masala Dosa', calories: 280, protein: 6, carbs: 40, fat: 10, fiber: 3, sodium: 350, sugar: 1, servingQty: 1, servingUnit: 'piece' },
  { id: 'in-poha', name: 'Poha', calories: 250, protein: 5, carbs: 40, fat: 8, fiber: 3, sodium: 400, sugar: 2, servingQty: 1, servingUnit: 'plate' },
  { id: 'in-upma', name: 'Upma', calories: 220, protein: 5, carbs: 35, fat: 7, fiber: 3, sodium: 450, sugar: 1, servingQty: 1, servingUnit: 'bowl' },
  { id: 'in-paneer', name: 'Paneer (cubed)', calories: 265, protein: 18, carbs: 1.5, fat: 21, fiber: 0, sodium: 20, sugar: 1.5, servingQty: 100, servingUnit: 'g' },
  { id: 'in-palak-paneer', name: 'Palak Paneer', calories: 320, protein: 14, carbs: 10, fat: 24, fiber: 4, sodium: 550, sugar: 3, servingQty: 1, servingUnit: 'bowl' },
  { id: 'in-butter-chicken', name: 'Butter Chicken', calories: 400, protein: 28, carbs: 12, fat: 26, fiber: 2, sodium: 700, sugar: 6, servingQty: 1, servingUnit: 'bowl' },
  { id: 'in-chole', name: 'Chole / Chickpea curry', calories: 280, protein: 12, carbs: 35, fat: 10, fiber: 9, sodium: 500, sugar: 5, servingQty: 1, servingUnit: 'bowl' },
  { id: 'in-rajma', name: 'Rajma', calories: 260, protein: 13, carbs: 35, fat: 7, fiber: 10, sodium: 480, sugar: 4, servingQty: 1, servingUnit: 'bowl' },
  { id: 'in-curd', name: 'Curd / Dahi', calories: 100, protein: 5, carbs: 7, fat: 5, fiber: 0, sodium: 70, sugar: 7, servingQty: 1, servingUnit: 'bowl (150g)' },
  { id: 'in-lassi', name: 'Sweet Lassi', calories: 220, protein: 6, carbs: 35, fat: 6, fiber: 0, sodium: 80, sugar: 30, servingQty: 1, servingUnit: 'glass (250ml)' },
  { id: 'in-chai', name: 'Masala Chai with milk', calories: 90, protein: 2.5, carbs: 12, fat: 3.5, fiber: 0, sodium: 40, sugar: 10, servingQty: 1, servingUnit: 'cup' },
  { id: 'in-samosa', name: 'Samosa', calories: 260, protein: 4, carbs: 28, fat: 15, fiber: 2, sodium: 350, sugar: 1, servingQty: 1, servingUnit: 'piece' },
  { id: 'in-pakora', name: 'Vegetable Pakora', calories: 180, protein: 4, carbs: 16, fat: 11, fiber: 2, sodium: 300, sugar: 1, servingQty: 3, servingUnit: 'pieces' },
  { id: 'in-egg-bhurji', name: 'Egg Bhurji', calories: 220, protein: 14, carbs: 4, fat: 16, fiber: 1, sodium: 400, sugar: 2, servingQty: 2, servingUnit: 'eggs' },
  { id: 'in-omelette', name: 'Masala Omelette', calories: 200, protein: 13, carbs: 3, fat: 15, fiber: 0.5, sodium: 350, sugar: 1, servingQty: 2, servingUnit: 'eggs' },
  { id: 'in-banana', name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, fiber: 3, sodium: 1, sugar: 14, servingQty: 1, servingUnit: 'medium' },
  { id: 'in-apple', name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4, sodium: 2, sugar: 19, servingQty: 1, servingUnit: 'medium' },
  { id: 'in-peanut-chikki', name: 'Peanut Chikki', calories: 150, protein: 4, carbs: 18, fat: 7, fiber: 1.5, sodium: 20, sugar: 14, servingQty: 1, servingUnit: 'piece (30g)' },
];

export function indianPresetToSearchResult(p: IndianPreset): FoodSearchResult {
  // Treat serving as "per 100 of unit" style for scale: we store absolute per serving
  // and use servingSize=100 so scaleToPortion(qty) with qty=100 returns full serving.
  // Better: expose as per-serving with servingSize = servingQty and basis that scale uses /100.
  // For presets we use a fixed trick: caloriesPer100 = value, servingSize = 100 means 1 serving.
  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? 'Indian staple',
    nutritionBasis: 'g',
    caloriesPer100: p.calories,
    proteinPer100: p.protein,
    carbsPer100: p.carbs,
    fatPer100: p.fat,
    fiberPer100: p.fiber,
    sodiumPer100: p.sodium,
    sugarPer100: p.sugar,
    servingSize: 100,
    servingUnit: p.servingUnit,
    provider: 'indian',
  };
}

export function searchIndianPresets(query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return INDIAN_FOOD_PRESETS.map(indianPresetToSearchResult);
  }
  return INDIAN_FOOD_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.id.includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q)
  ).map(indianPresetToSearchResult);
}
