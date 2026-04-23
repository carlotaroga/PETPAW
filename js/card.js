const fallbackSupabaseUrl = 'https://hfwkaedcpvpfccwbcrie.supabase.co'
const fallbackSupabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'

/* Reutiliza helpers globales y resuelve un cliente válido para la ficha. */
const authHelpers = window.PETPAW_AUTH || null
const favoritesService = window.PETPAW_FAVORITES || null

function resolveSupabaseClient() {
  if (authHelpers?.getSupabaseClient) {
    try {
      return authHelpers.getSupabaseClient()
    } catch (error) {
      console.warn('[PETPAW] No se pudo usar PETPAW_AUTH.getSupabaseClient:', error.message)
    }
  }

  if (window.PETPAW_SUPABASE) {
    return window.PETPAW_SUPABASE
  }

  if (window.supabase?.createClient) {
    return window.supabase.createClient(fallbackSupabaseUrl, fallbackSupabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }

  return null
}

const supabaseClient = resolveSupabaseClient()

async function getCurrentAccessToken() {
  if (!supabaseClient?.auth?.getSession) {
    return null
  }

  const { data, error } = await supabaseClient.auth.getSession()
  if (error) {
    throw new Error(error.message)
  }

  return data?.session?.access_token ?? null
}

const fallbackImages = [
  'resources/img/pexels-miami302-16676324.jpg',
  'resources/img/pexels-miami302-16676458.jpg',
  'resources/img/pexels-rdne-7348856.jpg'
]

/* Estado local de imágenes, favoritos y solicitud de adopción. */
const sliderState = {
  images: [],
  currentIndex: 0
}

const favoriteState = {
  petId: null,
  user: null,
  isFavorite: false,
  isLoading: false,
  messageTimer: null
}

const adoptionState = {
  currentPet: null,
  isSubmitting: false
}

/* Referencias principales del DOM para evitar búsquedas repetidas. */
const elements = {
  image: document.getElementById('pet-main-image'),
  dots: document.getElementById('slider-dots'),
  prev: document.getElementById('slider-prev'),
  next: document.getElementById('slider-next'),
  state: document.getElementById('card-state'),
  name: document.getElementById('pet-name'),
  status: document.getElementById('pet-status'),
  genderIcon: document.getElementById('pet-gender-icon'),
  breed: document.getElementById('pet-breed'),
  age: document.getElementById('pet-age'),
  sex: document.getElementById('pet-sex'),
  size: document.getElementById('pet-size'),
  description: document.getElementById('pet-description'),
  shelterName: document.getElementById('shelter-name'),
  shelterData: document.getElementById('shelter-data'),
  shelterEmail: document.getElementById('shelter-email'),
  adoptionButton: document.getElementById('openAdoptionModalBtn'),
  favoriteButton: document.querySelector('.pet-action-fav'),
  favoriteIcon: document.querySelector('.pet-action-fav i')
}

/* Utilidades para leer la mascota actual y normalizar sus datos. */
function readPetIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('id') ?? params.get('pet')
  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function getCurrentCardPath() {
  const petId = readPetIdFromUrl()
  return petId ? `card.html?id=${petId}` : 'card.html'
}

function normalizeRelation(value) {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function formatStatusLabel(statusName) {
  const normalized = String(statusName || '').trim().toLowerCase()
  if (normalized === 'adoptado') return 'Adoptado'
  return String(statusName || '').trim()
}

/* Mensajes rápidos de estado para acciones de la ficha. */
function showState(message, isError = false) {
  if (!elements.state) return
  elements.state.textContent = message
  elements.state.classList.toggle('is-error', isError)
}

function clearState() {
  if (!elements.state) return
  elements.state.textContent = ''
  elements.state.classList.remove('is-error')
}

function showTransientState(message, isError = false) {
  if (favoriteState.messageTimer) {
    clearTimeout(favoriteState.messageTimer)
    favoriteState.messageTimer = null
  }

  showState(message, isError)

  if (!isError) {
    favoriteState.messageTimer = setTimeout(() => {
      clearState()
      favoriteState.messageTimer = null
    }, 2200)
  }
}

function formatAge(age) {
  if (!Number.isFinite(age)) return 'Sin edad'
  if (age === 1) return '1 año'
  return `${age} años`
}

function formatSexLabel(sex) {
  if (sex === true) return 'Macho'
  if (sex === false) return 'Hembra'
  return 'Sin dato'
}

function setGenderIcon(sex) {
  if (!elements.genderIcon) return

  elements.genderIcon.className = 'bi pet-gender-icon'

  if (sex === true) {
    elements.genderIcon.classList.add('bi-gender-male')
    elements.genderIcon.classList.add('is-male')
  } else if (sex === false) {
    elements.genderIcon.classList.add('bi-gender-female')
    elements.genderIcon.classList.add('is-female')
  } else {
    elements.genderIcon.classList.add('bi-gender-ambiguous')
    elements.genderIcon.classList.add('is-unknown')
  }
}

function shouldShowStatusBadge(statusName) {
  return String(statusName || '').trim().toLowerCase() === 'adoptado'
}

function isAdoptedStatus(statusName) {
  return String(statusName || '').trim().toLowerCase() === 'adoptado'
}

function updateAdoptionButton(statusName) {
  if (!elements.adoptionButton) return

  const isAdopted = isAdoptedStatus(statusName)
  elements.adoptionButton.disabled = isAdopted
  elements.adoptionButton.textContent = isAdopted ? 'Mascota adoptada' : 'Solicitar adopción'
  elements.adoptionButton.setAttribute(
    'aria-label',
    isAdopted ? 'Mascota adoptada, no disponible para solicitar adopción' : 'Solicitar adopción'
  )
}

/* Mantiene el botón de favoritos sincronizado con el estado real. */
function setFavoriteVisual(isFavorite) {
  favoriteState.isFavorite = Boolean(isFavorite)

  if (!elements.favoriteButton) return

  elements.favoriteButton.classList.toggle('is-active', favoriteState.isFavorite)
  elements.favoriteButton.setAttribute(
    'aria-label',
    favoriteState.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'
  )

  if (elements.favoriteIcon) {
    elements.favoriteIcon.classList.toggle('bi-heart-fill', favoriteState.isFavorite)
    elements.favoriteIcon.classList.toggle('bi-heart', !favoriteState.isFavorite)
  }
}

function setFavoriteLoading(isLoading) {
  favoriteState.isLoading = Boolean(isLoading)

  if (!elements.favoriteButton) return

  elements.favoriteButton.disabled = favoriteState.isLoading
  elements.favoriteButton.classList.toggle('is-loading', favoriteState.isLoading)
}

function setFavoriteEnabled(isEnabled) {
  if (!elements.favoriteButton) return
  if (favoriteState.isLoading) return

  elements.favoriteButton.disabled = !isEnabled
}

function redirectToLoginForFavorites() {
  const returnTo = getCurrentCardPath()

  if (favoritesService?.redirectToLogin) {
    favoritesService.redirectToLogin(returnTo)
    return
  }

  window.location.href = `login.html?redirect=${encodeURIComponent(returnTo)}`
}

function isDuplicateKeyError(error) {
  if (!error) return false
  if (error.code === '23505') return true

  const message = String(error.message || '').toLowerCase()
  return message.includes('duplicate key') || message.includes('already exists')
}

async function resolveCurrentUser() {
  if (!supabaseClient) return null

  if (favoritesService?.getCurrentUser) {
    return favoritesService.getCurrentUser()
  }

  const { data, error } = await supabaseClient.auth.getUser()
  if (error) {
    throw new Error(error.message)
  }

  const authUser = data?.user || null
  if (!authUser) return null

  if (authHelpers?.ensureUserProfile) {
    const syncResult = await authHelpers.ensureUserProfile(supabaseClient, authUser)
    if (!syncResult.ok) {
      console.warn('[PETPAW] No se pudo sincronizar perfil de users:', syncResult.reason)
    }
  }

  return authUser
}

async function fetchFavoriteRow(userId, petId) {
  if (!supabaseClient || !userId || !petId) return null

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('pet_id', petId)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) && data.length ? data[0] : null
}

async function insertFavoriteRow(userId, petId) {
  if (!supabaseClient) {
    throw new Error('Supabase no está disponible.')
  }

  const { data, error } = await supabaseClient
    .from('favorites')
    .insert({ user_id: userId, pet_id: petId })
    .select('id')

  if (error) {
    if (isDuplicateKeyError(error)) {
      return { inserted: false, duplicated: true, row: null }
    }

    throw new Error(error.message)
  }

  return {
    inserted: true,
    duplicated: false,
    row: Array.isArray(data) ? data[0] ?? null : data ?? null
  }
}

async function removeFavoriteRow(userId, petId) {
  if (!supabaseClient) {
    throw new Error('Supabase no esta disponible.')
  }

  const { error } = await supabaseClient
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('pet_id', petId)

  if (error) {
    throw new Error(error.message)
  }
}

async function syncFavoriteStatus() {
  if (!elements.favoriteButton || !favoriteState.petId || !supabaseClient) {
    return
  }

  setFavoriteVisual(false)

  try {
    favoriteState.user = await resolveCurrentUser()

    if (!favoriteState.user?.id) {
      return
    }

    const existingFavorite = await fetchFavoriteRow(favoriteState.user.id, favoriteState.petId)
    setFavoriteVisual(Boolean(existingFavorite))
  } catch (error) {
    console.error('[PETPAW] Error sincronizando favoritos en card:', error.message)
  }
}

async function handleFavoriteClick(event) {
  event.preventDefault()

  if (!favoriteState.petId) {
    showTransientState('No se encontró la mascota para guardar en favoritos.', true)
    return
  }

  if (!supabaseClient) {
    showTransientState('Supabase no está disponible en esta página.', true)
    return
  }

  if (favoriteState.isLoading) {
    return
  }

  try {
    favoriteState.user = await resolveCurrentUser()
  } catch (error) {
    console.error('[PETPAW] Error obteniendo usuario autenticado:', error.message)
    showTransientState('No se pudo validar tu sesión.', true)
    return
  }

  if (!favoriteState.user?.id) {
    redirectToLoginForFavorites()
    return
  }

  setFavoriteLoading(true)

  try {
    if (favoriteState.isFavorite) {
      await removeFavoriteRow(favoriteState.user.id, favoriteState.petId)
      setFavoriteVisual(false)
      showTransientState('Mascota eliminada de favoritos.')
    } else {
      const result = await insertFavoriteRow(favoriteState.user.id, favoriteState.petId)

      if (result.duplicated) {
        setFavoriteVisual(true)
        showTransientState('Esta mascota ya estaba en favoritos.')
      } else {
        setFavoriteVisual(true)
        showTransientState('Mascota añadida a favoritos.')
      }
    }
  } catch (error) {
    console.error('[PETPAW] Error actualizando favoritos:', error.message)
    showTransientState(`No se pudo actualizar favoritos: ${error.message}`, true)
  } finally {
    setFavoriteLoading(false)
  }
}

function wireFavoriteButton() {
  if (!elements.favoriteButton) return

  if (elements.favoriteButton.dataset.bound === '1') {
    return
  }

  elements.favoriteButton.dataset.bound = '1'
  elements.favoriteButton.addEventListener('click', handleFavoriteClick)
}

function wireAuthStateWatcher() {
  if (!supabaseClient?.auth?.onAuthStateChange) return

  supabaseClient.auth.onAuthStateChange(() => {
    favoriteState.user = null
    syncFavoriteStatus()
  })
}

function getPublicImageUrl(path, index) {
  if (typeof path === 'string' && path.startsWith('http')) {
    return path
  }

  const storageResult = supabaseClient?.storage?.from('pet-images').getPublicUrl(path)
  return storageResult?.data?.publicUrl ?? fallbackImages[index % fallbackImages.length]
}

function updateMainImage() {
  const current = sliderState.images[sliderState.currentIndex]
  if (!current || !elements.image) return

  elements.image.src = current.src
  elements.image.alt = current.alt

  const dots = Array.from(elements.dots?.querySelectorAll('.dot') ?? [])
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === sliderState.currentIndex)
  })
}

