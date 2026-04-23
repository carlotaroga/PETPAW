const supabaseUrl = 'https://hfwkaedcpvpfccwbcrie.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

/* Imágenes y tarjetas de reserva por si faltan datos reales. */
const fallbackImages = [
  'resources/img/pexels-svliiim-33699491.jpg',
  'resources/img/pexels-miami302-16676458.jpg',
  'resources/img/pexels-rdne-7348856.jpg',
  'resources/img/pexels-elgolovchenko-31964007.jpg',
  'resources/img/pexels-miami302-16676324.jpg',
  'resources/img/pexels-miami302-16667545.jpg',
  'resources/img/pexels-viktoriia-kondratiuk-458099300-30617487.jpg',
  'resources/img/pexels-snapwire-46024.jpg'
]

const fallbackPets = [
  {
    id: -1,
    name: 'Nombre',
    age: 2,
    sex: null,
    breed: 'Mestizo',
    species_id: null,
    size_id: null,
    shelter_id: null,
    status_name: '',
    size_name: 'Mediano',
    community_id: null,
    province_id: null,
    pet_images: []
  }
]

const filterElements = {
  comunidad: document.getElementById('filtro-comunidad'),
  provincia: document.getElementById('filtro-provincia'),
  especie: document.getElementById('filtro-especie'),
  raza: document.getElementById('filtro-raza'),
  genero: document.getElementById('filtro-genero'),
  edad: document.getElementById('filtro-edad'),
  tamano: document.getElementById('filtro-tamano')
}

let allPets = []
let lookups = {
  communities: [],
  provinces: [],
  species: [],
  sizes: []
}
const PETS_PER_PAGE = 6
let currentPage = 1

/* Utilidades comunes para normalizar y enriquecer datos del catálogo. */
function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function formatStatusLabel(statusName) {
  const normalized = normalizeText(statusName)
  if (normalized === 'adoptado') return 'Adoptado'
  return String(statusName ?? '').trim()
}

function buildMapById(rows) {
  return rows.reduce((acc, row) => {
    acc[row.id] = row
    return acc
  }, {})
}

function compareByName(a, b) {
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es')
}

async function safeSelect(table, columns) {
  const { data, error } = await supabaseClient.from(table).select(columns)
  if (error) {
    console.error(`Error cargando ${table}:`, error.message)
    return []
  }
  return data ?? []
}

/* Carga mascotas y catálogos necesarios para construir filtros y cards. */
async function loadPetsData() {
  const [pets, sizes, statuses, species, shelters, communities, provinces] = await Promise.all([
    safeSelect(
      'pets',
      `
      id,
      name,
      sex,
      age,
      size_id,
      breed,
      status_id,
      shelter_id,
      species_id,
      pet_images (image_url)
    `
    ),
    safeSelect('sizes', 'id, name'),
    safeSelect('status', 'id, name'),
    safeSelect('species', 'id, name'),
    safeSelect('shelters', 'id, community_id, province_id'),
    safeSelect('autonomous_communities', 'id, name'),
    safeSelect('provinces', 'id, name, community_id')
  ])

  const sizesById = buildMapById(sizes)
  const statusesById = buildMapById(statuses)
  const speciesById = buildMapById(species)
  const sheltersById = buildMapById(shelters)
  const communitiesById = buildMapById(communities)
  const provincesById = buildMapById(provinces)
  const shelterCommunityIds = new Set(
    shelters
      .map((shelter) => safeNumber(shelter?.community_id))
      .filter((value) => Number.isInteger(value) && value > 0)
  )
  const shelterProvinceIds = new Set(
    shelters
      .map((shelter) => safeNumber(shelter?.province_id))
      .filter((value) => Number.isInteger(value) && value > 0)
  )

  const enrichedPets = pets.map((pet) => {
    const shelter = sheltersById[pet.shelter_id] ?? null
    const communityId = shelter?.community_id ?? null
    const provinceId = shelter?.province_id ?? null

    return {
      ...pet,
      status_name: formatStatusLabel(statusesById[pet.status_id]?.name ?? ''),
      size_name: sizesById[pet.size_id]?.name ?? '',
      species_name: speciesById[pet.species_id]?.name ?? '',
      community_id: communityId,
      province_id: provinceId,
      community_name: communitiesById[communityId]?.name ?? '',
      province_name: provincesById[provinceId]?.name ?? ''
    }
  })

  return {
    pets: enrichedPets,
    lookups: {
      communities: communities
        .filter((community) => shelterCommunityIds.has(community.id))
        .sort(compareByName),
      provinces: provinces
        .filter((province) => shelterProvinceIds.has(province.id))
        .sort(compareByName),
      species: [...species].sort(compareByName),
      sizes: [...sizes].sort(compareByName)
    }
  }
}

