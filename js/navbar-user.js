(function initNavbarUser() {
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

  const favoritesHref = 'favoritos.html';
  const shelterDashboardHref = 'shelter-dashboard.html';
  const currentPath = window.location.pathname.toLowerCase();
  const isFavoritesPage = window.location.pathname.toLowerCase().endsWith('favoritos.html');
  const isShelterDashboardPage = window.location.pathname.toLowerCase().endsWith('shelter-dashboard.html');
  const isHomePage = currentPath.endsWith('/index.html') || currentPath.endsWith('index.html') || currentPath.endsWith('/');
  let currentOpenMenu = null;
  let currentProfileModal = null;
  let currentProfileData = null;

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getDisplayName(userData) {
    const firstName = helpers.normalizeText(userData?.name);
    if (firstName) return firstName;

    const email = helpers.normalizeText(userData?.email);
    if (!email) return 'Usuario';

    return email.split('@')[0];
  }

  function getFullName(userData) {
    const name = helpers.normalizeText(userData?.name);
    const surnames = helpers.normalizeText(userData?.surnames);
    const fullName = `${name} ${surnames}`.trim();
    return fullName || 'Perfil sin completar';
  }

  function getInitials(userData) {
    const name = helpers.normalizeText(userData?.name);
    const surnames = helpers.normalizeText(userData?.surnames);
    const first = name.charAt(0).toUpperCase();
    const second = surnames.charAt(0).toUpperCase();
    const initials = `${first}${second}`.trim();

    if (initials) return initials;
    return 'PP';
  }

  function closeMenu() {
    if (!currentOpenMenu) return;

    const { menu, trigger } = currentOpenMenu;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');
    currentOpenMenu = null;
  }

  function closeProfileModal() {
    if (!currentProfileModal) return;

    currentProfileModal.hidden = true;
    document.body.classList.remove('petpaw-modal-open');
  }

  function setProfileFormState(message, isError = false, isSuccess = false) {
    if (!currentProfileModal) return;

    const stateNode = currentProfileModal.querySelector('[data-profile-form-state]');
    if (!stateNode) return;

    stateNode.textContent = message;
    stateNode.classList.toggle('is-error', isError);
    stateNode.classList.toggle('is-success', isSuccess);
  }

  function setProfileFormLoading(isLoading) {
    if (!currentProfileModal) return;

    const submitButton = currentProfileModal.querySelector('[data-profile-submit]');
    if (!submitButton) return;

    if (!submitButton.dataset.defaultText) {
      submitButton.dataset.defaultText = submitButton.textContent || 'Guardar cambios';
    }

    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Guardando...' : submitButton.dataset.defaultText;
  }

  function ensureProfileModal() {
    if (currentProfileModal) {
      return currentProfileModal;
    }

    const modal = document.createElement('div');
    modal.className = 'petpaw-profile-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="petpaw-profile-modal-backdrop" data-close-profile-modal></div>
      <div class="petpaw-profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="petpawProfileModalTitle">
        <div class="petpaw-profile-modal-header">
          <div>
            <p class="petpaw-profile-modal-kicker">Mi cuenta</p>
            <h2 id="petpawProfileModalTitle">Datos personales</h2>
          </div>
          <button class="petpaw-profile-modal-close" type="button" aria-label="Cerrar" data-close-profile-modal>
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <form class="petpaw-profile-form" data-profile-form novalidate>
          <div class="petpaw-profile-grid">
            <label class="petpaw-profile-field">
              <span>Nombre</span>
              <input type="text" maxlength="120" autocomplete="given-name" data-profile-name required />
            </label>

            <label class="petpaw-profile-field">
              <span>Apellidos</span>
              <input type="text" maxlength="160" autocomplete="family-name" data-profile-surnames />
            </label>

            <label class="petpaw-profile-field petpaw-profile-field-full">
              <span>Email</span>
              <input type="email" maxlength="160" autocomplete="email" data-profile-email required />
            </label>

            <label class="petpaw-profile-field">
              <span>Telefono</span>
              <input type="tel" maxlength="40" autocomplete="tel" data-profile-phone />
            </label>

            <label class="petpaw-profile-field">
              <span>Rol</span>
              <input type="text" data-profile-role disabled />
            </label>
          </div>

          <div class="petpaw-profile-password-block">
            <p class="petpaw-profile-section-title">Cambiar contrasena</p>
            <div class="petpaw-profile-grid">
              <label class="petpaw-profile-field">
                <span>Nueva contrasena</span>
                <input type="password" minlength="6" autocomplete="new-password" data-profile-password />
              </label>

              <label class="petpaw-profile-field">
                <span>Repite la contrasena</span>
                <input type="password" minlength="6" autocomplete="new-password" data-profile-password-confirm />
              </label>
            </div>
            <p class="petpaw-profile-help">
              Deja ambos campos vacios si no quieres cambiar la contrasena.
            </p>
          </div>

          <p class="petpaw-profile-form-state" data-profile-form-state aria-live="polite"></p>

          <div class="petpaw-profile-actions">
            <button class="btn btn-outline-dark" type="button" data-close-profile-modal>Cancelar</button>
            <button class="btn btn-dark" type="submit" data-profile-submit>Guardar cambios</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      const closeTarget = event.target.closest('[data-close-profile-modal]');
      if (closeTarget) {
        closeProfileModal();
      }
    });

    const form = modal.querySelector('[data-profile-form]');
    form?.addEventListener('submit', handleProfileSubmit);

    currentProfileModal = modal;
    return modal;
  }

  function getRoleLabel(role) {
    return helpers.isShelterRole(role) ? 'Protectora' : 'Usuario';
  }

  function openProfileModal(userData) {
    const modal = ensureProfileModal();
    currentProfileData = userData;

    modal.querySelector('[data-profile-name]').value = helpers.normalizeText(userData?.name);
    modal.querySelector('[data-profile-surnames]').value = helpers.normalizeText(userData?.surnames);
    modal.querySelector('[data-profile-email]').value = helpers.normalizeText(userData?.email);
    modal.querySelector('[data-profile-phone]').value = helpers.normalizeText(userData?.phone);
    modal.querySelector('[data-profile-role]').value = getRoleLabel(userData?.role);
    modal.querySelector('[data-profile-password]').value = '';
    modal.querySelector('[data-profile-password-confirm]').value = '';

    setProfileFormState('');
    setProfileFormLoading(false);
    modal.hidden = false;
    document.body.classList.add('petpaw-modal-open');
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!currentProfileModal || !currentProfileData) return;

    const name = helpers.normalizeText(currentProfileModal.querySelector('[data-profile-name]')?.value);
    const surnames = helpers.normalizeText(currentProfileModal.querySelector('[data-profile-surnames]')?.value);
    const email = helpers.normalizeText(currentProfileModal.querySelector('[data-profile-email]')?.value).toLowerCase();
    const phone = helpers.normalizeText(currentProfileModal.querySelector('[data-profile-phone]')?.value);
    const password = currentProfileModal.querySelector('[data-profile-password]')?.value || '';
    const passwordConfirm = currentProfileModal.querySelector('[data-profile-password-confirm]')?.value || '';

    if (!name || !email) {
      setProfileFormState('Nombre y email son obligatorios.', true, false);
      return;
    }

    if (password || passwordConfirm) {
      if (password.length < 6) {
        setProfileFormState('La contrasena debe tener al menos 6 caracteres.', true, false);
        return;
      }

      if (password !== passwordConfirm) {
        setProfileFormState('Las contrasenas no coinciden.', true, false);
        return;
      }
    }

    try {
      setProfileFormLoading(true);
      setProfileFormState('Guardando cambios...');

      const { data: authData, error: authError } = await supabaseClient.auth.getUser();
      if (authError) {
        throw authError;
      }

      const authUser = authData?.user;
      if (!authUser) {
        throw new Error('Tu sesion ha caducado. Inicia sesion de nuevo.');
      }

      const authPayload = {
        data: {
          name,
          surnames,
          phone,
          role: currentProfileData.role,
          shelter_id: currentProfileData.shelter_id ?? null
        }
      };

      if (email && email !== helpers.normalizeText(authUser.email).toLowerCase()) {
        authPayload.email = email;
      }

      if (password) {
        authPayload.password = password;
      }

      const { data: updatedAuthData, error: updateAuthError } = await supabaseClient.auth.updateUser(authPayload);
      if (updateAuthError) {
        throw updateAuthError;
      }

      const profilePayload = {
        id: authUser.id,
        name,
        surnames,
        email,
        phone,
        role: currentProfileData.role || 'client',
        shelter_id: currentProfileData.shelter_id ?? null
      };

      const { error: profileUpdateError } = await supabaseClient
        .from('users')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      helpers.savePendingProfile(profilePayload, authUser.id);
      await helpers.ensureUserProfile(supabaseClient, updatedAuthData?.user || authUser, profilePayload);

      currentProfileData = {
        ...currentProfileData,
        ...profilePayload
      };

      const emailChanged = email !== helpers.normalizeText(authUser.email).toLowerCase();
      const passwordChanged = Boolean(password);
      const successMessage = emailChanged
        ? 'Perfil actualizado. Revisa tu email para confirmar el cambio de correo.'
        : passwordChanged
          ? 'Perfil y contrasena actualizados correctamente.'
          : 'Perfil actualizado correctamente.';

      setProfileFormState(successMessage, false, true);
      await renderNavbar();

      window.setTimeout(() => {
        closeProfileModal();
      }, 1200);
    } catch (error) {
      console.error('[PETPAW] Error actualizando perfil:', error);
      setProfileFormState(helpers.formatAuthError(error), true, false);
    } finally {
      setProfileFormLoading(false);
    }
  }

  function toggleMenu(menu, trigger) {
    const sameMenuOpen = currentOpenMenu && currentOpenMenu.menu === menu;

    if (sameMenuOpen) {
      closeMenu();
      return;
    }

    closeMenu();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    currentOpenMenu = { menu, trigger };
  }

  async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error('[PETPAW] Error al cerrar sesion:', error.message);
      return;
    }

    closeMenu();
    await renderNavbar();
  }

  function renderLoggedOut(slot) {
    slot.innerHTML = `
      <div class="navbar-auth-guest">
        <a class="btn btn-outline-dark navbar-auth-btn" href="login.html">Iniciar sesion</a>
        <a class="btn btn-dark navbar-auth-btn" href="signup.html">Registrarse</a>
      </div>
    `;
  }

  function renderLoggedIn(slot, userData) {
    const displayName = escapeHtml(getDisplayName(userData));
    const fullName = escapeHtml(getFullName(userData));
    const email = escapeHtml(helpers.normalizeText(userData.email) || 'Sin email');
    const initials = escapeHtml(getInitials(userData));
    const isShelter = helpers.isShelterRole(userData.role);
    const primaryLink = isShelter
      ? `
        <a class="navbar-favorites-link${isShelterDashboardPage ? ' is-active' : ''}" href="${shelterDashboardHref}" aria-label="Ir al panel de shelter">
          <i class="bi bi-grid"></i>
          <span>Panel</span>
        </a>
      `
      : `
        <a class="navbar-favorites-link${isFavoritesPage ? ' is-active' : ''}" href="${favoritesHref}" aria-label="Ir a favoritos">
          <i class="bi bi-heart"></i>
          <span>Favoritos</span>
        </a>
      `;

    slot.innerHTML = `
      <div class="navbar-auth-user" data-user-shell>
        ${primaryLink}

        <div class="navbar-profile-wrapper" data-profile-wrapper>
          <button class="navbar-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">
            <span class="navbar-profile-icon"><i class="bi bi-person"></i></span>
            <span class="navbar-profile-greeting">Hola, ${displayName}!</span>
            <i class="bi bi-chevron-down navbar-profile-chevron"></i>
          </button>

          <div class="navbar-profile-dropdown" hidden>
            <div class="navbar-dropdown-header">
              <span class="navbar-dropdown-avatar">${initials}</span>
              <div>
                <p class="navbar-dropdown-name">${fullName}</p>
                <p class="navbar-dropdown-email">${email}</p>
              </div>
            </div>

            ${
              userData.profileMissing
                ? '<p class="navbar-profile-warning">No encontramos tu perfil en la tabla users. Puedes completarlo despues desde Datos personales.</p>'
                : ''
            }

            <div class="navbar-dropdown-section">
              <p class="navbar-dropdown-section-title">Cuenta</p>
              <a class="navbar-dropdown-item" href="#" data-action="profile-data">
                <span><i class="bi bi-person-badge"></i> Datos personales</span>
                <i class="bi bi-chevron-right"></i>
              </a>
              <button class="navbar-dropdown-item navbar-dropdown-item-logout" type="button" data-action="logout">
                <span><i class="bi bi-box-arrow-right"></i> Cerrar sesion</span>
                <i class="bi bi-chevron-right"></i>
              </button>
            </div>

            <div class="navbar-dropdown-section">
              <p class="navbar-dropdown-section-title">Soporte</p>
              <a class="navbar-dropdown-item" href="#" data-action="help-center">
                <span><i class="bi bi-question-circle"></i> Centro de ayuda</span>
                <i class="bi bi-chevron-right"></i>
              </a>
              <a class="navbar-dropdown-item" href="#" data-action="about-app">
                <span><i class="bi bi-info-circle"></i> Sobre la app</span>
                <i class="bi bi-chevron-right"></i>
              </a>
              <a class="navbar-dropdown-item" href="#" data-action="legal">
                <span><i class="bi bi-file-earmark-text"></i> Legal</span>
                <i class="bi bi-chevron-right"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = slot.querySelector('[data-profile-wrapper]');
    if (!wrapper) return;

    const trigger = wrapper.querySelector('.navbar-profile-trigger');
    const menu = wrapper.querySelector('.navbar-profile-dropdown');
    const profileDataButton = wrapper.querySelector('[data-action="profile-data"]');
    const logoutButton = wrapper.querySelector('[data-action="logout"]');

    if (trigger && menu) {
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu(menu, trigger);
      });

      menu.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }

    if (profileDataButton) {
      profileDataButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeMenu();
        openProfileModal(userData);
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        await handleLogout();
      });
    }
  }

  async function getUserDataFromSession() {
    return helpers.getCurrentUserProfile(supabaseClient);
  }

  function disableAdminMode() {
    document.body.classList.remove('petpaw-admin-mode');
    document.body.dataset.userRole = 'client';
  }

  function enableAdminMode(userData) {
    document.body.classList.add('petpaw-admin-mode');
    document.body.dataset.userRole = helpers.isShelterRole(userData?.role) ? 'shelter' : 'admin';

    if (typeof window.onPetpawAdminDetected === 'function') {
      window.onPetpawAdminDetected(userData);
    }
  }

  async function renderNavbar() {
    const slots = Array.from(document.querySelectorAll('[data-navbar-auth]'));
    if (!slots.length) return;

    closeMenu();

    try {
      const userData = await getUserDataFromSession();

      if (!userData) {
        disableAdminMode();
        slots.forEach(renderLoggedOut);
        return;
      }

      if (helpers.isShelterRole(userData.role)) {
        if (isHomePage && !isShelterDashboardPage) {
          window.location.replace(shelterDashboardHref);
          return;
        }

        enableAdminMode(userData);
      } else {
        disableAdminMode();
      }

      slots.forEach((slot) => {
        renderLoggedIn(slot, userData);
      });
    } catch (error) {
      console.error('[PETPAW] Error pintando navbar:', error.message);
      slots.forEach(renderLoggedOut);
    }
  }

  document.addEventListener('click', (event) => {
    if (!currentOpenMenu) return;

    const { menu, trigger } = currentOpenMenu;
    const clickedInsideMenu = menu.contains(event.target);
    const clickedTrigger = trigger.contains(event.target);

    if (!clickedInsideMenu && !clickedTrigger) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      closeProfileModal();
    }
  });

  supabaseClient.auth.onAuthStateChange(() => {
    renderNavbar();
  });

  window.PETPAW_NAVBAR_AUTH = {
    renderNavbar,
    enableAdminMode
  };

  document.addEventListener('DOMContentLoaded', renderNavbar);
})();
