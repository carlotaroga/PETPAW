(function bootstrapSupabase(global) {
  if (global.PETPAW_SUPABASE) {
    return;
  }

  const fallbackConfig = {
    url: 'https://hfwkaedcpvpfccwbcrie.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'
  };

  const runtimeConfig = global.PETPAW_SUPABASE_SETTINGS || {};
  const supabaseUrl = runtimeConfig.url || fallbackConfig.url;
  const supabaseAnonKey = runtimeConfig.anonKey || fallbackConfig.anonKey;

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    console.error('[PETPAW] Supabase CDN no esta cargado.');
    return;
  }

  global.PETPAW_SUPABASE = global.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  global.getPetpawSupabase = function getPetpawSupabase() {
    return global.PETPAW_SUPABASE;
  };
})(window);
