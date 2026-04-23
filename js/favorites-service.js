/* Centraliza las operaciones de favoritos y acceso del usuario actual. */
(function bootstrapFavoritesService(global) {
  const fallbackSupabaseUrl = 'https://hfwkaedcpvpfccwbcrie.supabase.co'
  const fallbackSupabaseKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'

  /* Reutiliza el cliente compartido o crea uno de respaldo si hace falta. */
  const supabaseClient =
    global.PETPAW_SUPABASE || global.supabase?.createClient(fallbackSupabaseUrl, fallbackSupabaseKey)
  const authHelpers = global.PETPAW_AUTH

  if (!supabaseClient) {
    console.error('[PETPAW] Supabase no esta disponible en favorites-service.js')
    return
  }

  /* Detecta errores comunes de Supabase para tratarlos mejor. */
  function isNoRowsError(error) {
    return error?.code === 'PGRST116'
  }

  function isDuplicateFavoriteError(error) {
    if (!error) return false
    if (error.code === '23505') return true

    const message = String(error.message || '').toLowerCase()
    return message.includes('duplicate key')
  }

  /* Calcula la ruta actual para poder volver aquí tras el login. */
  function getCurrentRelativePath() {
    const fileName = global.location.pathname.split('/').pop() || 'index.html'
    return `${fileName}${global.location.search || ''}`
  }

  /* Garantiza que exista el perfil en users al usar favoritos. */
  async function ensureAppUserProfile(authUser) {
    if (!authUser?.id || !authHelpers?.ensureUserProfile) {
      return
    }

    const result = await authHelpers.ensureUserProfile(supabaseClient, authUser)
    if (!result?.ok) {
      const reason = result?.error?.message || result?.reason || 'profile-sync-failed'
      console.warn('[PETPAW] Perfil de users no sincronizado:', reason)
    }
  }

  function formatDbError(error) {
    if (!error) return 'Error desconocido en base de datos.'

    const parts = [error.message]
    if (error.code) parts.push(`code=${error.code}`)
    if (error.details) parts.push(`details=${error.details}`)
    if (error.hint) parts.push(`hint=${error.hint}`)
    return parts.filter(Boolean).join(' | ')
  }

  /* Construye la URL de acceso manteniendo la vuelta a la página actual. */
  function buildLoginUrl(returnTo = '') {
    const target = String(returnTo || '').trim() || getCurrentRelativePath()
    return `login.html?redirect=${encodeURIComponent(target)}`
  }

  function redirectToLogin(returnTo = '') {
    global.location.href = buildLoginUrl(returnTo)
  }

  /* Recupera el usuario autenticado y sincroniza su perfil si es necesario. */
  async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser()
    if (error) {
      throw new Error(error.message)
    }

    const authUser = data?.user || null
    if (!authUser) return null

    await ensureAppUserProfile(authUser)
    return authUser
  }

  async function requireUserOrRedirect(returnTo = '') {
    const user = await getCurrentUser()

    if (!user) {
      redirectToLogin(returnTo)
      return null
    }

    return user
  }

  /* Lee y actualiza la tabla favorites para cada mascota del usuario. */
  async function fetchFavoritePetIds(userId) {
    const { data, error } = await supabaseClient
      .from('favorites')
      .select('pet_id')
      .eq('user_id', userId)

    if (error) {
      throw new Error(error.message)
    }

    return new Set((data || []).map((row) => row.pet_id).filter((value) => Number.isInteger(value)))
  }

  async function getFavoriteRow(userId, petId) {
    const { data, error } = await supabaseClient
      .from('favorites')
      .select('id, user_id, pet_id')
      .eq('user_id', userId)
      .eq('pet_id', petId)
      .maybeSingle()

    if (error && !isNoRowsError(error)) {
      throw new Error(error.message)
    }

    return data || null
  }

  async function addFavorite(userId, petId) {
    const { data, error } = await supabaseClient
      .from('favorites')
      .insert({
        user_id: userId,
        pet_id: petId
      })

    if (error) {
      if (isDuplicateFavoriteError(error)) {
        return {
          added: false,
          alreadyExists: true,
          favorite: null
        }
      }

      throw new Error(formatDbError(error))
    }

    return {
      added: true,
      alreadyExists: false,
      favorite: Array.isArray(data) ? data[0] || null : data || null
    }
  }

  async function removeFavorite(userId, petId) {
    const { error } = await supabaseClient
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('pet_id', petId)

    if (error) {
      throw new Error(formatDbError(error))
    }
  }

  async function removeFavoriteById(userId, favoriteId) {
    const { error } = await supabaseClient
      .from('favorites')
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(formatDbError(error))
    }
  }

  async function toggleFavorite(userId, petId) {
    const inserted = await addFavorite(userId, petId)
    if (inserted.added) {
      return {
        isFavorite: true,
        added: true,
        favoriteId: inserted.favorite?.id || null
      }
    }

    if (inserted.alreadyExists) {
      await removeFavorite(userId, petId)
      return {
        isFavorite: false,
        removed: true,
        favoriteId: inserted.favorite?.id || null
      }
    }
    throw new Error('No se pudo actualizar favorito.')
  }

  global.PETPAW_FAVORITES = {
    getCurrentRelativePath,
    buildLoginUrl,
    redirectToLogin,
    getCurrentUser,
    requireUserOrRedirect,
    fetchFavoritePetIds,
    getFavoriteRow,
    addFavorite,
    removeFavorite,
    removeFavoriteById,
    toggleFavorite
  }
})(window)
