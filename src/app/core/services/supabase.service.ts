import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly enabled =
    environment.useSupabase &&
    !!environment.supabaseUrl &&
    !!environment.supabaseAnonKey &&
    !environment.supabaseUrl.includes('YOUR_SUPABASE');

  readonly client: SupabaseClient | null = this.enabled
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
    : null;
}
