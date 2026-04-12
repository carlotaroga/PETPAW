const supabaseUrl = 'https://hfwkaedcpvpfccwbcrie.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

const fallbackImages = [
  'resources/img/pexels-miami302-16676324.jpg',
  'resources/img/pexels-miami302-16676458.jpg',
  'resources/img/pexels-rdne-7348856.jpg'
]

const sliderState = {
  images: [],
  currentIndex: 0
}

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
  shelterEmail: document.getElementById('shelter-email')
}

function readPetIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('id') ?? params.get('pet')
  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeRelation(value) {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

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

function formatAge(age) {
  if (!Number.isFinite(age)) return 'Sin edad'
  if (age === 1) return '1 ano'
  return `${age} anos`
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
  } else if (sex === false) {
    elements.genderIcon.classList.add('bi-gender-female')
  } else {
    elements.genderIcon.classList.add('bi-gender-ambiguous')
  }
}

function getPublicImageUrl(path, index) {
  if (typeof path === 'string' && path.startsWith('http')) {
    return path
  }

  const storageResult = supabaseClient.storage.from('pet-images').getPublicUrl(path)
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

async function fetchPetById(petId) {
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
      shelters (id, name, email, address, city, province_id, community_id)
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

function renderPet(pet, provinceName, communityName) {
  const petName = pet?.name || 'Mascota'
  const sexLabel = formatSexLabel(pet?.sex)
  const sizeName = normalizeRelation(pet?.sizes)?.name || 'Sin tamano'
  const statusName = normalizeRelation(pet?.status)?.name || ''
  const shelter = normalizeRelation(pet?.shelters)

  if (elements.name) elements.name.textContent = petName
  if (elements.breed) elements.breed.textContent = pet?.breed || 'Sin raza'
  if (elements.age) elements.age.textContent = formatAge(pet?.age)
  if (elements.sex) elements.sex.textContent = sexLabel
  if (elements.size) elements.size.textContent = sizeName
  if (elements.description) {
    elements.description.textContent = pet?.description || 'Sin descripcion disponible.'
  }

  if (elements.status) {
    elements.status.textContent = statusName
    elements.status.classList.toggle('is-empty', !statusName)
  }

  setGenderIcon(pet?.sex)

  const locationParts = [shelter?.city, provinceName, communityName]
    .filter((value) => String(value || '').trim().length > 0)

  if (elements.shelterName) {
    elements.shelterName.textContent = shelter?.name || 'Protectora sin nombre'
  }

  if (elements.shelterData) {
    elements.shelterData.textContent = locationParts.length ? locationParts.join(', ') : 'Ubicacion no disponible'
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

async function initPetCard() {
  wireSliderControls()

  const petId = readPetIdFromUrl()
  if (!petId) {
    showState('No se ha indicado una mascota valida en la URL.', true)
    setSliderImages([], 'Mascota')
    return
  }

  showState('Cargando ficha de la mascota...')

  try {
    const pet = await fetchPetById(petId)

    if (!pet) {
      showState('No se encontro la mascota solicitada.', true)
      setSliderImages([], 'Mascota')
      return
    }

    const shelter = normalizeRelation(pet.shelters)
    const location = await fetchShelterLocationNames(shelter)

    renderPet(pet, location.provinceName, location.communityName)
    clearState()
  } catch (error) {
    console.error('Error cargando detalle de mascota:', error)
    showState('No se pudo cargar la ficha de la mascota.', true)
    setSliderImages([], 'Mascota')
  }
}

window.addEventListener('DOMContentLoaded', initPetCard)