/* Controla la galería principal y sus miniaturas o puntos de navegación. */
function setSliderImages(images, petName) {
  const normalized = images.length
    ? images
    : fallbackImages.map((src) => ({ src, alt: `${petName} en adopcion` }))

  sliderState.images = normalized
  sliderState.currentIndex = 0

  const hasMultipleImages = sliderState.images.length > 1
  if (elements.prev) elements.prev.disabled = !hasMultipleImages
  if (elements.next) elements.next.disabled = !hasMultipleImages

  if (elements.dots) {
    elements.dots.innerHTML = ''
    elements.dots.style.display = hasMultipleImages ? 'flex' : 'none'

    sliderState.images.forEach((_, index) => {
      const dot = document.createElement('button')
      dot.className = index === 0 ? 'dot active' : 'dot'
      dot.dataset.index = String(index)
      dot.setAttribute('aria-label', `Ver foto ${index + 1}`)
      dot.addEventListener('click', () => {
        sliderState.currentIndex = index
        updateMainImage()
      })
      elements.dots.appendChild(dot)
    })
  }

  updateMainImage()
}

function goNextImage() {
  if (!sliderState.images.length) return
  sliderState.currentIndex = (sliderState.currentIndex + 1) % sliderState.images.length
  updateMainImage()
}

