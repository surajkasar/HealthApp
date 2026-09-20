import { Injectable } from '@angular/core';
import { FoodSearchResult, NutritionBasis } from '../models/food.models';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  image_front_small_url?: string;
  serving_quantity?: string | number;
  serving_size?: string;
  quantity?: string;
  product_quantity?: string | number;
  product_quantity_unit?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

const BEVERAGE_TAG_HINTS = [
  'en:beverages',
  'en:carbonated-drinks',
  'en:sodas',
  'en:soft-drinks',
  'en:diet-beverages',
  'en:diet-sodas',
  'en:colas',
  'en:sweetened-beverages',
  'en:artificially-sweetened-beverages',
  'en:waters',
  'en:plant-based-beverages',
  'en:fruit-juices',
  'en:energy-drinks',
  'en:teas',
  'en:coffee-drinks',
];

@Injectable({ providedIn: 'root' })
export class OpenFoodFactsService {
  async search(query: string, pageSize = 20): Promise<FoodSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const url =
      `https://world.openfoodfacts.org/cgi/search.pl` +
      `?search_terms=${encodeURIComponent(q)}` +
      `&search_simple=1&action=process&json=1&page_size=${pageSize}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Food search failed. Check your network connection.');
    }
    const json = (await res.json()) as { products?: OffProduct[] };
    return (json.products ?? [])
      .map((p) => this.mapProduct(p))
      .filter((p): p is FoodSearchResult => !!p);
  }

  async getByBarcode(barcode: string): Promise<FoodSearchResult | null> {
    const code = barcode.trim();
    if (!code) return null;

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`
    );
    if (!res.ok) {
      throw new Error('Barcode lookup failed.');
    }
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) {
      return null;
    }
    return this.mapProduct(json.product);
  }

  scaleToPortion(
    item: FoodSearchResult,
    quantity: number
  ): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
    sugar: number;
  } {
    const factor = quantity / 100;
    return {
      calories: round1(item.caloriesPer100 * factor),
      protein: round1(item.proteinPer100 * factor),
      carbs: round1(item.carbsPer100 * factor),
      fat: round1(item.fatPer100 * factor),
      fiber: round1((item.fiberPer100 ?? 0) * factor),
      sodium: round1((item.sodiumPer100 ?? 0) * factor),
      sugar: round1((item.sugarPer100 ?? 0) * factor),
    };
  }

  private mapProduct(p: OffProduct): FoodSearchResult | null {
    const name = (p.product_name || p.product_name_en || '').trim();
    if (!name) return null;

    const n = p.nutriments ?? {};
    if (Object.keys(n).length === 0) {
      return null;
    }

    const has100ml = hasAny(n, [
      'energy-kcal_100ml',
      'proteins_100ml',
      'carbohydrates_100ml',
      'fat_100ml',
      'energy-kcal_prepared_100ml',
      'proteins_prepared_100ml',
      'carbohydrates_prepared_100ml',
      'fat_prepared_100ml',
    ]);
    const has100g = hasAny(n, [
      'energy-kcal_100g',
      'proteins_100g',
      'carbohydrates_100g',
      'fat_100g',
      'energy-kcal',
      'energy-kcal_prepared_100g',
      'proteins_prepared_100g',
      'carbohydrates_prepared_100g',
      'fat_prepared_100g',
      'energy-kcal_prepared',
    ]);

    // Some Indian soft drinks only store nutrition as *_prepared_* fields
    const hasPreparedOnly = !has100ml && !has100g && hasAny(n, [
      'energy-kcal_prepared',
      'energy-kcal_prepared_100g',
      'energy-kcal_prepared_100ml',
      'proteins_prepared',
      'proteins_prepared_100g',
      'carbohydrates_prepared_100g',
      'fat_prepared_100g',
    ]);

    if (!has100ml && !has100g && !hasPreparedOnly) {
      return null;
    }

    const isBeverage = has100ml || hasPreparedOnly || this.isBeverageProduct(p);
    const basis: NutritionBasis = isBeverage ? 'ml' : 'g';

    const macros =
      basis === 'ml'
        ? {
            calories: firstNum(n, [
              'energy-kcal_100ml',
              'energy-kcal_prepared_100ml',
              'energy-kcal_100g',
              'energy-kcal_prepared_100g',
              'energy-kcal_prepared',
              'energy-kcal',
            ]),
            protein: firstNum(n, [
              'proteins_100ml',
              'proteins_prepared_100ml',
              'proteins_100g',
              'proteins_prepared_100g',
              'proteins_prepared',
            ]),
            carbs: firstNum(n, [
              'carbohydrates_100ml',
              'carbohydrates_prepared_100ml',
              'carbohydrates_100g',
              'carbohydrates_prepared_100g',
              'carbohydrates_prepared',
            ]),
            fat: firstNum(n, [
              'fat_100ml',
              'fat_prepared_100ml',
              'fat_100g',
              'fat_prepared_100g',
              'fat_prepared',
            ]),
          }
        : {
            calories: firstNum(n, [
              'energy-kcal_100g',
              'energy-kcal_prepared_100g',
              'energy-kcal_prepared',
              'energy-kcal',
            ]),
            protein: firstNum(n, [
              'proteins_100g',
              'proteins_prepared_100g',
              'proteins_prepared',
            ]),
            carbs: firstNum(n, [
              'carbohydrates_100g',
              'carbohydrates_prepared_100g',
              'carbohydrates_prepared',
            ]),
            fat: firstNum(n, ['fat_100g', 'fat_prepared_100g', 'fat_prepared']),
          };

    const micros =
      basis === 'ml'
        ? {
            fiber: firstNum(n, [
              'fiber_100ml',
              'fibre_100ml',
              'fiber_prepared_100ml',
              'fiber_100g',
              'fibre_100g',
              'fiber_prepared_100g',
            ]),
            sodium: firstNum(n, [
              'sodium_100ml',
              'sodium_prepared_100ml',
              'sodium_100g',
              'sodium_prepared_100g',
            ]),
            sugar: firstNum(n, [
              'sugars_100ml',
              'sugars_prepared_100ml',
              'sugars_100g',
              'sugars_prepared_100g',
            ]),
          }
        : {
            fiber: firstNum(n, [
              'fiber_100g',
              'fibre_100g',
              'fiber_prepared_100g',
              'fibre_prepared_100g',
            ]),
            sodium: firstNum(n, ['sodium_100g', 'sodium_prepared_100g']),
            sugar: firstNum(n, ['sugars_100g', 'sugars_prepared_100g']),
          };

    // sodium often stored as g — convert to mg when clearly grams
    let sodiumMg = micros.sodium;
    if (sodiumMg > 0 && sodiumMg < 1) {
      sodiumMg = round1(sodiumMg * 1000);
    }

    const serving = this.resolveServing(p, basis);

    return {
      id: p.code || `${name}-${p.brands ?? ''}`,
      name,
      brand: p.brands?.trim() || undefined,
      nutritionBasis: basis,
      caloriesPer100: macros.calories,
      proteinPer100: macros.protein,
      carbsPer100: macros.carbs,
      fatPer100: macros.fat,
      fiberPer100: micros.fiber,
      sodiumPer100: sodiumMg,
      sugarPer100: micros.sugar,
      servingSize: serving.size,
      servingUnit: serving.unit,
      barcode: p.code,
      imageUrl: p.image_front_small_url,
      provider: 'openfoodfacts',
    };
  }


  private isBeverageProduct(p: OffProduct): boolean {
    const tags = (p.categories_tags ?? []).map((t) => t.toLowerCase());
    if (tags.some((t) => BEVERAGE_TAG_HINTS.some((h) => t === h || t.includes(h)))) {
      return true;
    }

    const unitHints = [
      p.product_quantity_unit,
      p.serving_size,
      p.quantity,
      String(p.serving_quantity ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/\b(ml|millilitre|milliliter|l|litre|liter|cl|fl\.?\s*oz)\b/.test(unitHints)) {
      return true;
    }

    const name = `${p.product_name ?? ''} ${p.product_name_en ?? ''}`.toLowerCase();
    return /\b(cola|soda|soft drink|beverage|juice|water|drink|tea|coffee|energy drink)\b/.test(
      name
    );
  }

  private resolveServing(
    p: OffProduct,
    basis: NutritionBasis
  ): { size: number; unit: NutritionBasis } {
    const fromServingSize = parseVolumeOrMass(p.serving_size);
    if (fromServingSize && fromServingSize.unit === basis) {
      return fromServingSize;
    }

    const fromQuantity = parseVolumeOrMass(p.quantity);
    if (fromQuantity && fromQuantity.unit === basis) {
      return fromQuantity;
    }

    const qtyNum = num(p.serving_quantity);
    const unitHint = (p.product_quantity_unit ?? '').toLowerCase();
    if (qtyNum > 0) {
      if (basis === 'ml') {
        if (unitHint === 'l' || unitHint === 'litre' || unitHint === 'liter') {
          return { size: qtyNum * 1000, unit: 'ml' };
        }
        return { size: qtyNum, unit: 'ml' };
      }
      return { size: qtyNum, unit: 'g' };
    }

    if (fromServingSize) {
      // Convert mismatched units when possible (ml↔g ≈ 1 for drinks)
      if (basis === 'ml' && fromServingSize.unit === 'g') {
        return { size: fromServingSize.size, unit: 'ml' };
      }
      if (basis === 'g' && fromServingSize.unit === 'ml') {
        return { size: fromServingSize.size, unit: 'g' };
      }
    }

    return basis === 'ml' ? { size: 250, unit: 'ml' } : { size: 100, unit: 'g' };
  }
}

