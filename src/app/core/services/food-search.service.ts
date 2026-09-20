import { Injectable, inject } from '@angular/core';
import { FoodSearchResult } from '../models/food.models';
import { searchIndianPresets } from '../data/indian-foods';
import { OpenFoodFactsService } from './open-food-facts.service';
import { UsdaService } from './usda.service';

@Injectable({ providedIn: 'root' })
export class FoodSearchService {
  private readonly off = inject(OpenFoodFactsService);
  private readonly usda = inject(UsdaService);

  /** Combined Indian presets + USDA + Open Food Facts. */
  async search(query: string): Promise<FoodSearchResult[]> {
    const q = query.trim();
    const indian = searchIndianPresets(q);

    if (q.length < 2) {
      return indian.slice(0, 20);
    }

    const [offResults, usdaResults] = await Promise.all([
      this.off.search(q, 12).catch(() => [] as FoodSearchResult[]),
      this.usda.search(q, 8).catch(() => [] as FoodSearchResult[]),
    ]);

    const merged: FoodSearchResult[] = [];
    const seen = new Set<string>();
    const push = (items: FoodSearchResult[]) => {
      for (const item of items) {
        const key = `${item.provider}|${item.name.toLowerCase()}|${item.brand ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    };

    push(indian);
    push(usdaResults);
    push(offResults);
    return merged.slice(0, 40);
  }

  listIndianPresets(query = ''): FoodSearchResult[] {
    return searchIndianPresets(query);
  }
}
