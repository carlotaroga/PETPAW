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
      return 'Email o contraseña incorrectos.';
    }

    if (message.includes('email not confirmed')) {
      return 'Debes confirmar tu email antes de iniciar sesión.';
    }

    if (message.includes('user already registered')) {
      return 'Este email ya esta registrado.';
    }

    if (message.includes('password should be at least')) {
      return 'La contraseña es demasiado corta.';
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

  function isShelterRole(role) {
    const normalizedRole = normalizeText(role).toLowerCase();
    return normalizedRole === 'shelter' || normalizedRole === 'admin';
  }

  function getHomePathForRole(role) {
    return isShelterRole(role) ? 'shelter-dashboard.html' : 'index.html';
  }

  function resolvePostLoginTarget(role, requestedTarget = '') {
    const safeTarget = normalizeText(requestedTarget);

    if (isShelterRole(role)) {
      if (safeTarget.toLowerCase().startsWith('shelter-')) {
        return safeTarget;
      }

      return getHomePathForRole(role);
    }

    return safeTarget || getHomePathForRole(role);
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
      shelter_id: profile?.shelter_id ?? null,
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

  async function resolveShelterIdByEmail(supabaseClient, email) {
    const normalizedEmail = normalizeText(email).toLowerCase();
    if (!normalizedEmail) return null;

    const { data, error } = await supabaseClient
      .from('shelters')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.warn('[PETPAW] No se pudo resolver shelter por email:', error.message);
      return null;
    }

    return data?.id ?? null;
  }

  async function inferShelterAccess(supabaseClient, email, role, shelterId) {
    const normalizedRole = normalizeText(role).toLowerCase();
    let resolvedShelterId = shelterId ?? null;
    let resolvedRole = normalizedRole || 'client';

    if (!resolvedShelterId) {
      resolvedShelterId = await resolveShelterIdByEmail(supabaseClient, email);
    }

    if (resolvedShelterId) {
      resolvedRole = 'shelter';
    }

    return {
      role: resolvedRole || 'client',
      shelterId: resolvedShelterId
    };
  }

  async function ensureUserProfile(supabaseClient, authUser, profileOverride = null) {
    if (!authUser?.id) {
      return { ok: false, reason: 'missing-auth-user' };
    }

    const userId = authUser.id;
    const userEmail = normalizeText(authUser.email).toLowerCase();
    const pendingProfile = getPendingProfile({ id: userId, email: userEmail });

    const rawRole = normalizeText(
      profileOverride?.role || pendingProfile?.role || authUser.user_metadata?.role || 'client'
    ) || 'client';

    const rawShelterId = profileOverride?.shelter_id ?? pendingProfile?.shelter_id ?? authUser.user_metadata?.shelter_id ?? null;
    const { role, shelterId } = await inferShelterAccess(supabaseClient, userEmail, rawRole, rawShelterId);

    const profileData = {
      id: userId,
      name: normalizeText(profileOverride?.name || pendingProfile?.name || authUser.user_metadata?.name),
      surnames: normalizeText(profileOverride?.surnames || pendingProfile?.surnames || authUser.user_metadata?.surnames),
      email: normalizeText(profileOverride?.email || pendingProfile?.email || authUser.email),
      phone: normalizeText(profileOverride?.phone || pendingProfile?.phone || authUser.user_metadata?.phone),
      shelter_id: shelterId,
      role
    };

    const { data: existingProfile, error: profileReadError } = await supabaseClient
      .from('users')
      .select('id, shelter_id, role')
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
      if (profileData.shelter_id !== existingProfile.shelter_id || profileData.role !== existingProfile.role) {
        const { error: updateError } = await supabaseClient
          .from('users')
          .update({
            shelter_id: profileData.shelter_id,
            role: profileData.role,
            name: profileData.name,
            surnames: profileData.surnames,
            email: profileData.email,
            phone: profileData.phone
          })
          .eq('id', userId);

        if (updateError) {
          return { ok: false, reason: 'update-error', error: updateError };
        }
      }

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

  async function getCurrentUserProfile(supabaseClient) {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    const sessionUser = data.session?.user;
    if (!sessionUser) {
      return null;
    }

    const syncProfile = await ensureUserProfile(supabaseClient, sessionUser);
    if (!syncProfile.ok) {
      console.warn('[PETPAW] No se pudo sincronizar el perfil actual:', {
        reason: syncProfile.reason,
        error: syncProfile.error?.message || null
      });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('id, name, surnames, email, role, shelter_id, phone')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      const fallbackAccess = await inferShelterAccess(
        supabaseClient,
        sessionUser.email,
        sessionUser.user_metadata?.role,
        sessionUser.user_metadata?.shelter_id ?? null
      );

      return {
        id: sessionUser.id,
        name: sessionUser.user_metadata?.name || '',
        surnames: sessionUser.user_metadata?.surnames || '',
        email: sessionUser.email || '',
        phone: sessionUser.user_metadata?.phone || '',
        role: fallbackAccess.role,
        shelter_id: fallbackAccess.shelterId,
        profileMissing: true
      };
    }

    const normalizedProfileEmail = profile.email || sessionUser.email || '';
    const resolvedAccess = await inferShelterAccess(
      supabaseClient,
      normalizedProfileEmail,
      profile.role,
      profile.shelter_id
    );

    if (resolvedAccess.role !== profile.role || resolvedAccess.shelterId !== profile.shelter_id) {
      const repairedProfile = {
        name: profile.name,
        surnames: profile.surnames,
        email: normalizedProfileEmail,
        phone: profile.phone || sessionUser.user_metadata?.phone || '',
        role: resolvedAccess.role,
        shelter_id: resolvedAccess.shelterId
      };

      const syncResult = await ensureUserProfile(supabaseClient, sessionUser, repairedProfile);
      if (!syncResult.ok) {
        console.warn('[PETPAW] No se pudo reparar el perfil actual:', syncResult.reason, syncResult.error?.message || null);
      } else {
        profile.role = repairedProfile.role;
        profile.shelter_id = repairedProfile.shelter_id;
        profile.phone = repairedProfile.phone;
      }
    }

    return {
      ...profile,
      email: profile.email || sessionUser.email || '',
      phone: profile.phone || sessionUser.user_metadata?.phone || '',
      profileMissing: false
    };
  }

  global.PETPAW_AUTH = {
    getSupabaseClient,
    normalizeText,
    formatAuthError,
    getRedirectTarget,
    isShelterRole,
    getHomePathForRole,
    resolvePostLoginTarget,
    setButtonLoadingState,
    savePendingProfile,
    getPendingProfile,
    clearPendingProfile,
    ensureUserProfile,
    getCurrentUserProfile
  };
})(window);