/* Construye el texto y la imagen que verá cada tarjeta de mascota. */
function buildMeta(pet) {
  const ageLabel = Number.isFinite(pet.age) ? `${pet.age} años` : 'Edad desconocida'
  const sizeLabel = pet.size_name || 'Tamaño sin definir'
  const breedLabel = pet.breed || 'Raza sin definir'

  return `${ageLabel} - ${sizeLabel} - ${breedLabel}`
}

function getSexClass(pet) {
  if (pet.sex === true) return 'male'
  if (pet.sex === false) return 'female'
  return ''
}

function getImage(pet, index) {
  if (pet.pet_images && pet.pet_images.length > 0) {
    const path = pet.pet_images[0].image_url
    if (typeof path === 'string' && path.startsWith('http')) {
      return path
    }

    const { data } = supabaseClient.storage.from('pet-images').getPublicUrl(path)
    return data?.publicUrl ?? fallbackImages[index % fallbackImages.length]
  }

  return fallbackImages[index % fallbackImages.length]
}

/* Pinta las cards visibles de la página actual. */
function renderPets(pets) {
  const grid = document.getElementById('adopta-grid')
  const template = document.getElementById('card-mascota-template')
  if (!grid || !template) return

  grid.innerHTML = ''

  if (!pets.length) {
    grid.innerHTML = '<p class="empty-results">No hay mascotas que coincidan con los filtros.</p>'
    return
  }

  pets.forEach((pet, index) => {
    const clone = template.content.cloneNode(true)
    const card = clone.querySelector('.card-mascota')
    const badge = clone.querySelector('[data-status]')
    const img = clone.querySelector('[data-image]')
    const name = clone.querySelector('[data-name]')
    const meta = clone.querySelector('[data-meta]')
    const sex = clone.querySelector('[data-sex]')

    if (badge) {
      const status = pet.status_name
      if (status && String(status).trim().toLowerCase() !== 'disponible') {
        badge.textContent = status
        badge.classList.toggle('is-adopted', String(status).trim().toLowerCase() === 'adoptado')
      } else {
        badge.remove()
      }
    }

    if (img) img.src = getImage(pet, index)
    if (name) name.textContent = pet.name ?? 'Nombre'
    if (meta) meta.textContent = buildMeta(pet)

    if (sex) {
      const sexClass = getSexClass(pet)
      if (sexClass === 'male') {
        sex.classList.add('card-sex', 'male')
        sex.innerHTML = '<i class="fa-solid fa-mars" aria-hidden="true"></i>'
        sex.setAttribute('aria-label', 'Macho')
      } else if (sexClass === 'female') {
        sex.classList.add('card-sex', 'female')
        sex.innerHTML = '<i class="fa-solid fa-venus" aria-hidden="true"></i>'
        sex.setAttribute('aria-label', 'Hembra')
      } else {
        sex.remove()
      }
    }

    if (card) {
      const targetUrl = pet?.id ? `card.html?id=${pet.id}` : 'card.html'
      card.classList.add('clickable-card')
      card.setAttribute('role', 'link')
      card.tabIndex = 0
      card.addEventListener('click', () => {
        window.location.href = targetUrl
      })
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          window.location.href = targetUrl
        }
      })

      grid.appendChild(card)
    }
  })
}

function getPaginationElement() {
  return document.getElementById('adopta-pagination')
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / PETS_PER_PAGE))
}

function getPaginationState(pets) {
  const totalItems = pets.length
  const totalPages = getTotalPages(totalItems)

  if (currentPage > totalPages) {
    currentPage = totalPages
  }

  const startIndex = (currentPage - 1) * PETS_PER_PAGE
  const endIndex = startIndex + PETS_PER_PAGE

  return {
    totalItems,
    totalPages,
    items: pets.slice(startIndex, endIndex)
  }
}

