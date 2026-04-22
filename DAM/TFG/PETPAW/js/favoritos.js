(function initFavoritosPage() {
  const helpers = window.PETPAW_AUTH;
  const favoritesService = window.PETPAW_FAVORITES;
  if (!helpers) {
    console.error('[PETPAW] Faltan helpers de autenticacion.');
    return;
  }

  let supabaseClient;
  try {
    supabaseClient = helpers.getSupabaseClient();
  } catch (error) {
    console.error(error.message);
    return;
  }

  const fallbackImages = [
    'resources/img/pexels-svliiim-33699491.jpg',
    'resources/img/pexels-miami302-16676458.jpg',
    'resources/img/pexels-rdne-7348856.jpg',
    'resources/img/pexels-elgolovchenko-31964007.jpg',
    'resources/img/pexels-miami302-16676324.jpg'
  ];

  const state = {
    user: null,
    favorites: [],
    page: 1,
    pageSize: 6
  };

  const elements = {
    feedback: document.getElementById('favorites-feedback'),
    empty: document.getElementById('favorites-empty'),
    grid: document.getElementById('favorites-grid'),
    pagination: document.getElementById('favorites-pagination'),
    template: document.getElementById('card-mascota-template')
  };

  function normalizeRelation(value) {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    return value;
  }

  function showFeedback(message, type) {
    if (!elements.feedback) return;

    elements.feedback.textContent = message || '';
    elements.feedback.classList.remove('is-error', 'is-success');

    if (type === 'error') {
      elements.feedback.classList.add('is-error');
    }

    if (type === 'success') {
      elements.feedback.classList.add('is-success');
    }
  }

  function formatAge(age) {
    if (!Number.isFinite(age)) return 'Edad sin dato';
    if (age === 1) return '1 ano';
    return `${age} anos`;
  }

  function getSexMarkup(sex) {
    if (sex === true) {
      return {
        className: 'male',
        html: '<i class="fa-solid fa-mars" aria-hidden="true"></i>',
        label: 'Macho'
      };
    }

    if (sex === false) {
      return {
        className: 'female',
        html: '<i class="fa-solid fa-venus" aria-hidden="true"></i>',
        label: 'Hembra'
      };
    }

    return {
      className: '',
      html: '',
      label: 'Sin dato'
    };
  }

  function getPublicImage(path, index) {
    if (typeof path === 'string' && path.startsWith('http')) {
      return path;
    }

    if (!path) {
      return fallbackImages[index % fallbackImages.length];
    }

    const storageResult = supabaseClient.storage.from('pet-images').getPublicUrl(path);
    return storageResult?.data?.publicUrl || fallbackImages[index % fallbackImages.length];
  }

  function getMainImage(pet, index) {
    const firstImage = Array.isArray(pet.pet_images) ? pet.pet_images[0] : null;
    return getPublicImage(firstImage?.image_url, index);
  }

  function buildMeta(pet) {
    const sizeName = normalizeRelation(pet.sizes)?.name || 'Tamano sin dato';
    const breed = helpers.normalizeText(pet.breed) || 'Raza sin dato';
    return `${formatAge(pet.age)} - ${sizeName} - ${breed}`;
  }

  function setEmptyState(visible) {
    if (elements.empty) {
      elements.empty.hidden = !visible;
    }

    if (elements.grid) {
      elements.grid.hidden = visible;
    }

    if (elements.pagination) {
      elements.pagination.hidden = visible;
    }
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(state.favorites.length / state.pageSize));
  }

  function getCurrentPageRows() {
    const totalPages = getTotalPages();
    state.page = Math.min(Math.max(state.page, 1), totalPages);

    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    return state.favorites.slice(start, end);
  }

  async function removeFavorite(favoriteId) {
    try {
      if (favoritesService?.removeFavoriteById) {
        await favoritesService.removeFavoriteById(state.user.id, favoriteId);
      } else {
        const { error } = await supabaseClient
          .from('favorites')
          .delete()
          .eq('id', favoriteId)
          .eq('user_id', state.user.id);

        if (error) {
          throw new Error(error.message);
        }
      }
    } catch (error) {
      console.error('[PETPAW] Error quitando favorito:', error.message);
      showFeedback('No se pudo quitar de favoritos. Intentalo otra vez.', 'error');
      return;
    }

    state.favorites = state.favorites.filter((favorite) => favorite.id !== favoriteId);
    showFeedback('Mascota quitada de favoritos.', 'success');

    if (!state.favorites.length) {
      render();
      return;
    }

    const totalPages = getTotalPages();
    if (state.page > totalPages) {
      state.page = totalPages;
    }

    render();
  }

  function renderCards() {
    if (!elements.grid || !elements.template) return;

    elements.grid.innerHTML = '';

    const pageRows = getCurrentPageRows();

    pageRows.forEach((favorite, index) => {
      const pet = favorite.pet;
      if (!pet) return;

      const clone = elements.template.content.cloneNode(true);
      const card = clone.querySelector('.card-mascota');
      const status = clone.querySelector('[data-status]');
      const image = clone.querySelector('[data-image]');
      const name = clone.querySelector('[data-name]');
      const sex = clone.querySelector('[data-sex]');
      const meta = clone.querySelector('[data-meta]');

      const statusName = normalizeRelation(pet.status)?.name || '';
      if (status) {
        if (statusName && String(statusName).trim().toLowerCase() !== 'disponible') {
          status.textContent = statusName;
        } else {
          status.remove();
        }
      }

      if (image) {
        image.src = getMainImage(pet, index);
        image.alt = pet.name ? `${pet.name} en favoritos` : 'Mascota favorita';
      }

      if (name) {
        name.textContent = pet.name || 'Mascota';
      }

      if (meta) {
        meta.textContent = buildMeta(pet);
      }

      if (sex) {
        const sexInfo = getSexMarkup(pet.sex);
        if (sexInfo.className) {
          sex.classList.add(sexInfo.className);
          sex.innerHTML = sexInfo.html;
          sex.setAttribute('aria-label', sexInfo.label);
        } else {
          sex.remove();
        }
      }

      if (card) {
        card.setAttribute('role', 'link');
        card.tabIndex = 0;

        const goToDetail = () => {
          window.location.href = `card.html?id=${pet.id}`;
        };

        card.addEventListener('click', goToDetail);
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            goToDetail();
          }
        });
      }

      elements.grid.appendChild(clone);
    });
  }

  function renderPagination() {
    if (!elements.pagination) return;

    const totalPages = getTotalPages();
    elements.pagination.innerHTML = '';

    if (!state.favorites.length) {
      elements.pagination.hidden = true;
      return;
    }

    elements.pagination.hidden = false;

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'pagination-item';
    prevButton.innerHTML = '<i class="bi bi-chevron-left"></i>';
    prevButton.disabled = state.page === 1;
    prevButton.addEventListener('click', () => {
      state.page -= 1;
      render();
    });
    elements.pagination.appendChild(prevButton);

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pagination-item${pageNumber === state.page ? ' is-active' : ''}`;
      button.textContent = String(pageNumber);
      button.addEventListener('click', () => {
        state.page = pageNumber;
        render();
      });
      elements.pagination.appendChild(button);
    }

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'pagination-item';
    nextButton.innerHTML = '<i class="bi bi-chevron-right"></i>';
    nextButton.disabled = state.page === totalPages;
    nextButton.addEventListener('click', () => {
      state.page += 1;
      render();
    });
    elements.pagination.appendChild(nextButton);
  }

  function render() {
    if (!state.favorites.length) {
      setEmptyState(true);
      return;
    }

    setEmptyState(false);
    renderCards();
    renderPagination();
  }

  async function fetchFavoritesWithPets(userId) {
    const { data: favoritesRows, error: favoritesError } = await supabaseClient
      .from('favorites')
      .select('id, pet_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (favoritesError) {
      throw new Error(favoritesError.message);
    }

    const petIds = Array.from(
      new Set((favoritesRows || []).map((row) => row.pet_id).filter((id) => Number.isInteger(id)))
    );

    if (!petIds.length) {
      return [];
    }

    const { data: petsRows, error: petsError } = await supabaseClient
      .from('pets')
      .select(`
        id,
        name,
        sex,
        age,
        breed,
        description,
        created_at,
        species_id,
        status_id,
        size_id,
        shelter_id,
        pet_images (image_url),
        sizes (name),
        status (name),
        species (name),
        shelters (name, address, email)
      `)
      .in('id', petIds);

    if (petsError) {
      throw new Error(petsError.message);
    }

    const petsById = new Map((petsRows || []).map((pet) => [pet.id, pet]));

    return (favoritesRows || [])
      .map((favorite) => ({
        ...favorite,
        pet: petsById.get(favorite.pet_id) || null
      }))
      .filter((favorite) => favorite.pet);
  }

  async function resolveUser() {
    let authUser = null;

    if (favoritesService?.getCurrentUser) {
      authUser = await favoritesService.getCurrentUser();
    } else {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        throw new Error(error.message);
      }
      authUser = data?.session?.user || null;
    }

    if (!authUser) {
      return null;
    }

    const profileSync = await helpers.ensureUserProfile(supabaseClient, authUser);
    if (!profileSync.ok) {
      console.warn('[PETPAW] Perfil pendiente en favoritos:', profileSync.reason);
    }

    return authUser;
  }

  function redirectToLogin() {
    if (favoritesService?.redirectToLogin) {
      favoritesService.redirectToLogin('favoritos.html');
      return;
    }

    window.location.href = 'login.html?redirect=favoritos.html';
  }

  async function init() {
    try {
      showFeedback('Cargando favoritos...');
      state.user = await resolveUser();

      if (!state.user) {
        redirectToLogin();
        return;
      }

      state.favorites = await fetchFavoritesWithPets(state.user.id);
      showFeedback('');
      render();
    } catch (error) {
      console.error('[PETPAW] Error cargando favoritos:', error.message);
      showFeedback(`No se pudo cargar tu lista de favoritos: ${error.message}`, 'error');
      if (elements.empty) elements.empty.hidden = true;
      if (elements.grid) {
        elements.grid.hidden = true;
        elements.grid.innerHTML = '';
      }
      if (elements.pagination) {
        elements.pagination.hidden = true;
        elements.pagination.innerHTML = '';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
