(function initLoginPage() {
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

  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitButton = form.querySelector('button[type="submit"]');
  const messageBox = document.getElementById('login-message');
  const requestedRedirect = helpers.getRedirectTarget('');

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

  async function redirectIfLoggedIn() {
    try {
      const profile = await helpers.getCurrentUserProfile(supabaseClient);
      if (!profile) {
        return;
      }

      const destination = helpers.resolvePostLoginTarget(profile.role, requestedRedirect);
      window.location.replace(destination);
    } catch (error) {
      console.error('[PETPAW] Error leyendo sesion:', error.message);
    }
  }

  async function redirectAfterLogin(authUser) {
    try {
      const profile = await helpers.getCurrentUserProfile(supabaseClient);
      const role = profile?.role || authUser?.user_metadata?.role || 'client';
      const destination = helpers.resolvePostLoginTarget(role, requestedRedirect);
      window.location.href = destination;
    } catch (error) {
      console.error('[PETPAW] No se pudo resolver el perfil tras login:', error.message);
      window.location.href = helpers.getHomePathForRole(authUser?.user_metadata?.role || 'client');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const email = helpers.normalizeText(emailInput?.value);
    const password = passwordInput?.value || '';

    if (!email || !password) {
      showMessage('Completa email y contrasena.', 'error');
      return;
    }

    helpers.setButtonLoadingState(submitButton, true, 'Accediendo...');

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        showMessage(helpers.formatAuthError(error), 'error');
        return;
      }

      const authUser = data?.user;
      if (authUser) {
        const syncProfile = await helpers.ensureUserProfile(supabaseClient, authUser);
        if (!syncProfile.ok) {
          console.error('[PETPAW] No se pudo sincronizar perfil:', syncProfile.error?.message || syncProfile.reason);
          showMessage('Sesion iniciada. Aviso: no se pudo sincronizar el perfil en users, revisa RLS.', 'success');
          setTimeout(() => {
            redirectAfterLogin(authUser);
          }, 900);
          return;
        }
      }

      showMessage('Sesion iniciada correctamente. Redirigiendo...', 'success');
      await redirectAfterLogin(authUser);
    } catch (error) {
      showMessage(helpers.formatAuthError(error), 'error');
    } finally {
      helpers.setButtonLoadingState(submitButton, false, '');
    }
  });

  wirePasswordToggle();
  redirectIfLoggedIn();
})();
