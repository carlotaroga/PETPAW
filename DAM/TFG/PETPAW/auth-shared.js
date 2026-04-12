(function bootstrapAuthHelpers(global) {
  const PENDING_PROFILE_KEY = 'petpaw_pending_profile_v1';

  function getSupabaseClient() {
    const client = global.PETPAW_SUPABASE;

    if (!client) {
      throw new Error('No se encontro el cliente de Supabase. Revisa supabase-config.js.');
    }

    return client;
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function formatAuthError(error) {
    if (!error) return 'Ha ocurrido un error inesperado.';

    const message = String(error.message || '').toLowerCase();

    if (message.includes('invalid login credentials')) {
      return 'Email o contrasena incorrectos.';
    }

    if (message.includes('email not confirmed')) {
      return 'Debes confirmar tu email antes de iniciar sesion.';
    }

    if (message.includes('user already registered')) {
      return 'Este email ya esta registrado.';
    }

    if (message.includes('password should be at least')) {
      return 'La contrasena es demasiado corta.';
    }

    if (message.includes('failed to fetch')) {
      return 'No se pudo conectar con Supabase. Revisa tu conexion.';
    }

    return error.message || 'Ha ocurrido un error inesperado.';
  }

  function getRedirectTarget(defaultTarget) {
    const params = new URLSearchParams(global.location.search);
    const redirect = normalizeText(params.get('redirect'));

    if (!redirect) {
      return defaultTarget;
    }

    if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
      return defaultTarget;
    }

    if (redirect.startsWith('//')) {
      return defaultTarget;
    }

    return redirect;
  }

  function setButtonLoadingState(button, isLoading, loadingText) {
    if (!button) return;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent || '';
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
  }

  function getPendingStore() {
    try {
      const raw = global.localStorage.getItem(PENDING_PROFILE_KEY);
      if (!raw) return {};

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (error) {
      console.error('[PETPAW] Error leyendo pending profile:', error);
      return {};
    }
  }

  function savePendingStore(store) {
    try {
      global.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(store));
    } catch (error) {
      console.error('[PETPAW] Error guardando pending profile:', error);
    }
  }

  function buildPendingKeys({ id, email }) {
    const keys = [];
    const normalizedEmail = normalizeText(email).toLowerCase();

    if (id) {
      keys.push(`id:${id}`);
    }

    if (normalizedEmail) {
      keys.push(`email:${normalizedEmail}`);
    }

    return keys;
  }

  function savePendingProfile(profile, id) {
    const normalizedEmail = normalizeText(profile?.email).toLowerCase();
    if (!normalizedEmail) return;

    const payload = {
      name: normalizeText(profile?.name),
      surnames: normalizeText(profile?.surnames),
      email: normalizedEmail,
      phone: normalizeText(profile?.phone),
      role: normalizeText(profile?.role) || 'client',
      id: id || null
    };

    const store = getPendingStore();
    buildPendingKeys({ id: payload.id, email: payload.email }).forEach((key) => {
      store[key] = payload;
    });
    savePendingStore(store);
  }

  function getPendingProfile({ id, email }) {
    const store = getPendingStore();
    const keys = buildPendingKeys({ id, email });

    for (const key of keys) {
      if (store[key]) {
        return store[key];
      }
    }

    return null;
  }

  function clearPendingProfile({ id, email }) {
    const store = getPendingStore();
    const keys = buildPendingKeys({ id, email });
    let changed = false;

    keys.forEach((key) => {
      if (store[key]) {
        delete store[key];
        changed = true;
      }
    });

    if (changed) {
      savePendingStore(store);
    }
  }

  function isNoRowsError(error) {
    if (!error) return false;
    return error.code === 'PGRST116';
  }

  function isDuplicateKeyError(error) {
    if (!error) return false;
    if (error.code === '23505') return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('duplicate key') || message.includes('already exists');
  }

  async function ensureUserProfile(supabaseClient, authUser, profileOverride = null) {
    if (!authUser?.id) {
      return { ok: false, reason: 'missing-auth-user' };
    }

    const userId = authUser.id;
    const userEmail = normalizeText(authUser.email).toLowerCase();
    const pendingProfile = getPendingProfile({ id: userId, email: userEmail });

    const profileData = {
      id: userId,
      name: normalizeText(profileOverride?.name || pendingProfile?.name || authUser.user_metadata?.name),
      surnames: normalizeText(profileOverride?.surnames || pendingProfile?.surnames || authUser.user_metadata?.surnames),
      email: normalizeText(profileOverride?.email || pendingProfile?.email || authUser.email),
      phone: normalizeText(profileOverride?.phone || pendingProfile?.phone || authUser.user_metadata?.phone),
      role: normalizeText(profileOverride?.role || pendingProfile?.role || 'client') || 'client'
    };

    const { data: existingProfile, error: profileReadError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileReadError && !isNoRowsError(profileReadError)) {
      const { error: fallbackInsertError } = await supabaseClient.from('users').insert(profileData);
      if (!fallbackInsertError || isDuplicateKeyError(fallbackInsertError)) {
        clearPendingProfile({ id: userId, email: userEmail });
        return { ok: true, created: !isDuplicateKeyError(fallbackInsertError), recoveredFromReadError: true };
      }

      return {
        ok: false,
        reason: 'read-error',
        error: profileReadError,
        insertError: fallbackInsertError
      };
    }

    if (existingProfile?.id) {
      clearPendingProfile({ id: userId, email: userEmail });
      return { ok: true, created: false };
    }

    const { error: insertError } = await supabaseClient.from('users').insert(profileData);
    if (insertError) {
      if (isDuplicateKeyError(insertError)) {
        clearPendingProfile({ id: userId, email: userEmail });
        return { ok: true, created: false };
      }

      return { ok: false, reason: 'insert-error', error: insertError };
    }

    clearPendingProfile({ id: userId, email: userEmail });
    return { ok: true, created: true };
  }

  global.PETPAW_AUTH = {
    getSupabaseClient,
    normalizeText,
    formatAuthError,
    getRedirectTarget,
    setButtonLoadingState,
    savePendingProfile,
    getPendingProfile,
    clearPendingProfile,
    ensureUserProfile
  };
})(window);
