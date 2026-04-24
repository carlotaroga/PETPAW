/* Renderiza la navbar segÃºn la sesiÃ³n y gestiona el perfil del usuario. */
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

  /* Rutas y estado temporal del menÃº y del modal de perfil. */
  const favoritesHref = 'favoritos.html';
  const shelterDashboardHref = 'shelter-dashboard.html';
  const currentPath = window.location.pathname.toLowerCase();
  const isFavoritesPage = window.location.pathname.toLowerCase().endsWith('favoritos.html');
  const isShelterDashboardPage = window.location.pathname.toLowerCase().endsWith('shelter-dashboard.html');
  const isHomePage = currentPath.endsWith('/index.html') || currentPath.endsWith('index.html') || currentPath.endsWith('/');
  let currentOpenMenu = null;
  let currentProfileModal = null;

  /* Utilidades de formato para pintar datos del usuario sin riesgos. */
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

  /* Abre y cierra el dropdown del perfil en desktop o mÃ³vil. */
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
  /* Crea una sola vez el modal donde el usuario consulta su cuenta. */
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

        <div class="petpaw-profile-form">
          <div class="petpaw-profile-grid">
            <div class="petpaw-profile-field">
              <span>Nombre</span>
              <div class="petpaw-profile-value" data-profile-name></div>
            </div>

            <div class="petpaw-profile-field">
              <span>Apellidos</span>
              <div class="petpaw-profile-value" data-profile-surnames></div>
            </div>

            <div class="petpaw-profile-field petpaw-profile-field-full">
              <span>Email</span>
              <div class="petpaw-profile-value" data-profile-email></div>
            </div>

            <div class="petpaw-profile-field">
              <span>Teléfono</span>
              <div class="petpaw-profile-value" data-profile-phone></div>
            </div>

            <div class="petpaw-profile-field">
              <span>Rol</span>
              <div class="petpaw-profile-value" data-profile-role></div>
            </div>
          </div>

          <div class="petpaw-profile-actions">
            <button class="btn btn-dark" type="button" data-close-profile-modal>Cerrar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      const closeTarget = event.target.closest('[data-close-profile-modal]');
      if (closeTarget) {
        closeProfileModal();
      }
    });

    currentProfileModal = modal;
    return modal;
  }

  function getRoleLabel(role) {
    return helpers.isShelterRole(role) ? 'Protectora' : 'Usuario';
  }
  function openProfileModal(userData) {
    const modal = ensureProfileModal();

    modal.querySelector('[data-profile-name]').textContent =
      helpers.normalizeText(userData?.name) || 'Sin dato';
    modal.querySelector('[data-profile-surnames]').textContent =
      helpers.normalizeText(userData?.surnames) || 'Sin dato';
    modal.querySelector('[data-profile-email]').textContent =
      helpers.normalizeText(userData?.email) || 'Sin dato';
    modal.querySelector('[data-profile-phone]').textContent =
      helpers.normalizeText(userData?.phone) || 'Sin dato';
    modal.querySelector('[data-profile-role]').textContent = getRoleLabel(userData?.role);
    modal.hidden = false;
    document.body.classList.add('petpaw-modal-open');
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
      console.error('[PETPAW] Error al cerrar sesión:', error.message);
      return;
    }

    closeMenu();
    await renderNavbar();
  }

  /* Pinta la versiÃ³n pÃºblica o privada de la navbar. */
  function renderLoggedOut(slot) {
    slot.innerHTML = `
      <div class="navbar-auth-guest">
        <a class="btn btn-outline-dark navbar-auth-btn" href="login.html">Iniciar sesión</a>
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
                ? '<p class="navbar-profile-warning">No encontramos tu perfil en la tabla users. Contacta con soporte si necesitas actualizar tus datos.</p>'
                : ''
            }

            <div class="navbar-dropdown-section">
              <p class="navbar-dropdown-section-title">Cuenta</p>
              <a class="navbar-dropdown-item" href="#" data-action="profile-data">
                <span><i class="bi bi-person-badge"></i> Datos personales</span>
                <i class="bi bi-chevron-right"></i>
              </a>
              <button class="navbar-dropdown-item navbar-dropdown-item-logout" type="button" data-action="logout">
                <span><i class="bi bi-box-arrow-right"></i> Cerrar sesión</span>
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

  /* Lee la sesiÃ³n actual y sincroniza el perfil si hace falta. */
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

  /* Inserta la navbar correcta y prepara sus eventos de interacciÃ³n. */
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

  /* Espera al DOM para montar el menÃº en cada pÃ¡gina cliente. */
  document.addEventListener('DOMContentLoaded', renderNavbar);
})();

