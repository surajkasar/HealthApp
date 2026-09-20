export const environment = {
  production: false,
  /** Prefer Supabase for phone ↔ laptop sync when URL + anon key are set. */
  useSupabase: true,
  supabaseUrl: '',
  supabaseAnonKey: '',
  /** Free USDA key from https://fdc.nal.usda.gov/api-key-signup.html — DEMO_KEY works with limits */
  usdaApiKey: 'DEMO_KEY',
  timezone: 'Asia/Kolkata',
};