function goPrevImage() {
  if (!sliderState.images.length) return
  sliderState.currentIndex = (sliderState.currentIndex - 1 + sliderState.images.length) % sliderState.images.length
  updateMainImage()
}

function wireSliderControls() {
  if (elements.next) {
    elements.next.addEventListener('click', goNextImage)
  }

  if (elements.prev) {
    elements.prev.addEventListener('click', goPrevImage)
  }
}

/* Consulta la mascota con todas sus relaciones necesarias para la ficha. */
async function fetchPetById(petId) {
  if (!supabaseClient) {
    throw new Error('Supabase no esta disponible.')
  }

  const { data, error } = await supabaseClient
    .from('pets')
    .select(`
      id,
      name,
      sex,
      age,
      breed,
      description,
      status_id,
      size_id,
      shelter_id,
      species_id,
      pet_images (image_url),
      status (name),
      sizes (name),
      species (name),
      shelters (id, name, email, address, province_id, community_id)
    `)
    .eq('id', petId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function fetchShelterLocationNames(shelter) {
  const provinceId = shelter?.province_id
  const communityId = shelter?.community_id

  const provincePromise = Number.isInteger(provinceId)
    ? supabaseClient.from('provinces').select('name').eq('id', provinceId).maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const communityPromise = Number.isInteger(communityId)
    ? supabaseClient.from('autonomous_communities').select('name').eq('id', communityId).maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [provinceResult, communityResult] = await Promise.all([provincePromise, communityPromise])

  return {
    provinceName: provinceResult?.data?.name ?? '',
    communityName: communityResult?.data?.name ?? ''
  }
}

/* Pinta los datos principales de la mascota y de su protectora. */
function renderPet(pet, provinceName, communityName) {
  const petName = pet?.name || 'Mascota'
  const sexLabel = formatSexLabel(pet?.sex)
  const sizeName = normalizeRelation(pet?.sizes)?.name || 'Sin tamaño'
  const statusName = normalizeRelation(pet?.status)?.name || ''
  const shelter = normalizeRelation(pet?.shelters)

  // Guardar la mascota actual para el modal de adopción
  adoptionState.currentPet = pet

  if (elements.name) elements.name.textContent = petName
  if (elements.breed) elements.breed.textContent = pet?.breed || 'Sin raza'
  if (elements.age) elements.age.textContent = formatAge(pet?.age)
  if (elements.sex) elements.sex.textContent = sexLabel
  if (elements.size) elements.size.textContent = sizeName
  if (elements.description) {
    elements.description.textContent = pet?.description || 'Sin descripción disponible.'
  }

  if (elements.status) {
    const showStatus = shouldShowStatusBadge(statusName)
    elements.status.textContent = showStatus ? formatStatusLabel(statusName) : ''
    elements.status.classList.toggle('is-empty', !showStatus)
    elements.status.classList.toggle('is-adopted', showStatus && isAdoptedStatus(statusName))
  }

  updateAdoptionButton(statusName)

  setGenderIcon(pet?.sex)

  const locationParts = [shelter?.address, provinceName, communityName]
    .filter((value) => String(value || '').trim().length > 0)

  if (elements.shelterName) {
    elements.shelterName.textContent = shelter?.name || 'Protectora sin nombre'
  }

  if (elements.shelterData) {
    elements.shelterData.textContent = locationParts.length ? locationParts.join(', ') : 'Ubicación no disponible'
  }

  if (elements.shelterEmail) {
    const email = shelter?.email || ''
    elements.shelterEmail.textContent = email || 'Sin email'
    elements.shelterEmail.href = email ? `mailto:${email}` : '#'
  }

  const images = (pet?.pet_images ?? [])
    .map((item, index) => {
      const path = item?.image_url
      if (!path) return null
      return {
        src: getPublicImageUrl(path, index),
        alt: `${petName} - foto ${index + 1}`
      }
    })
    .filter(Boolean)

  setSliderImages(images, petName)
}

/* Carga la ficha desde la URL y deja lista la interfaz de detalle. */
async function initPetCard() {
  wireSliderControls()
  wireFavoriteButton()
  wireAuthStateWatcher()

  if (!supabaseClient) {
    showState('No se pudo inicializar Supabase en esta página.', true)
    setFavoriteEnabled(false)
    return
  }

  const petId = readPetIdFromUrl()
  favoriteState.petId = petId

  if (!petId) {
    showState('No se ha indicado una mascota válida en la URL.', true)
    setSliderImages([], 'Mascota')
    setFavoriteEnabled(false)
    return
  }

  showState('Cargando ficha de la mascota...')

  try {
    await syncFavoriteStatus()

    const pet = await fetchPetById(petId)

    if (!pet) {
      showState('No se encontró la mascota solicitada.', true)
      setSliderImages([], 'Mascota')
      setFavoriteEnabled(false)
      return
    }

    const shelter = normalizeRelation(pet.shelters)
    const location = await fetchShelterLocationNames(shelter)

    renderPet(pet, location.provinceName, location.communityName)
    clearState()
    setFavoriteEnabled(true)
  } catch (error) {
    console.error('Error cargando detalle de mascota:', error)
    showState('No se pudo cargar la ficha de la mascota.', true)
    setSliderImages([], 'Mascota')
    setFavoriteEnabled(false)
  }
}

window.addEventListener('DOMContentLoaded', initPetCard)

// Funciones para el modal de adopción
/* Gestiona el modal de solicitud de adopción y su envío a la función. */
function initAdoptionModal() {
  const openAdoptionModalBtn = document.getElementById('openAdoptionModalBtn')
  const adoptionForm = document.getElementById('adoptionForm')
  const requiredAdoptionMessage = document.getElementById('requiredAdoptionMessage')
  const extraAdoptionMessage = document.getElementById('extraAdoptionMessage')
  const adoptionFormState = document.getElementById('adoptionFormState')
  const submitAdoptionBtn = document.getElementById('submitAdoptionBtn')

  const adoptionModalElement = document.getElementById('adoptionModal')
  const adoptionModal = adoptionModalElement ? new bootstrap.Modal(adoptionModalElement) : null

  openAdoptionModalBtn?.addEventListener('click', async () => {
    if (isAdoptedStatus(adoptionState.currentPet?.status?.name)) {
      adoptionFormState.textContent = 'Esta mascota ya ha sido adoptada.'
      adoptionFormState.className = 'small mt-3 text-danger'
      return
    }

    const { data, error } = await supabaseClient.auth.getUser()

    if (error || !data?.user) {
      alert('Debes iniciar sesión para solicitar una adopción.')
      window.location.href = 'login.html'
      return
    }

    if (!adoptionState.currentPet) {
      alert('No se ha podido cargar la información de la mascota.')
      return
    }

    const baseMessage = `Hola! Estoy interesad@ en ${adoptionState.currentPet.name}`
    requiredAdoptionMessage.textContent = baseMessage
    extraAdoptionMessage.value = ''
    adoptionFormState.textContent = ''
    adoptionFormState.className = 'small mt-3'

    adoptionModal?.show()
  })

  adoptionForm?.addEventListener('submit', async (e) => {
    e.preventDefault()

    const { data: authData, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !authData?.user) {
      adoptionFormState.textContent = 'Debes iniciar sesión para continuar.'
      adoptionFormState.className = 'small mt-3 text-danger'
      return
    }

    if (!adoptionState.currentPet) {
      adoptionFormState.textContent = 'No se encontró la mascota seleccionada.'
      adoptionFormState.className = 'small mt-3 text-danger'
      return
    }

    if (isAdoptedStatus(adoptionState.currentPet?.status?.name)) {
      adoptionFormState.textContent = 'Esta mascota ya ha sido adoptada.'
      adoptionFormState.className = 'small mt-3 text-danger'
      return
    }

    if (adoptionState.isSubmitting) return

    try {
      adoptionState.isSubmitting = true
      submitAdoptionBtn.disabled = true
      adoptionFormState.textContent = 'Enviando solicitud...'
      adoptionFormState.className = 'small mt-3 text-muted'

      const baseMessage = `Hola! Estoy interesad@ en ${adoptionState.currentPet.name}`
      const extraMessage = extraAdoptionMessage.value.trim()

      const finalMessage = extraMessage
        ? `${baseMessage}\n\n${extraMessage}`
        : baseMessage

      const { data: requestInserted, error: requestError } = await supabaseClient
      .from("adoption_requests")
      .insert([
        {
          user_id: authData.user.id,
          pet_id: adoptionState.currentPet.id,
          message: finalMessage,
          status: "en_espera",
        },
      ])
      .select()
      .single();

      if (requestError) throw requestError

      const accessToken = await getCurrentAccessToken()
      if (!accessToken) {
        throw new Error('No se ha encontrado una sesión válida para enviar la solicitud.')
      }

      const { error: functionError } = await supabaseClient.functions.invoke(
        'send-adoption-request-email',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: {
            adoptionRequestId: requestInserted.id
          }
        }
      )

      if (functionError) throw functionError

      adoptionFormState.textContent = 'Solicitud enviada correctamente.'
      adoptionFormState.className = 'small mt-3 text-success'

      setTimeout(() => {
        adoptionModal?.hide()
      }, 1200)
    } catch (err) {
      console.error('Error enviando solicitud de adopción:', err)
      adoptionFormState.textContent = 'Ha ocurrido un error al enviar la solicitud.'
      adoptionFormState.className = 'small mt-3 text-danger'
    } finally {
      adoptionState.isSubmitting = false
      submitAdoptionBtn.disabled = false
    }
  })
}

/* Arranca ficha y modal cuando el DOM ya está disponible. */
window.addEventListener('DOMContentLoaded', () => {
  initPetCard()
  initAdoptionModal()
})
