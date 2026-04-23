const supabaseUrl = 'https://hfwkaedcpvpfccwbcrie.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

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
  { name: 'Nombre', age: '2 anos', size: 'Mediano', breed: 'Mestizo', status: '' }
]

/* =========================
   FETCH CON RELACIONES
========================= */
async function fetchPets() {
  const { data, error } = await supabaseClient
    .from('pets')
    .select(`
      id,
      name,
      age,
      breed,
      status (name),
      sex,
      sizes (name),
      pet_images (image_url)
    `)

  if (error) {
    console.error('Error cargando mascotas:', error.message)
    return []
  }

  return data ?? []
}

/* =========================
   META INFO
========================= */
function buildMeta(pet) {
  const age = pet.age ? `${pet.age} anos` : 'Edad'
  const size = pet.sizes?.name ?? 'Tamano'
  const breed = pet.breed ?? 'Raza'

  return `${age} - ${size} - ${breed}`
}

function getSexClass(pet) {
  if (pet.sex === true) return 'male'
  if (pet.sex === false) return 'female'
  return ''
}

/* =========================
   IMAGEN
========================= */
function getImage(pet, index) {
  if (pet.pet_images && pet.pet_images.length > 0) {
    const path = pet.pet_images[0].image_url
    if (typeof path === 'string' && path.startsWith('http')) {
      return path
    }

    const { data } = supabaseClient.storage
      .from('pet-images')
      .getPublicUrl(path)

    return data?.publicUrl ?? fallbackImages[index % fallbackImages.length]
  }

  return fallbackImages[index % fallbackImages.length]
}

/* =========================
   RENDER
========================= */
function renderPets(pets) {
  const grid = document.getElementById('adopta-grid')
  const template = document.getElementById('card-mascota-template')
  if (!grid || !template) return

  grid.innerHTML = ''

  pets.forEach((pet, index) => {
    const clone = template.content.cloneNode(true)
    const card = clone.querySelector('.card-mascota')
    const badge = clone.querySelector('[data-status]')
    const img = clone.querySelector('[data-image]')
    const name = clone.querySelector('[data-name]')
    const meta = clone.querySelector('[data-meta]')
    const sex = clone.querySelector('[data-sex]')

    // STATUS (desde tabla status)
    if (badge) {
      const status = pet.status?.name

      if (status && String(status).trim().toLowerCase() !== 'disponible') {
        badge.textContent = status
      } else {
        badge.remove()
      }
    }

    // IMAGEN
    if (img) img.src = getImage(pet, index)

    // NOMBRE
    if (name) name.textContent = pet.name ?? 'Nombre'

    // META
    if (meta) meta.textContent = buildMeta(pet)

    // SEXO
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

    if (card) grid.appendChild(card)
  })
}

/* =========================
   INIT
========================= */
window.addEventListener('DOMContentLoaded', async () => {
  const pets = await fetchPets()

  if (!pets || pets.length === 0) {
    renderPets(fallbackPets)
    return
  }

  renderPets(pets)
})
