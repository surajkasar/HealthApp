import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { DEFAULT_TARGETS, Profile } from '../models/food.models';
import { SupabaseService } from './supabase.service';

const CONFIG_ERROR =
  'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env (local) or Vercel env vars (see SUPABASE.md).';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly ready = signal(false);
  readonly configured = this.supabase.enabled;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    if (!this.supabase.client) {
      this.ready.set(true);
      return;
    }

    const { data } = await this.supabase.client.auth.getSession();
    if (data.session?.user) {
      this.user.set(data.session.user);
      await this.loadProfile(data.session.user.id, data.session.user.email ?? '');
    }
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        this.user.set(session.user);
        void this.loadProfile(session.user.id, session.user.email ?? '');
      } else {
        this.user.set(null);
        this.profile.set(null);
      }
    });
    this.ready.set(true);
  }

  async signUp(email: string, password: string, displayName?: string): Promise<string | null> {
    if (!this.supabase.client) return CONFIG_ERROR;
    const { error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName ?? email.split('@')[0] } },
    });
    return error?.message ?? null;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    if (!this.supabase.client) return CONFIG_ERROR;
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });
    return error?.message ?? null;
  }

  async signOut(): Promise<void> {
    if (this.supabase.client) {
      await this.supabase.client.auth.signOut();
    }
    this.user.set(null);
    this.profile.set(null);
    await this.router.navigateByUrl('/login');
  }

  async refreshProfile(): Promise<void> {
    const u = this.user();
    if (!u) return;
    await this.loadProfile(u.id, u.email ?? '');
  }

  async updateTargets(targets: {
    calorieTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
  }): Promise<string | null> {
    const u = this.user();
    if (!u) return 'Not signed in';
    if (!this.supabase.client) return CONFIG_ERROR;

    const { error } = await this.supabase.client
      .from('profiles')
      .update({
        calorie_target: targets.calorieTarget,
        protein_target: targets.proteinTarget,
        carbs_target: targets.carbsTarget,
        fat_target: targets.fatTarget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.id);
    if (error) return error.message;
    await this.loadProfile(u.id, u.email ?? '');
    return null;
  }

  private async loadProfile(userId: string, email: string): Promise<void> {
    if (!this.supabase.client) return;

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    if (!data) {
      const { data: created } = await this.supabase.client
        .from('profiles')
        .insert({
          id: userId,
          email,
          display_name: email.split('@')[0],
        })
        .select('*')
        .single();
      if (created) this.profile.set(this.mapProfile(created));
      return;
    }

    this.profile.set(this.mapProfile(data));
  }

  private mapProfile(row: Record<string, unknown>): Profile {
    return {
      id: String(row['id']),
      email: String(row['email'] ?? ''),
      displayName: String(row['display_name'] ?? 'You'),
      calorieTarget: Number(row['calorie_target'] ?? DEFAULT_TARGETS.calorieTarget),
      proteinTarget: Number(row['protein_target'] ?? DEFAULT_TARGETS.proteinTarget),
      carbsTarget: Number(row['carbs_target'] ?? DEFAULT_TARGETS.carbsTarget),
      fatTarget: Number(row['fat_target'] ?? DEFAULT_TARGETS.fatTarget),
      timezone: String(row['timezone'] ?? 'Asia/Kolkata'),
    };
  }
}
