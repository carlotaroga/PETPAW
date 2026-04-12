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
  const redirectTarget = helpers.getRedirectTarget('index.html');

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
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('[PETPAW] Error leyendo sesion:', error.message);
      return;
    }

    if (data.session?.user) {
      window.location.replace(redirectTarget);
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
            window.location.href = redirectTarget;
          }, 900);
          return;
        }
      }

      showMessage('Sesion iniciada correctamente. Redirigiendo...', 'success');
      window.location.href = redirectTarget;
    } catch (error) {
      showMessage(helpers.formatAuthError(error), 'error');
    } finally {
      helpers.setButtonLoadingState(submitButton, false, '');
    }
  });

  wirePasswordToggle();
  redirectIfLoggedIn();
})();
