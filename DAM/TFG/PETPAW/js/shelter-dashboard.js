(function initShelterDashboard() {
  const helpers = window.PETPAW_AUTH;
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

  const state = {
    profile: null,
    shelter: null,
    pets: [],
    existingImages: [],
    pendingImages: [],
    removedImageIds: [],
    catalogs: {
      sizes: [],
      statuses: [],
      species: []
    },
    editingPetId: null,
    isSaving: false
  };

  const elements = {
    shelterName: document.getElementById('shelterName'),
    shelterMeta: document.getElementById('shelterMeta'),
    managerName: document.getElementById('managerName'),
    managerEmail: document.getElementById('managerEmail'),
    managerPhone: document.getElementById('managerPhone'),
    metricTotal: document.getElementById('metricTotal'),
  metricWithStatus: document.getElementById('metricWithStatus'),
    dashboardState: document.getElementById('dashboardState'),
    petsList: document.getElementById('petsList'),
    petsEmptyState: document.getElementById('petsEmptyState'),
    petFormModal: document.getElementById('petFormModal'),
    petFormTitle: document.getElementById('petFormTitle'),
    petForm: document.getElementById('petForm'),
    formState: document.getElementById('formState'),
    savePetButton: document.getElementById('savePetButton'),
    newPetButton: document.getElementById('newPetButton'),
    logoutButton: document.getElementById('logoutButton'),
    petName: document.getElementById('petName'),
    petSex: document.getElementById('petSex'),
    petAge: document.getElementById('petAge'),
    petBreed: document.getElementById('petBreed'),
    petSize: document.getElementById('petSize'),
    petStatus: document.getElementById('petStatus'),
    petSpecies: document.getElementById('petSpecies'),
    petDescription: document.getElementById('petDescription'),
    petImagesInput: document.getElementById('petImagesInput'),
    existingImagesList: document.getElementById('existingImagesList'),
    pendingImagesList: document.getElementById('pendingImagesList')
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showDashboardState(message, type = '') {
    if (!elements.dashboardState) return;

    elements.dashboardState.textContent = message || '';
    elements.dashboardState.className = 'dashboard-state';

    if (type) {
      elements.dashboardState.classList.add(`is-${type}`);
    }
  }

  function showFormState(message, type = '') {
    if (!elements.formState) return;

    elements.formState.textContent = message || '';
    elements.formState.className = 'form-state';

    if (type) {
      elements.formState.classList.add(`is-${type}`);
    }
  }

  function formatFullName(profile) {
    const fullName = `${helpers.normalizeText(profile?.name)} ${helpers.normalizeText(profile?.surnames)}`.trim();
    return fullName || 'Cuenta shelter';
  }

  function formatSexLabel(sex) {
    if (sex === true) return 'Macho';
    if (sex === false) return 'Hembra';
    return 'Sin sexo';
  }

  function parseSexValue(value) {
    if (value === 'male') return true;
    if (value === 'female') return false;
    return null;
  }

  function formatDate(dateValue) {
    if (!dateValue) return 'Sin fecha';

    try {
      return new Date(dateValue).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Sin fecha';
    }
  }

  function getStatusName(pet) {
    return pet?.status?.name || 'Sin estado';
  }

  function getSizeName(pet) {
    return pet?.sizes?.name || 'Sin tamano';
  }

  function getSpeciesName(pet) {
    return pet?.species?.name || 'Sin especie';
  }

  function getImageCount(pet) {
    return Array.isArray(pet?.pet_images) ? pet.pet_images.length : 0;
  }

  function sanitizeFileName(fileName) {
    return String(fileName || 'image')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }

  function extractStoragePath(imageUrl) {
    const normalizedUrl = helpers.normalizeText(imageUrl);
    if (!normalizedUrl) return null;

    const marker = '/storage/v1/object/public/petpaw-images/';
    const markerIndex = normalizedUrl.indexOf(marker);
    if (markerIndex === -1) return null;

    return decodeURIComponent(normalizedUrl.slice(markerIndex + marker.length));
  }

  function revokePendingPreviews() {
    state.pendingImages.forEach((image) => {
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
  }

  function renderExistingImages() {
    if (!elements.existingImagesList) return;

    if (!state.existingImages.length) {
      elements.existingImagesList.innerHTML = '<p class="image-empty">No hay fotos guardadas todavia.</p>';
      return;
    }

    elements.existingImagesList.innerHTML = state.existingImages.map((image) => `
      <article class="image-card" data-image-id="${image.id}">
        <img src="${escapeHtml(image.image_url)}" alt="Foto de mascota" />
        <p class="image-card-name">Foto guardada</p>
        <button type="button" data-action="remove-existing-image" data-image-id="${image.id}">
          Eliminar
        </button>
      </article>
    `).join('');
  }

  function renderPendingImages() {
    if (!elements.pendingImagesList) return;

    if (!state.pendingImages.length) {
      elements.pendingImagesList.innerHTML = '<p class="image-empty">No has seleccionado imagenes nuevas.</p>';
      return;
    }

    elements.pendingImagesList.innerHTML = state.pendingImages.map((image) => `
      <article class="image-card" data-pending-key="${image.key}">
        <img src="${escapeHtml(image.previewUrl)}" alt="Vista previa" />
        <p class="image-card-name">${escapeHtml(image.file.name)}</p>
        <button type="button" data-action="remove-pending-image" data-pending-key="${image.key}">
          Quitar
        </button>
      </article>
    `).join('');
  }

  function setCurrentImages(images = []) {
    state.existingImages = [...images];
    state.removedImageIds = [];
    revokePendingPreviews();
    state.pendingImages = [];

    if (elements.petImagesInput) {
      elements.petImagesInput.value = '';
    }

    renderExistingImages();
    renderPendingImages();
  }

  function isIncompletePet(pet) {
    return !helpers.normalizeText(pet?.name)
      || !Number.isFinite(pet?.age)
      || !pet?.size_id
      || !pet?.status_id
      || !pet?.species_id;
  }

  function setSummary() {
    const total = state.pets.length;
    const adopted = state.pets.filter((pet) => {
      const statusName = helpers.normalizeText(normalizeRelation(pet?.status)?.name);
      return statusName.toLowerCase() === 'adoptado';
    }).length;

    if (elements.metricTotal) elements.metricTotal.textContent = String(total);
    if (elements.metricWithStatus) elements.metricWithStatus.textContent = String(adopted);
  }

  function renderHeader() {
    if (elements.shelterName) {
      elements.shelterName.textContent = state.shelter?.name || 'Shelter sin nombre';
    }

    if (elements.shelterMeta) {
      const address = helpers.normalizeText(state.shelter?.address);
      elements.shelterMeta.textContent = address || 'Sin ubicacion registrada';
    }

    if (elements.managerName) {
      elements.managerName.textContent = formatFullName(state.profile);
    }

    if (elements.managerEmail) {
      elements.managerEmail.textContent = helpers.normalizeText(state.profile?.email) || 'Sin email';
    }

    if (elements.managerPhone) {
      elements.managerPhone.textContent = helpers.normalizeText(state.profile?.phone || state.shelter?.phone) || 'Sin telefono';
    }
  }

  function renderSelect(select, items, placeholder) {
    if (!select) return;

    const options = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    ];

    select.innerHTML = options.join('');
  }

  function renderCatalogs() {
    renderSelect(elements.petSize, state.catalogs.sizes, 'Selecciona un tamano');
    renderSelect(elements.petStatus, state.catalogs.statuses, 'Selecciona un estado');
    renderSelect(elements.petSpecies, state.catalogs.species, 'Selecciona una especie');
  }

  function renderPets() {
    if (!elements.petsList || !elements.petsEmptyState) return;

    elements.petsList.innerHTML = '';
    const hasPets = state.pets.length > 0;
    elements.petsEmptyState.hidden = hasPets;

    if (!hasPets) {
      setSummary();
      return;
    }

    const cards = state.pets.map((pet) => {
      const description = helpers.normalizeText(pet.description) || 'Sin descripcion.';
      const breed = helpers.normalizeText(pet.breed) || 'Sin raza';

      return `
        <article class="pet-card" data-pet-id="${pet.id}">
          <div class="pet-card-top">
            <div>
              <h3 class="pet-card-name">${escapeHtml(pet.name || 'Mascota sin nombre')}</h3>
              <p class="pet-card-meta">${escapeHtml(getSpeciesName(pet))} · ${escapeHtml(breed)} · ${escapeHtml(formatSexLabel(pet.sex))}</p>
            </div>

            <div class="pet-card-actions">
              <button class="btn-secondary" type="button" data-action="edit" data-pet-id="${pet.id}">
                <i class="bi bi-pencil-square"></i>
                Editar
              </button>
              <button class="btn-secondary" type="button" data-action="delete" data-pet-id="${pet.id}">
                <i class="bi bi-trash3"></i>
                Eliminar
              </button>
            </div>
          </div>

          <div class="pet-card-tags">
            <span class="pet-tag">${escapeHtml(getStatusName(pet))}</span>
            <span class="pet-tag">${escapeHtml(getSizeName(pet))}</span>
            <span class="pet-tag">${Number.isFinite(pet.age) ? `${pet.age} anos` : 'Edad no indicada'}</span>
            <span class="pet-tag">${getImageCount(pet)} fotos</span>
          </div>

          <p class="pet-description">${escapeHtml(description)}</p>

          <div class="pet-card-footer">
            <span class="pet-created-at">Creada el ${escapeHtml(formatDate(pet.created_at))}</span>
            ${isIncompletePet(pet) ? '<span class="pet-tag">Ficha incompleta</span>' : ''}
          </div>
        </article>
      `;
    });

    elements.petsList.innerHTML = cards.join('');
    setSummary();
  }

  function resetForm() {
    state.editingPetId = null;
    elements.petForm?.reset();
    showFormState('');
    setCurrentImages();

    if (elements.petFormTitle) {
      elements.petFormTitle.textContent = 'Nueva mascota';
    }

    if (elements.savePetButton) {
      elements.savePetButton.textContent = 'Guardar mascota';
      elements.savePetButton.disabled = false;
    }
  }

  function openFormForCreate() {
    resetForm();
    elements.petFormModal?.removeAttribute('hidden');
    elements.petName?.focus();
  }

  function openFormForEdit(pet) {
    if (!pet) return;

    resetForm();
    state.editingPetId = pet.id;

    if (elements.petFormTitle) {
      elements.petFormTitle.textContent = 'Editar mascota';
    }

    if (elements.savePetButton) {
      elements.savePetButton.textContent = 'Guardar cambios';
    }

    if (elements.petName) elements.petName.value = pet.name || '';
    if (elements.petSex) elements.petSex.value = pet.sex === true ? 'male' : pet.sex === false ? 'female' : '';
    if (elements.petAge) elements.petAge.value = Number.isFinite(pet.age) ? String(pet.age) : '';
    if (elements.petBreed) elements.petBreed.value = pet.breed || '';
    if (elements.petSize) elements.petSize.value = pet.size_id ? String(pet.size_id) : '';
    if (elements.petStatus) elements.petStatus.value = pet.status_id ? String(pet.status_id) : '';
    if (elements.petSpecies) elements.petSpecies.value = pet.species_id ? String(pet.species_id) : '';
    if (elements.petDescription) elements.petDescription.value = pet.description || '';
    setCurrentImages(Array.isArray(pet.pet_images) ? pet.pet_images : []);

    elements.petFormModal?.removeAttribute('hidden');
    elements.petName?.focus();
  }

  function closeForm() {
    elements.petFormModal?.setAttribute('hidden', '');
    showFormState('');
  }

  async function resolveSessionUser() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      throw error;
    }

    return data.session?.user || null;
  }

  async function findShelterByEmail(email) {
    const normalizedEmail = helpers.normalizeText(email).toLowerCase();
    if (!normalizedEmail) return null;

    const { data, error } = await supabaseClient
      .from('shelters')
      .select('id, name, email, phone, address')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  }

  async function repairShelterProfile(profile, sessionUser) {
    const shelterRecord = await findShelterByEmail(profile?.email || sessionUser?.email || '');
    if (!shelterRecord || !sessionUser?.id) {
      return null;
    }

    const repairedProfile = {
      id: sessionUser.id,
      name: profile?.name || sessionUser.user_metadata?.name || shelterRecord.name || '',
      surnames: profile?.surnames || sessionUser.user_metadata?.surnames || '',
      email: profile?.email || sessionUser.email || shelterRecord.email || '',
      phone: profile?.phone || sessionUser.user_metadata?.phone || shelterRecord.phone || '',
      role: 'shelter',
      shelter_id: shelterRecord.id
    };

    helpers.savePendingProfile(repairedProfile, sessionUser.id);
    const syncResult = await helpers.ensureUserProfile(supabaseClient, sessionUser, repairedProfile);
    if (!syncResult.ok) {
      console.warn('[PETPAW] No se pudo reparar el perfil shelter:', syncResult.reason, syncResult.error?.message || '');
    }

    return {
      ...repairedProfile,
      profileMissing: false
    };
  }

  async function requireShelterProfile() {
    const sessionUser = await resolveSessionUser();
    if (!sessionUser) {
      window.location.replace('login.html?redirect=shelter-dashboard.html');
      return null;
    }

    let profile = await helpers.getCurrentUserProfile(supabaseClient);

    if (!profile) {
      profile = {
        id: sessionUser.id,
        name: sessionUser.user_metadata?.name || '',
        surnames: sessionUser.user_metadata?.surnames || '',
        email: sessionUser.email || '',
        phone: sessionUser.user_metadata?.phone || '',
        role: helpers.normalizeText(sessionUser.user_metadata?.role) || 'client',
        shelter_id: sessionUser.user_metadata?.shelter_id ?? null,
        profileMissing: true
      };
    }

    if (!helpers.isShelterRole(profile.role) || !profile.shelter_id) {
      const repairedProfile = await repairShelterProfile(profile, sessionUser);
      if (repairedProfile) {
        profile = repairedProfile;
      }
    }

    if (!helpers.isShelterRole(profile.role)) {
      window.location.replace('index.html');
      return null;
    }

    if (!profile.shelter_id) {
      throw new Error('Tu cuenta no esta vinculada a ninguna shelter.');
    }

    return profile;
  }

  async function loadShelter() {
    const { data, error } = await supabaseClient
      .from('shelters')
      .select('id, name, email, phone, address')
      .eq('id', state.profile.shelter_id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('No se encontro la shelter asociada a esta cuenta.');
    }

    state.shelter = data;
  }

  async function loadCatalogs() {
    const [sizesResult, statusesResult, speciesResult] = await Promise.all([
      supabaseClient.from('sizes').select('id, name').order('name'),
      supabaseClient.from('status').select('id, name').order('name'),
      supabaseClient.from('species').select('id, name').order('name')
    ]);

    if (sizesResult.error) throw sizesResult.error;
    if (statusesResult.error) throw statusesResult.error;
    if (speciesResult.error) throw speciesResult.error;

    state.catalogs.sizes = sizesResult.data || [];
    state.catalogs.statuses = statusesResult.data || [];
    state.catalogs.species = speciesResult.data || [];
  }

  async function loadPets() {
    const { data, error } = await supabaseClient
      .from('pets')
      .select(`
        id,
        name,
        sex,
        age,
        breed,
        description,
        size_id,
        status_id,
        species_id,
        shelter_id,
        created_at,
        status (
          id,
          name
        ),
        sizes (
          id,
          name
        ),
        species (
          id,
          name
        ),
        pet_images (
          id,
          image_url
        )
      `)
      .eq('shelter_id', state.profile.shelter_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    state.pets = data || [];
    renderPets();
  }

  function buildPetPayload() {
    const name = helpers.normalizeText(elements.petName?.value);
    const age = Number(elements.petAge?.value);
    const breed = helpers.normalizeText(elements.petBreed?.value);
    const description = helpers.normalizeText(elements.petDescription?.value);
    const sizeId = Number(elements.petSize?.value);
    const statusId = Number(elements.petStatus?.value);
    const speciesId = Number(elements.petSpecies?.value);
    const sex = parseSexValue(elements.petSex?.value);

    if (!name) {
      throw new Error('El nombre es obligatorio.');
    }

    if (!Number.isInteger(age) || age < 0) {
      throw new Error('La edad debe ser un numero igual o mayor que 0.');
    }

    if (!Number.isInteger(sizeId) || sizeId <= 0) {
      throw new Error('Selecciona un tamano.');
    }

    if (!Number.isInteger(statusId) || statusId <= 0) {
      throw new Error('Selecciona un estado.');
    }

    if (!Number.isInteger(speciesId) || speciesId <= 0) {
      throw new Error('Selecciona una especie.');
    }

    return {
      name,
      sex,
      age,
      breed: breed || null,
      description: description || null,
      size_id: sizeId,
      status_id: statusId,
      species_id: speciesId,
      shelter_id: state.profile.shelter_id
    };
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target?.files || []);
    if (!files.length) return;

    const nextImages = files.map((file, index) => ({
      key: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    state.pendingImages = state.pendingImages.concat(nextImages);
    renderPendingImages();

    if (elements.petImagesInput) {
      elements.petImagesInput.value = '';
    }
  }

  function handleImageListClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.getAttribute('data-action');

    if (action === 'remove-existing-image') {
      const imageId = Number(button.getAttribute('data-image-id'));
      state.removedImageIds.push(imageId);
      state.existingImages = state.existingImages.filter((image) => image.id !== imageId);
      renderExistingImages();
      return;
    }

    if (action === 'remove-pending-image') {
      const pendingKey = button.getAttribute('data-pending-key');
      const imageToRemove = state.pendingImages.find((image) => image.key === pendingKey);
      if (imageToRemove?.previewUrl) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }

      state.pendingImages = state.pendingImages.filter((image) => image.key !== pendingKey);
      renderPendingImages();
    }
  }

  async function syncRemovedImages(petId) {
    if (!state.removedImageIds.length) return;

    const imagesToRemove = state.existingImages.filter((image) => state.removedImageIds.includes(image.id));
    const storagePaths = imagesToRemove
      .map((image) => extractStoragePath(image.image_url))
      .filter(Boolean);

    const { error: deleteRowsError } = await supabaseClient
      .from('pet_images')
      .delete()
      .in('id', state.removedImageIds)
      .eq('pet_id', petId);

    if (deleteRowsError) {
      throw deleteRowsError;
    }

    if (storagePaths.length) {
      const { error: storageDeleteError } = await supabaseClient.storage
        .from('petpaw-images')
        .remove(storagePaths);

      if (storageDeleteError) {
        console.warn('[PETPAW] No se pudieron borrar algunos archivos del bucket:', storageDeleteError.message);
      }
    }
  }

  async function syncNewImages(petId) {
    if (!state.pendingImages.length) return;

    const createdRows = [];

    for (const [index, image] of state.pendingImages.entries()) {
      const safeFileName = sanitizeFileName(image.file.name);
      const filePath = `pets/${state.profile.shelter_id}/${petId}/${Date.now()}-${index}-${safeFileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('petpaw-images')
        .upload(filePath, image.file, {
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabaseClient.storage
        .from('petpaw-images')
        .getPublicUrl(filePath);

      createdRows.push({
        pet_id: petId,
        image_url: publicUrlData.publicUrl
      });
    }

    const { error: insertImagesError } = await supabaseClient
      .from('pet_images')
      .insert(createdRows);

    if (insertImagesError) {
      throw insertImagesError;
    }
  }

  async function syncPetImages(petId) {
    await syncRemovedImages(petId);
    await syncNewImages(petId);
    setCurrentImages();
  }

  async function savePet(event) {
    event.preventDefault();
    if (state.isSaving) return;

    try {
      state.isSaving = true;
      if (elements.savePetButton) {
        elements.savePetButton.disabled = true;
        elements.savePetButton.textContent = state.editingPetId ? 'Guardando...' : 'Creando...';
      }

      showFormState('Guardando cambios...');
      const payload = buildPetPayload();

      let response;
      if (state.editingPetId) {
        response = await supabaseClient
          .from('pets')
          .update(payload)
          .eq('id', state.editingPetId)
          .eq('shelter_id', state.profile.shelter_id)
          .select('id')
          .single();
      } else {
        response = await supabaseClient
          .from('pets')
          .insert(payload)
          .select('id')
          .single();
      }

      if (response.error) {
        throw response.error;
      }

      const petId = response.data?.id || state.editingPetId;
      if (!petId) {
        throw new Error('No se pudo identificar la mascota guardada.');
      }

      await syncPetImages(petId);

      showFormState(state.editingPetId ? 'Mascota actualizada correctamente.' : 'Mascota creada correctamente.', 'success');
      showDashboardState('Datos guardados correctamente.', 'success');
      await loadPets();

      setTimeout(() => {
        closeForm();
        resetForm();
      }, 350);
    } catch (error) {
      console.error('[PETPAW] Error guardando mascota:', error);
      showFormState(error.message || 'No se pudo guardar la mascota.', 'error');
    } finally {
      state.isSaving = false;

      if (elements.savePetButton) {
        elements.savePetButton.disabled = false;
        elements.savePetButton.textContent = state.editingPetId ? 'Guardar cambios' : 'Guardar mascota';
      }
    }
  }

  async function deletePet(petId) {
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet) return;

    const confirmed = window.confirm(`Vas a eliminar a ${pet.name || 'esta mascota'}. Esta accion no se puede deshacer.`);
    if (!confirmed) return;

    showDashboardState('Eliminando mascota...');

    const { error } = await supabaseClient
      .from('pets')
      .delete()
      .eq('id', petId)
      .eq('shelter_id', state.profile.shelter_id);

    if (error) {
      console.error('[PETPAW] Error eliminando mascota:', error);
      showDashboardState(error.message || 'No se pudo eliminar la mascota.', 'error');
      return;
    }

    showDashboardState('Mascota eliminada correctamente.', 'success');
    await loadPets();
  }

  function handleListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const petId = Number(actionButton.getAttribute('data-pet-id'));
    const pet = state.pets.find((item) => item.id === petId);
    if (!pet) return;

    const action = actionButton.getAttribute('data-action');
    if (action === 'edit') {
      openFormForEdit(pet);
      return;
    }

    if (action === 'delete') {
      deletePet(petId);
    }
  }

  async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      showDashboardState(error.message || 'No se pudo cerrar sesion.', 'error');
      return;
    }

    window.location.href = 'login.html';
  }

  function wireEvents() {
    elements.newPetButton?.addEventListener('click', openFormForCreate);
    elements.logoutButton?.addEventListener('click', logout);
    elements.petForm?.addEventListener('submit', savePet);
    elements.petsList?.addEventListener('click', handleListClick);
    elements.petImagesInput?.addEventListener('change', handleImageSelection);
    elements.existingImagesList?.addEventListener('click', handleImageListClick);
    elements.pendingImagesList?.addEventListener('click', handleImageListClick);

    document.querySelectorAll('[data-open-form]').forEach((button) => {
      button.addEventListener('click', openFormForCreate);
    });

    document.querySelectorAll('[data-close-form]').forEach((button) => {
      button.addEventListener('click', closeForm);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.petFormModal?.hasAttribute('hidden')) {
        closeForm();
      }
    });

    supabaseClient.auth.onAuthStateChange((eventName) => {
      if (eventName === 'SIGNED_OUT') {
        window.location.replace('login.html');
      }
    });
  }

  async function init() {
    showDashboardState('Cargando panel...');
    closeForm();

    try {
      const profile = await requireShelterProfile();
      if (!profile) return;

      state.profile = profile;

      await Promise.all([
        loadShelter(),
        loadCatalogs()
      ]);

      renderHeader();
      renderCatalogs();
      await loadPets();
      showDashboardState('');
    } catch (error) {
      console.error('[PETPAW] Error cargando panel shelter:', error);
      showDashboardState(error.message || 'No se pudo cargar el panel shelter.', 'error');
    }
  }

  wireEvents();
  init();
})();
