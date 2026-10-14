import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@compences/supabase';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env. See .env.example.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // The session has to survive the app being killed, so it goes to disk.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no URL bar in a native app; the OAuth code is exchanged by hand
    // after the in-app browser closes (see useAuth).
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * Supabase refreshes tokens on a timer. That timer should not run while the
 * app is backgrounded — iOS suspends it anyway, and the failed refreshes show
 * up as spurious auth errors on resume.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
