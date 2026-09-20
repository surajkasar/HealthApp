import { Injectable } from '@angular/core';
import { FoodSearchResult } from '../models/food.models';
import { environment } from '../../../environments/environment';

interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  foodNutrients?: { nutrientName?: string; value?: number; unitName?: string }[];
}

@Injectable({ providedIn: 'root' })
export class UsdaService {
  private readonly apiKey = environment.usdaApiKey || 'DEMO_KEY';

  async search(query: string, pageSize = 10): Promise<FoodSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search` +
      `?api_key=${encodeURIComponent(this.apiKey)}` +
      `&query=${encodeURIComponent(q)}` +
      `&pageSize=${pageSize}&dataType=Foundation,SR Legacy,Survey (FNDDS)`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = (await res.json()) as { foods?: UsdaFood[] };
      return (json.foods ?? [])
        .map((f) => this.mapFood(f))
        .filter((f): f is FoodSearchResult => !!f);
    } catch {
      return [];
    }
  }

  private mapFood(f: UsdaFood): FoodSearchResult | null {
    const name = (f.description ?? '').trim();
    if (!name || !f.fdcId) return null;
    const nutrients = f.foodNutrients ?? [];
    const get = (...names: string[]) => {
      for (const n of names) {
        const hit = nutrients.find(
          (x) => (x.nutrientName ?? '').toLowerCase() === n.toLowerCase()
        );
        if (hit && typeof hit.value === 'number') return hit.value;
      }
      return 0;
    };

    const calories = get('Energy');
    const protein = get('Protein');
    const carbs = get('Carbohydrate, by difference');
    const fat = get('Total lipid (fat)');
    const fiber = get('Fiber, total dietary');
    const sugar = get('Sugars, total including NLEA', 'Total Sugars');
    let sodium = get('Sodium, Na');
    // USDA sodium is typically mg already

    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
      return null;
    }

    return {
      id: `usda-${f.fdcId}`,
      name,
      brand: f.brandOwner || 'USDA',
      nutritionBasis: 'g',
      caloriesPer100: calories,
      proteinPer100: protein,
      carbsPer100: carbs,
      fatPer100: fat,
      fiberPer100: fiber,
      sodiumPer100: sodium,
      sugarPer100: sugar,
      servingSize: 100,
      servingUnit: 'g',
      provider: 'usda',
    };
  }
}