function createPaginationButton(label, page, options = {}) {
  const { isActive = false, isDisabled = false, ariaLabel = '' } = options
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `pagination-item${isActive ? ' is-active' : ''}`
  button.textContent = label

  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel)
  }

  if (isActive) {
    button.setAttribute('aria-current', 'page')
  }

  button.disabled = isDisabled

  if (!isDisabled && page !== currentPage) {
    button.addEventListener('click', () => {
      currentPage = page
      renderWithCurrentFilters()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return button
}

/* Genera la paginación visible según el total de mascotas filtradas. */
function renderPagination(totalItems) {
  const pagination = getPaginationElement()
  if (!pagination) return

  pagination.innerHTML = ''

  if (totalItems === 0) {
    pagination.hidden = true
    return
  }

  const totalPages = getTotalPages(totalItems)
  pagination.hidden = false

  pagination.appendChild(
    createPaginationButton('<', currentPage - 1, {
      isDisabled: currentPage === 1,
      ariaLabel: 'Página anterior'
    })
  )

  for (let page = 1; page <= totalPages; page += 1) {
    pagination.appendChild(
      createPaginationButton(String(page), page, {
        isActive: page === currentPage,
        ariaLabel: `Ir a la página ${page}`
      })
    )
  }

  pagination.appendChild(
    createPaginationButton('>', currentPage + 1, {
      isDisabled: currentPage === totalPages,
      ariaLabel: 'Página siguiente'
    })
  )
}

function setSelectOptions(selectElement, options, placeholder) {
  if (!selectElement) return

  const previousValue = selectElement.value
  selectElement.innerHTML = ''

  const placeholderOption = document.createElement('option')
  placeholderOption.value = ''
  placeholderOption.textContent = placeholder
  selectElement.appendChild(placeholderOption)

  options.forEach((option) => {
    const element = document.createElement('option')
    element.value = String(option.value)
    element.textContent = option.label
    selectElement.appendChild(element)
  })

  const stillExists = options.some((option) => String(option.value) === previousValue)
  selectElement.value = stillExists ? previousValue : ''
}

function getBreedsFromPets(pets) {
  const unique = new Map()

  pets.forEach((pet) => {
    const breed = String(pet.breed ?? '').trim()
    if (!breed) return

    const key = normalizeText(breed)
    if (!unique.has(key)) {
      unique.set(key, breed)
    }
  })

  return Array.from(unique.values())
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((breed) => ({ value: breed, label: breed }))
}

function filterByAgeRange(pet, ageRange) {
  if (!ageRange) return true
  if (!Number.isFinite(pet.age)) return false

  if (ageRange === '0-3') return pet.age >= 0 && pet.age <= 3
  if (ageRange === '4-7') return pet.age >= 4 && pet.age <= 7
  if (ageRange === '8+') return pet.age >= 8

  return true
}

function getFilteredPets(options = {}) {
  const { ignoreBreed = false } = options

  const communityId = safeNumber(filterElements.comunidad?.value)
  const provinceId = safeNumber(filterElements.provincia?.value)
  const speciesId = safeNumber(filterElements.especie?.value)
  const sizeId = safeNumber(filterElements.tamano?.value)
  const breed = normalizeText(filterElements.raza?.value)
  const gender = filterElements.genero?.value || ''
  const ageRange = filterElements.edad?.value || ''

  return allPets.filter((pet) => {
    if (communityId && pet.community_id !== communityId) return false
    if (provinceId && pet.province_id !== provinceId) return false
    if (speciesId && pet.species_id !== speciesId) return false
    if (sizeId && pet.size_id !== sizeId) return false

    if (!ignoreBreed && breed) {
      if (normalizeText(pet.breed) !== breed) return false
    }

    if (gender === 'macho' && pet.sex !== true) return false
    if (gender === 'hembra' && pet.sex !== false) return false

    if (!filterByAgeRange(pet, ageRange)) return false

    return true
  })
}

function updateProvinceOptions() {
  const communityId = safeNumber(filterElements.comunidad?.value)

  const provinceOptions = lookups.provinces
    .filter((province) => !communityId || province.community_id === communityId)
    .map((province) => ({ value: province.id, label: province.name }))

  setSelectOptions(filterElements.provincia, provinceOptions, 'Provincia')
}

function updateBreedOptions() {
  const filteredWithoutBreed = getFilteredPets({ ignoreBreed: true })
  const breedOptions = getBreedsFromPets(filteredWithoutBreed)
  setSelectOptions(filterElements.raza, breedOptions, 'Raza')
}

/* Rellena los select base con comunidades, provincias y catálogos. */
function populateBaseFilters() {
  const communityOptions = lookups.communities.map((community) => ({
    value: community.id,
    label: community.name
  }))
  const speciesOptions = lookups.species.map((item) => ({ value: item.id, label: item.name }))
  const sizeOptions = lookups.sizes.map((item) => ({ value: item.id, label: item.name }))

  setSelectOptions(filterElements.comunidad, communityOptions, 'Comunidad autónoma')
  setSelectOptions(filterElements.especie, speciesOptions, 'Especie')
  setSelectOptions(filterElements.tamano, sizeOptions, 'Tamaño')

  updateProvinceOptions()
  updateBreedOptions()
}

/* Aplica filtros, calcula página actual y vuelve a dibujar la rejilla. */
function renderWithCurrentFilters() {
  const filteredPets = getFilteredPets()
  const paginationState = getPaginationState(filteredPets)

  renderPets(paginationState.items.slice(0, PETS_PER_PAGE))
  renderPagination(paginationState.totalItems)
}

function wireFilterEvents() {
  Object.entries(filterElements).forEach(([key, element]) => {
    if (!element) return

    element.addEventListener('change', () => {
      currentPage = 1

      if (key === 'comunidad') {
        updateProvinceOptions()
      }

      updateBreedOptions()
      renderWithCurrentFilters()
    })
  })
}

/* Inicializa los datos y enlaza los filtros al cargar la página. */
window.addEventListener('DOMContentLoaded', async () => {
  const loaded = await loadPetsData()
  allPets = loaded.pets
  lookups = loaded.lookups

  if (!allPets.length) {
    allPets = fallbackPets
  }

  populateBaseFilters()
  wireFilterEvents()
  renderWithCurrentFilters()
})
