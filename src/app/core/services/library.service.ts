import { Injectable, inject } from '@angular/core';
import {
  CustomFood,
  CustomFoodInput,
  FavoriteFood,
  FoodSnapshot,
  MealTemplate,
  MealTemplateInput,
  snapshotKey,
} from '../models/food.models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const NO_SB = 'Supabase is not configured.';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get client() {
    return this.supabase.client;
  }

  async listCustomFoods(): Promise<CustomFood[]> {
    const user = this.auth.user();
    if (!user || !this.client) return [];
    const { data, error } = await this.client
      .from('custom_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []).map((r) => this.mapCustom(r));
  }

  async addCustomFood(input: CustomFoodInput): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    if (!input.name.trim()) return 'Name is required';

    const { error } = await this.client.from('custom_foods').insert({
      user_id: user.id,
      name: input.name.trim(),
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
    });
    return error?.message ?? null;
  }

  async deleteCustomFood(id: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    const { error } = await this.client
      .from('custom_foods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    return error?.message ?? null;
  }

  async listFavorites(): Promise<FavoriteFood[]> {
    const user = this.auth.user();
    if (!user || !this.client) return [];
    const { data, error } = await this.client
      .from('favorite_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r['id']),
      userId: String(r['user_id']),
      snapshot: r['snapshot'] as FoodSnapshot,
      createdAt: String(r['created_at']),
    }));
  }

  async addFavorite(snapshot: FoodSnapshot): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    const existing = await this.listFavorites();
    if (existing.some((f) => snapshotKey(f.snapshot) === snapshotKey(snapshot))) {
      return 'Already in favorites';
    }
    const { error } = await this.client.from('favorite_foods').insert({
      user_id: user.id,
      snapshot,
    });
    return error?.message ?? null;
  }

  async deleteFavorite(id: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    const { error } = await this.client
      .from('favorite_foods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    return error?.message ?? null;
  }

  async listTemplates(): Promise<MealTemplate[]> {
    const user = this.auth.user();
    if (!user || !this.client) return [];
    const { data, error } = await this.client
      .from('meal_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: String(r['id']),
      userId: String(r['user_id']),
      name: String(r['name']),
      mealType: r['meal_type'] as MealTemplate['mealType'],
      items: (r['items'] as FoodSnapshot[]) ?? [],
      createdAt: String(r['created_at']),
    }));
  }

  async addTemplate(input: MealTemplateInput): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    if (!input.name.trim()) return 'Template name is required';
    if (!input.items.length) return 'Add at least one food to the template';

    const { error } = await this.client.from('meal_templates').insert({
      user_id: user.id,
      name: input.name.trim(),
      meal_type: input.mealType,
      items: input.items,
    });
    return error?.message ?? null;
  }

  async deleteTemplate(id: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.client) return NO_SB;
    const { error } = await this.client
      .from('meal_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    return error?.message ?? null;
  }

  private mapCustom(row: Record<string, unknown>): CustomFood {
    return {
      id: String(row['id']),
      userId: String(row['user_id']),
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
      createdAt: String(row['created_at'] ?? new Date().toISOString()),
    };
  }
}
