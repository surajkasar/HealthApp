import { Injectable, inject } from '@angular/core';
import { WeightEntry, WeightEntryInput } from '../models/food.models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const NO_SB = 'Supabase is not configured.';

@Injectable({ providedIn: 'root' })
export class WeightService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async list(limit = 90): Promise<WeightEntry[]> {
    const user = this.auth.user();
    if (!user || !this.supabase.client) return [];

    const { data, error } = await this.supabase.client
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error(error);
      return [];
    }
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async add(input: WeightEntryInput): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.supabase.client) return NO_SB;
    if (!(input.weightKg > 0) || input.weightKg > 500) {
      return 'Enter a valid weight in kg.';
    }

    const { error } = await this.supabase.client.from('weight_entries').insert({
      user_id: user.id,
      logged_date: input.loggedDate,
      weight_kg: input.weightKg,
      note: input.note ?? null,
    });
    return error?.message ?? null;
  }

  async delete(id: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    if (!this.supabase.client) return NO_SB;

    const { error } = await this.supabase.client
      .from('weight_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    return error?.message ?? null;
  }

  private mapRow(row: Record<string, unknown>): WeightEntry {
    return {
      id: String(row['id']),
      userId: String(row['user_id']),
      loggedDate: String(row['logged_date']),
      weightKg: Number(row['weight_kg'] ?? 0),
      note: (row['note'] as string | null) ?? null,
      createdAt: String(row['created_at'] ?? new Date().toISOString()),
    };
  }
}
