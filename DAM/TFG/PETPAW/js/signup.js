(function initSignupPage() {
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

  const form = document.getElementById('signup-form');
  if (!form) return;

  const state = {
    communities: [],
    provinces: []
  };

  const nameInput = document.getElementById('signup-name');
  const surnamesInput = document.getElementById('signup-lastname');
  const emailInput = document.getElementById('signup-email');
  const phoneInput = document.getElementById('signup-phone');
  const addressInput = document.getElementById('signup-address');
  const communityInput = document.getElementById('signup-community');
  const provinceInput = document.getElementById('signup-province');
  const passwordInput = document.getElementById('signup-password');
  const termsInput = document.getElementById('signup-terms');
  const submitButton = form.querySelector('button[type="submit"]');
  const messageBox = document.getElementById('signup-message');
  const redirectTarget = helpers.getRedirectTarget('index.html');
  const accountTypeInputs = Array.from(form.querySelectorAll('input[name="account-type"]'));
  const surnameGroup = document.getElementById('signup-lastname-group');
  const addressGroup = document.getElementById('signup-address-group');
  const communityGroup = document.getElementById('signup-community-group');
  const provinceGroup = document.getElementById('signup-province-group');
  const nameLabel = form.querySelector('label[for="signup-name"]');

  function showMessage(text, type) {
    if (!messageBox) return;

    messageBox.textContent = text;
    messageBox.classList.remove('is-error', 'is-success', 'is-hidden');

    if (type === 'success') {
      messageBox.classList.add('is-success');
    } else {
      messageBox.classList.add('is-error');
    }
  }

  function clearMessage() {
    if (!messageBox) return;
    messageBox.textContent = '';
    messageBox.classList.add('is-hidden');
    messageBox.classList.remove('is-error', 'is-success');
  }

  function wirePasswordToggle() {
    const toggle = form.querySelector('[data-password-toggle]');
    if (!toggle || !passwordInput) return;

    toggle.addEventListener('click', () => {
      const nextType = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = nextType;
      toggle.classList.toggle('bi-eye', nextType === 'password');
      toggle.classList.toggle('bi-eye-slash', nextType === 'text');
    });
  }

  function getSelectedAccountType() {
    const selected = accountTypeInputs.find((input) => input.checked);
    return selected?.value || '';
  }

  function isShelterMode() {
    return getSelectedAccountType() === 'shelter';
  }

  function setInputRequired(input, isRequired) {
    if (!input) return;
    input.required = Boolean(isRequired);
  }

  function resetProvinceSelect() {
    if (!provinceInput) return;
    provinceInput.innerHTML = '<option value="">Selecciona una provincia</option>';
    provinceInput.value = '';
  }

  function renderProvinceOptions(communityId) {
    if (!provinceInput) return;

    const normalizedCommunityId = Number(communityId);
    const provinces = state.provinces
      .filter((province) => !normalizedCommunityId || province.community_id === normalizedCommunityId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));

    const options = ['<option value="">Selecciona una provincia</option>']
      .concat(provinces.map((province) => `<option value="${province.id}">${province.name}</option>`));

    provinceInput.innerHTML = options.join('');
  }

  function renderCommunityOptions() {
    if (!communityInput) return;

    const options = ['<option value="">Selecciona una comunidad</option>']
      .concat(
        [...state.communities]
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'))
          .map((community) => `<option value="${community.id}">${community.name}</option>`)
      );

    communityInput.innerHTML = options.join('');
  }

  function updateFormMode() {
    const shelterMode = isShelterMode();

    if (nameLabel) {
      nameLabel.textContent = shelterMode ? 'Nombre de la protectora' : 'Nombre';
    }

    if (nameInput) {
      nameInput.placeholder = shelterMode ? 'Ingresa el nombre de la protectora' : 'Ingresa tu nombre';
      nameInput.autocomplete = shelterMode ? 'organization' : 'given-name';
    }

    if (surnameGroup) {
      surnameGroup.hidden = shelterMode;
    }

    if (addressGroup) {
      addressGroup.hidden = !shelterMode;
    }

    if (communityGroup) {
      communityGroup.hidden = !shelterMode;
    }

    if (provinceGroup) {
      provinceGroup.hidden = !shelterMode;
    }

    setInputRequired(surnamesInput, !shelterMode);
    setInputRequired(addressInput, shelterMode);
    setInputRequired(communityInput, shelterMode);
    setInputRequired(provinceInput, shelterMode);

    if (shelterMode) {
      renderCommunityOptions();
      renderProvinceOptions(communityInput?.value || '');
    } else {
      if (surnamesInput) surnamesInput.value = '';
      if (addressInput) addressInput.value = '';
      if (communityInput) communityInput.value = '';
      resetProvinceSelect();
    }
  }

  async function safeSelect(table, columns) {
    const { data, error } = await supabaseClient.from(table).select(columns);
    if (error) {
      throw error;
    }
    return data || [];
  }

  async function loadLocationCatalogs() {
    const [communities, provinces] = await Promise.all([
      safeSelect('autonomous_communities', 'id, name'),
      safeSelect('provinces', 'id, name, community_id')
    ]);

    state.communities = communities;
    state.provinces = provinces;
    renderCommunityOptions();
    resetProvinceSelect();
  }

  async function redirectIfLoggedIn() {
    try {
      const profile = await helpers.getCurrentUserProfile(supabaseClient);
      if (profile) {
        window.location.replace(helpers.resolvePostLoginTarget(profile.role, redirectTarget));
      }
    } catch (error) {
      console.error('[PETPAW] Error leyendo sesion:', error.message);
    }
  }

  async function createShelterRecord(payload) {
    const { data, error } = await supabaseClient
      .from('shelters')
      .insert({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        community_id: payload.community_id,
        province_id: payload.province_id,
        rol: 'shelter'
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  async function syncClientProfile(authUser, baseProfile) {
    helpers.savePendingProfile(baseProfile, authUser.id);

    const syncProfile = await helpers.ensureUserProfile(supabaseClient, authUser, baseProfile);
    if (!syncProfile.ok) {
      console.warn('[PETPAW] Perfil pendiente de sincronizar en users:', {
        reason: syncProfile.reason,
        error: syncProfile.error?.message || null,
        insertError: syncProfile.insertError?.message || null,
        userId: authUser.id
      });
    }

    return syncProfile;
  }

  async function syncShelterProfile(authUser, shelterProfile) {
    const shelterId = await createShelterRecord(shelterProfile);
    const profilePayload = {
      name: shelterProfile.name,
      surnames: '',
      email: shelterProfile.email,
      phone: shelterProfile.phone,
      role: 'shelter',
      shelter_id: shelterId
    };

    helpers.savePendingProfile(profilePayload, authUser.id);

    const syncProfile = await helpers.ensureUserProfile(supabaseClient, authUser, profilePayload);
    if (!syncProfile.ok) {
      console.warn('[PETPAW] Perfil shelter pendiente de sincronizar en users:', {
        reason: syncProfile.reason,
        error: syncProfile.error?.message || null,
        insertError: syncProfile.insertError?.message || null,
        userId: authUser.id,
        shelterId
      });
    }

    return syncProfile;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const accountType = getSelectedAccountType();
    const shelterMode = accountType === 'shelter';
    const name = helpers.normalizeText(nameInput?.value);
    const surnames = helpers.normalizeText(surnamesInput?.value);
    const email = helpers.normalizeText(emailInput?.value);
    const phone = helpers.normalizeText(phoneInput?.value);
    const address = helpers.normalizeText(addressInput?.value);
    const communityId = Number(communityInput?.value);
    const provinceId = Number(provinceInput?.value);
    const password = passwordInput?.value || '';
    const acceptedTerms = Boolean(termsInput?.checked);

    if (!accountType) {
      showMessage('Debes indicar si eres una protectora.', 'error');
      return;
    }

    if (!name || !email || !phone || !password) {
      showMessage('Completa todos los campos obligatorios.', 'error');
      return;
    }

    if (!shelterMode && !surnames) {
      showMessage('Completa todos los campos obligatorios.', 'error');
      return;
    }

    if (shelterMode) {
      if (!address || !Number.isInteger(communityId) || communityId <= 0 || !Number.isInteger(provinceId) || provinceId <= 0) {
        showMessage('Completa todos los datos de la protectora.', 'error');
        return;
      }
    }

    if (password.length < 6) {
      showMessage('La contrasena debe tener al menos 6 caracteres.', 'error');
      return;
    }

    if (!acceptedTerms) {
      showMessage('Debes aceptar los terminos y condiciones.', 'error');
      return;
    }

    helpers.setButtonLoadingState(submitButton, true, 'Creando cuenta...');

    try {
      const signUpPayload = shelterMode
        ? {
            name,
            phone,
            role: 'shelter'
          }
        : {
            name,
            surnames,
            phone,
            role: 'client'
          };

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: signUpPayload
        }
      });

      if (error) {
        showMessage(helpers.formatAuthError(error), 'error');
        return;
      }

      const authUser = data.user;
      if (!authUser?.id) {
        showMessage('No se pudo completar el registro. Intentalo de nuevo.', 'error');
        return;
      }

      if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
        showMessage('Este email ya esta registrado. Inicia sesion para continuar.', 'error');
        return;
      }

      const syncProfile = shelterMode
        ? await syncShelterProfile(authUser, {
            name,
            email,
            phone,
            address,
            community_id: communityId,
            province_id: provinceId
          })
        : await syncClientProfile(authUser, {
            name,
            surnames,
            email,
            phone,
            role: 'client'
          });

      if (data.session?.user) {
        if (!syncProfile.ok) {
          showMessage('Cuenta creada. Aviso: no se pudo guardar el perfil completo ahora mismo, pero podras iniciar sesion.', 'success');
          setTimeout(() => {
            window.location.href = helpers.resolvePostLoginTarget(shelterMode ? 'shelter' : 'client', redirectTarget);
          }, 900);
          return;
        }

        showMessage('Cuenta creada correctamente. Redirigiendo...', 'success');
        window.location.href = helpers.resolvePostLoginTarget(shelterMode ? 'shelter' : 'client', redirectTarget);
        return;
      }

      if (!syncProfile.ok) {
        showMessage('Cuenta creada. Revisa tu email para confirmar y luego inicia sesion. El perfil terminara de sincronizarse al acceder.', 'success');
      } else {
        showMessage('Cuenta creada. Revisa tu email para confirmar el registro y luego inicia sesion.', 'success');
      }

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1400);
    } catch (error) {
      console.error('[PETPAW] Error creando cuenta:', error);
      showMessage(helpers.formatAuthError(error), 'error');
    } finally {
      helpers.setButtonLoadingState(submitButton, false, '');
    }
  });

  if (communityInput) {
    communityInput.addEventListener('change', () => {
      renderProvinceOptions(communityInput.value);
    });
  }

  accountTypeInputs.forEach((input) => {
    input.addEventListener('change', updateFormMode);
  });

  wirePasswordToggle();
  updateFormMode();
  loadLocationCatalogs().catch((error) => {
    console.error('[PETPAW] Error cargando comunidades y provincias:', error);
  });
  redirectIfLoggedIn();
})();
