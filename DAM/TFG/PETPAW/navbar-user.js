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
  const isFavoritesPage = window.location.pathname.toLowerCase().endsWith('favoritos.html');
  let currentOpenMenu = null;

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

    slot.innerHTML = `
      <div class="navbar-auth-user" data-user-shell>
        <a class="navbar-favorites-link${isFavoritesPage ? ' is-active' : ''}" href="${favoritesHref}" aria-label="Ir a favoritos">
          <i class="bi bi-heart"></i>
          <span>Favoritos</span>
        </a>

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
              <a class="navbar-dropdown-item" href="#" data-action="account-security">
                <span><i class="bi bi-shield-lock"></i> Cuenta y contrasena</span>
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

    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        await handleLogout();
      });
    }
  }

  async function getUserDataFromSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    const sessionUser = data.session?.user;
    if (!sessionUser) {
      return null;
    }

    const syncProfile = await helpers.ensureUserProfile(supabaseClient, sessionUser);
    if (!syncProfile.ok) {
      console.warn('[PETPAW] No se pudo sincronizar perfil en navbar:', {
        reason: syncProfile.reason,
        error: syncProfile.error?.message || null
      });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('id, name, surnames, email, role, shelter_id')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return {
        id: sessionUser.id,
        name: sessionUser.user_metadata?.name || '',
        surnames: sessionUser.user_metadata?.surnames || '',
        email: sessionUser.email || '',
        role: 'client',
        shelter_id: null,
        profileMissing: true
      };
    }

    return {
      ...profile,
      email: profile.email || sessionUser.email || '',
      profileMissing: false
    };
  }

  function disableAdminMode() {
    document.body.classList.remove('petpaw-admin-mode');
    document.body.dataset.userRole = 'client';
  }

  function enableAdminMode(userData) {
    document.body.classList.add('petpaw-admin-mode');
    document.body.dataset.userRole = 'admin';

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

      if (String(userData.role || '').toLowerCase() === 'admin') {
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
