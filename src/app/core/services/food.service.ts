import { Injectable, inject } from '@angular/core';
import {
  DayNutritionSummary,
  FoodEntry,
  FoodEntryInput,
  FoodSnapshot,
  MacroTotals,
  MealType,
  StreakStats,
  entryToSnapshot,
  snapshotKey,
} from '../models/food.models';
import { dateRangeEnding, shiftDate, todayInAppTz } from '../utils/date.util';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const NO_SB = 'Supabase is not configured.';

@Injectable({ providedIn: 'root' })
export class FoodService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get client() {
    return this.supabase.client;
  }

  async getEntriesForDate(date: string): Promise<FoodEntry[]> {
    const user = this.auth.user();
    if (!user || !this.client) return [];

    const { data, error } = await this.client
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('logged_date', date)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []).map((row) => this.mapEntry(row));
  }

  async getEntriesInRange(from: string, to: string): Promise<FoodEntry[]> {
    const user = this.auth.user();
    if (!user || !this.client) return [];

    const { data, error } = await this.client
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_date', from)
      .lte('logged_date', to)
      .order('logged_date', { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []).map((row) => this.mapEntry(row));
  }

  async getRecentFoods(days = 7, limit = 20): Promise<FoodSnapshot[]> {
    const to = todayInAppTz();
    const from = shiftDate(to, -(days - 1));
    const entries = await this.getEntriesInRange(from, to);
    const map = new Map<string, FoodSnapshot>();
    const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const e of sorted) {
      const snap = entryToSnapshot(e);
      const key = snapshotKey(snap);
      if (!map.has(key)) map.set(key, snap);
      if (map.size >= limit) break;
    }
    return [...map.values()];
  }

  async getDailySummaries(dates: string[]): Promise<DayNutritionSummary[]> {
    if (dates.length === 0) return [];
    const from = dates[0];
    const to = dates[dates.length - 1];
    const entries = await this.getEntriesInRange(from, to);
    const byDate = new Map<string, FoodEntry[]>();
    for (const d of dates) byDate.set(d, []);
    for (const e of entries) {
      byDate.get(e.loggedDate)?.push(e);
    }

    return dates.map((date) => {
      const dayEntries = byDate.get(date) ?? [];
      const totals = this.sumMacros(dayEntries);
      const mealCalories: Record<MealType, number> = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        snack: 0,
      };
      for (const e of dayEntries) {
        mealCalories[e.mealType] += Number(e.calories);
      }
      return {
        date,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        sodium: totals.sodium,
        sugar: totals.sugar,
        mealCalories,
      };
    });
  }

  async getStreakStats(calorieTarget: number): Promise<StreakStats> {
    const today = todayInAppTz();
    const lookback = dateRangeEnding(today, 60);
    const summaries = await this.getDailySummaries(lookback);
    const onTarget = (s: { calories: number }) =>
      s.calories > 0 && s.calories <= calorieTarget + 50;

    let currentStreak = 0;
    for (let i = summaries.length - 1; i >= 0; i--) {
      const s = summaries[i];
      if (s.calories === 0) {
        if (s.date === today) continue;
        break;
      }
      if (onTarget(s)) currentStreak++;
      else break;
    }

    const weekDates = dateRangeEnding(today, 7);
    const weekOnTarget = summaries
      .filter((s) => weekDates.includes(s.date))
      .filter(onTarget).length;

    return {
      currentStreak,
      weekOnTarget,
      weekDays: 7,
      scoreLabel: `${weekOnTarget}/7 days on target`,
    };
  }

  async getRecentDates(limit = 14): Promise<string[]> {
    const user = this.auth.user();
    if (!user || !this.client) return [];

    const { data, error } = await this.client
      .from('food_entries')
      .select('logged_date')
      .eq('user_id', user.id)
      .order('logged_date', { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      return [];
    }
    return [...new Set((data ?? []).map((r) => String(r.logged_date)))].slice(0, limit);
  }

  async addEntry(input: FoodEntryInput): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;

    const { error } = await this.client.from('food_entries').insert(this.toRow(user.id, input));
    return error?.message ?? null;
  }

  async addEntries(inputs: FoodEntryInput[]): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    if (!inputs.length) return null;

    const { error } = await this.client
      .from('food_entries')
      .insert(inputs.map((i) => this.toRow(user.id, i)));
    return error?.message ?? null;
  }

  async copyDay(fromDate: string, toDate: string, mealType?: MealType): Promise<string | null> {
    const entries = await this.getEntriesForDate(fromDate);
    const filtered = mealType ? entries.filter((e) => e.mealType === mealType) : entries;
    if (!filtered.length) {
      return mealType
        ? `No ${mealType} items on ${fromDate}`
        : `No meals found on ${fromDate}`;
    }
    return this.addEntries(
      filtered.map((e) => ({
        loggedDate: toDate,
        mealType: e.mealType,
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
        source: 'copy' as const,
      }))
    );
  }

  async applySnapshots(
    toDate: string,
    mealType: MealType,
    items: FoodSnapshot[],
    source: FoodEntryInput['source']
  ): Promise<string | null> {
    return this.addEntries(
      items.map((s) => ({
        loggedDate: toDate,
        mealType,
        name: s.name,
        brand: s.brand,
        calories: s.calories,
        protein: s.protein,
        carbs: s.carbs,
        fat: s.fat,
        fiber: s.fiber,
        sodium: s.sodium,
        sugar: s.sugar,
        servingQty: s.servingQty,
        servingUnit: s.servingUnit,
        barcode: s.barcode,
        source,
      }))
    );
  }

  async deleteEntry(id: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;

    const { error } = await this.client
      .from('food_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    return error?.message ?? null;
  }

  sumMacros(entries: FoodEntry[]): MacroTotals {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + Number(e.calories),
        protein: acc.protein + Number(e.protein),
        carbs: acc.carbs + Number(e.carbs),
        fat: acc.fat + Number(e.fat),
        fiber: acc.fiber + Number(e.fiber ?? 0),
        sodium: acc.sodium + Number(e.sodium ?? 0),
        sugar: acc.sugar + Number(e.sugar ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 }
    );
  }

  macroCalorieSplit(totals: Pick<MacroTotals, 'protein' | 'carbs' | 'fat'>): {
    protein: number;
    carbs: number;
    fat: number;
  } {
    return {
      protein: totals.protein * 4,
      carbs: totals.carbs * 4,
      fat: totals.fat * 9,
    };
  }

  private toRow(userId: string, input: FoodEntryInput): Record<string, unknown> {
    return {
      user_id: userId,
      logged_date: input.loggedDate,
      meal_type: input.mealType,
      name: input.name,
      brand: input.brand ?? null,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber: input.fiber ?? 0,
      sodium: input.sodium ?? 0,
      sugar: input.sugar ?? 0,
      serving_qty: input.servingQty,
      serving_unit: input.servingUnit,
      barcode: input.barcode ?? null,
      source: input.source,
    };
  }

  private mapEntry(row: Record<string, unknown>): FoodEntry {
    return {
      id: String(row['id']),
      userId: String(row['user_id']),
      loggedDate: String(row['logged_date']),
      mealType: row['meal_type'] as FoodEntry['mealType'],
      name: String(row['name']),
      brand: (row['brand'] as string | null) ?? null,
      calories: Number(row['calories'] ?? 0),
      protein: Number(row['protein'] ?? 0),
      carbs: Number(row['carbs'] ?? 0),
      fat: Number(row['fat'] ?? 0),
      fiber: Number(row['fiber'] ?? 0),
      sodium: Number(row['sodium'] ?? 0),
      sugar: Number(row['sugar'] ?? 0),
      servingQty: Number(row['serving_qty'] ?? 1),
      servingUnit: String(row['serving_unit'] ?? 'serving'),
      barcode: (row['barcode'] as string | null) ?? null,
      source: (row['source'] as FoodEntry['source']) ?? 'manual',
      createdAt: String(row['created_at'] ?? new Date().toISOString()),
    };
  }
}