function hasAny(
  n: Record<string, number | string | undefined>,
  keys: string[]
): boolean {
  return keys.some((k) => n[k] !== undefined && n[k] !== null && n[k] !== '');
}

/** First defined key (including explicit 0). */
function firstNum(
  n: Record<string, number | string | undefined>,
  keys: string[]
): number {
  for (const k of keys) {
    const v = n[k];
    if (v !== undefined && v !== null && v !== '') {
      return num(v);
    }
  }
  return 0;
}

function parseVolumeOrMass(
  raw?: string
): { size: number; unit: NutritionBasis } | null {
  if (!raw) return null;
  const text = raw.toLowerCase().replace(',', '.');
  const ml = text.match(/(\d+(?:\.\d+)?)\s*(ml|millilitre|milliliter)\b/);
  if (ml) return { size: parseFloat(ml[1]), unit: 'ml' };
  const cl = text.match(/(\d+(?:\.\d+)?)\s*cl\b/);
  if (cl) return { size: parseFloat(cl[1]) * 10, unit: 'ml' };
  const lit = text.match(/(\d+(?:\.\d+)?)\s*(l|litre|liter)\b/);
  if (lit) return { size: parseFloat(lit[1]) * 1000, unit: 'ml' };
  const g = text.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams)\b/);
  if (g) return { size: parseFloat(g[1]), unit: 'g' };
  const kg = text.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg) return { size: parseFloat(kg[1]) * 1000, unit: 'g' };
  return null;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
