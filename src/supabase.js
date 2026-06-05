import { createClient } from '@supabase/supabase-js';

// The Supabase client — the single connection point between the app and your
// cloud database/auth. The URL and key come from environment variables (the
// .env file locally, and Vercel's project settings once deployed), so no
// secrets are hardcoded here.
//
// Vite exposes only variables prefixed with VITE_ to the browser.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // A clear console message beats a cryptic failure if the .env is missing.
  console.error(
    'Supabase env vars missing. Check that .env defines VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY, and restart the dev server after editing .env.'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // Keep the user logged in across refreshes and app restarts, and refresh
    // the session token automatically in the background.
    persistSession: true,
    autoRefreshToken: true
  }
});

// Convenience: is sync configured at all? (Used to hide sync UI if someone
// runs the app without Supabase set up — keeps local-only mode working.)
export const syncEnabled = Boolean(url && key);