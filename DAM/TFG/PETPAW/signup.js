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

  const nameInput = document.getElementById('signup-name');
  const surnamesInput = document.getElementById('signup-lastname');
  const emailInput = document.getElementById('signup-email');
  const phoneInput = document.getElementById('signup-phone');
  const passwordInput = document.getElementById('signup-password');
  const termsInput = document.getElementById('signup-terms');
  const submitButton = form.querySelector('button[type="submit"]');
  const messageBox = document.getElementById('signup-message');
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

    const name = helpers.normalizeText(nameInput?.value);
    const surnames = helpers.normalizeText(surnamesInput?.value);
    const email = helpers.normalizeText(emailInput?.value);
    const phone = helpers.normalizeText(phoneInput?.value);
    const password = passwordInput?.value || '';
    const acceptedTerms = Boolean(termsInput?.checked);

    if (!name || !surnames || !email || !phone || !password) {
      showMessage('Completa todos los campos obligatorios.', 'error');
      return;
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
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            surnames,
            phone
          }
        }
      });

      if (error) {
        showMessage(helpers.formatAuthError(error), 'error');
        return;
      }

      console.info('[PETPAW] signUp OK', {
        userId: data?.user?.id || null,
        email: data?.user?.email || email,
        hasSession: Boolean(data?.session),
        identities: data?.user?.identities?.length ?? null
      });

      const authUser = data.user;
      if (!authUser?.id) {
        showMessage('No se pudo completar el registro. Intentalo de nuevo.', 'error');
        return;
      }

      if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
        showMessage('Este email ya esta registrado. Inicia sesion para continuar.', 'error');
        return;
      }

      const profilePayload = { name, surnames, email, phone, role: 'client' };
      helpers.savePendingProfile(profilePayload, authUser.id);

      const syncProfile = await helpers.ensureUserProfile(supabaseClient, authUser, profilePayload);
      if (!syncProfile.ok) {
        console.warn('[PETPAW] Perfil pendiente de sincronizar en users:', {
          reason: syncProfile.reason,
          error: syncProfile.error?.message || null,
          insertError: syncProfile.insertError?.message || null,
          userId: authUser.id
        });
      } else {
        console.info('[PETPAW] Perfil users sincronizado', {
          created: Boolean(syncProfile.created),
          userId: authUser.id
        });
      }

      if (data.session?.user) {
        if (!syncProfile.ok) {
          showMessage('Cuenta creada. Aviso: no se pudo guardar el perfil en users ahora mismo, pero podras iniciar sesion.', 'success');
          setTimeout(() => {
            window.location.href = redirectTarget;
          }, 900);
          return;
        }

        showMessage('Cuenta creada correctamente. Redirigiendo...', 'success');
        window.location.href = redirectTarget;
        return;
      }

      if (!syncProfile.ok) {
        showMessage('Cuenta creada. Revisa tu email para confirmar y luego inicia sesion. Tu perfil se terminara de sincronizar al acceder.', 'success');
      } else {
        showMessage('Cuenta creada. Revisa tu email para confirmar el registro y luego inicia sesion.', 'success');
      }
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1400);
    } catch (error) {
      showMessage(helpers.formatAuthError(error), 'error');
    } finally {
      helpers.setButtonLoadingState(submitButton, false, '');
    }
  });

  wirePasswordToggle();
  redirectIfLoggedIn();
})();
