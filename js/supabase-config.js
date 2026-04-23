/* Crea y expone un cliente global de Supabase reutilizable en toda la app. */
(function bootstrapSupabase(global) {
  if (global.PETPAW_SUPABASE) {
    return;
  }

  /* Usa esta configuración si no se ha inyectado una en tiempo de ejecución. */
  const fallbackConfig = {
    url: 'https://hfwkaedcpvpfccwbcrie.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'
  };

  /* Prioriza una configuración externa antes de crear el cliente compartido. */
  const runtimeConfig = global.PETPAW_SUPABASE_SETTINGS || {};
  const supabaseUrl = runtimeConfig.url || fallbackConfig.url;
  const supabaseAnonKey = runtimeConfig.anonKey || fallbackConfig.anonKey;

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    console.error('[PETPAW] Supabase CDN no esta cargado.');
    return;
  }

  /* Mantiene la sesión del usuario para no tener que recrearla en cada página. */
  global.PETPAW_SUPABASE = global.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  /* Deja un acceso sencillo al cliente desde otros scripts. */
  global.getPetpawSupabase = function getPetpawSupabase() {
    return global.PETPAW_SUPABASE;
  };
})(window);
