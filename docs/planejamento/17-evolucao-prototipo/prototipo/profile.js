/* Personal identity stays local. A preview becomes the saved profile only on submit. */
(() => {
  'use strict';
  const A = window.App, E = A.esc;
  const MAX_IMAGE_LENGTH = 512 * 1024;
  let draft = null;

  // A profile has no stock image or remote URL fallback: only the user's local selection.
  function sanitizeSource(value) {
    return typeof value === 'string' && value.length <= MAX_IMAGE_LENGTH &&
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }
  function savedProfile() {
    const settings = A.state.settings || {};
    return { name: String(settings.name || 'Kauan'), image: sanitizeSource(settings.profileImage) };
  }
  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    return (words.length ? [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
      .map(word => Array.from(word)[0]).join('') : 'P').toLocaleUpperCase('pt-BR');
  }
  function avatarMarkup({ className = '', size = 36, name, image }) {
    const pixels = Number.isFinite(Number(size)) ? Math.max(24, Math.min(160, Number(size))) : 36;
    const source = sanitizeSource(image);
    return `<span class="profile-avatar ${E(className)}" style="--profile-avatar-size:${pixels}px" aria-hidden="true"><span class="profile-avatar-initials">${E(initials(name))}</span>${source ? `<img src="${E(source)}" alt="" decoding="async">` : ''}</span>`;
  }
  function avatar(options = {}) {
    return avatarMarkup({ ...options, ...savedProfile() });
  }
  function topbar() {
    return `<a class="profile-topbar-link" href="#/configuracoes" aria-label="Abrir meu perfil e configurações" title="Meu perfil">${avatar({ size: 32 })}</a>`;
  }
  function currentDraft() {
    const saved = savedProfile();
    if (!draft || draft.owner !== A.state || (!draft.dirty && !draft.pending &&
      (draft.name !== saved.name || draft.image !== saved.image))) {
      draft = { owner: A.state, ...saved, token: 0, pending: false, dirty: false, error: '', nameError: '', saveError: '', message: '' };
    }
    return draft;
  }
  function statusMessage(state) {
    return state.nameError || state.error || state.saveError || state.message;
  }
  function settingsMarkup() {
    const state = currentDraft(), message = statusMessage(state);
    return `<section class="panel profile-settings" aria-labelledby="profile-settings-title">
      <div class="life-settings-heading"><h2 id="profile-settings-title">Seu perfil</h2><p class="muted">Seu nome e sua foto neste espaço pessoal.</p></div>
      <form data-form="profile" aria-busy="${state.pending}">
        <div class="profile-editor-layout">
          <div class="profile-photo-preview" data-profile-preview role="img" aria-label="${state.image ? 'Prévia da sua foto de perfil' : 'Prévia com suas iniciais'}">${avatarMarkup({ size: 88, name: state.name, image: state.image })}</div>
          <div class="profile-editor-fields">
            <label class="field" for="profile-display-name">Nome de apresentação<input id="profile-display-name" name="name" type="text" autocomplete="nickname" maxlength="50" required value="${E(state.name)}" aria-invalid="${!!state.nameError}" aria-describedby="profile-status"></label>
            <fieldset class="profile-photo-controls"><legend>Foto de perfil</legend>
              <input class="profile-photo-file" id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-label="Escolher foto de perfil" aria-describedby="profile-photo-hint profile-status" aria-invalid="${!!state.error}">
              <div class="profile-photo-actions">
                <button type="button" class="button" data-action="profile-choose" aria-controls="profile-photo-file">${A.icon('image', 17)}<span data-profile-choose-label>${state.pending ? 'Escolher outra foto' : state.image ? 'Trocar foto' : 'Escolher foto'}</span></button>
                <button type="button" class="button subtle" data-action="profile-remove"${state.image || state.pending || state.error ? '' : ' disabled'}>Remover foto</button>
              </div>
              <p id="profile-photo-hint" class="profile-photo-hint">JPG, PNG ou WebP · até 8 MB. A foto fica neste navegador.</p>
            </fieldset>
          </div>
        </div>
        <div class="profile-editor-footer"><p id="profile-status" class="profile-status${state.error || state.nameError || state.saveError ? ' has-error' : ''}" role="status" aria-live="polite" aria-atomic="true">${E(message)}</p><button type="submit" class="button primary" data-profile-save${state.pending ? ' disabled' : ''}>${state.pending ? 'Preparando foto…' : 'Salvar perfil'}</button></div>
      </form>
    </section>`;
  }
  function syncForm(form, state) {
    form.setAttribute('aria-busy', String(state.pending));
    const preview = form.querySelector('[data-profile-preview]');
    if (preview) {
      preview.innerHTML = avatarMarkup({ size: 88, name: state.name, image: state.image });
      preview.setAttribute('aria-label', state.image ? 'Prévia da sua foto de perfil' : 'Prévia com suas iniciais');
    }
    const status = form.querySelector('#profile-status');
    if (status) {
      status.textContent = statusMessage(state);
      status.classList.toggle('has-error', !!(state.error || state.nameError || state.saveError));
    }
    const choose = form.querySelector('[data-profile-choose-label]');
    if (choose) choose.textContent = state.pending ? 'Escolher outra foto' : state.image ? 'Trocar foto' : 'Escolher foto';
    const remove = form.querySelector('[data-action="profile-remove"]');
    if (remove) remove.disabled = !state.image && !state.pending && !state.error;
    const submit = form.querySelector('[data-profile-save]');
    if (submit) { submit.disabled = state.pending; submit.textContent = state.pending ? 'Preparando foto…' : 'Salvar perfil'; }
    form.querySelector('[name="name"]')?.setAttribute('aria-invalid', String(!!state.nameError));
    form.querySelector('.profile-photo-file')?.setAttribute('aria-invalid', String(!!state.error));
  }
  function syncForms(state) {
    if (state !== draft || state.owner !== A.state) return;
    document.querySelectorAll('form[data-form="profile"]').forEach(form => syncForm(form, state));
  }
  async function normalizeAvatar(file) {
    // Share type, signature, 8 MB and decode checks with the existing local image editor.
    const source = await A.media.normalizeFile(file);
    const image = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível preparar sua foto. Escolha outra imagem.'));
      image.src = source;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Não foi possível ler sua foto. Escolha outra imagem.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(320, side);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar sua foto neste navegador. Tente novamente.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    let value = canvas.toDataURL('image/jpeg', .86);
    if (value.length * .75 > 90 * 1024) value = canvas.toDataURL('image/jpeg', .72);
    if (!sanitizeSource(value)) throw new Error('Não foi possível preparar sua foto. Escolha uma imagem menor.');
    return value;
  }
  async function chooseFile(file) {
    if (!file) return;
    const state = currentDraft(), token = ++state.token;
    state.pending = true;
    state.dirty = true;
    state.error = '';
    state.saveError = '';
    state.message = 'Preparando sua foto…';
    syncForms(state);
    try {
      const value = await normalizeAvatar(file);
      if (state !== draft || token !== state.token || state.owner !== A.state) return;
      state.image = value;
      state.pending = false;
      state.message = 'Prévia pronta. Salve o perfil para aplicar.';
      syncForms(state);
    } catch (error) {
      if (state !== draft || token !== state.token || state.owner !== A.state) return;
      state.pending = false;
      state.error = typeof error?.message === 'string' ? error.message : 'Não foi possível preparar sua foto. Escolha outra imagem.';
      syncForms(state);
    }
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if (!input?.matches?.('form[data-form="profile"] [name="name"]')) return;
    const state = currentDraft();
    state.name = input.value;
    state.dirty = true;
    state.nameError = '';
    state.saveError = '';
    if (!state.pending) state.message = 'Salve o perfil para aplicar suas alterações.';
    syncForms(state);
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (!input?.matches?.('.profile-photo-file')) return;
    const file = input.files?.[0];
    input.value = '';
    void chooseFile(file);
  });
  document.addEventListener('error', event => {
    const image = event.target;
    if (!image?.matches?.('.profile-avatar img')) return;
    image.hidden = true;
    image.removeAttribute('src');
  }, true);
  A.actions['profile-choose'] = button => button.closest('form[data-form="profile"]')?.querySelector('.profile-photo-file')?.click();
  A.actions['profile-remove'] = () => {
    const state = currentDraft();
    state.token++;
    state.pending = false;
    state.image = '';
    state.error = '';
    state.saveError = '';
    state.dirty = true;
    state.message = 'Foto removida da prévia. Salve para usar suas iniciais.';
    syncForms(state);
  };
  A.forms.profile = (data, form) => {
    const state = currentDraft();
    state.name = String(data.get('name') || '').trim();
    state.dirty = true;
    state.nameError = '';
    state.saveError = '';
    if (!state.name || state.name.length > 50) {
      state.nameError = 'Informe um nome com até 50 caracteres.';
      syncForms(state);
      form.querySelector('[name="name"]')?.focus();
      return;
    }
    if (state.pending || state.error) {
      if (state.pending) state.message = 'Aguarde a foto ficar pronta antes de salvar.';
      syncForms(state);
      form.querySelector('[data-action="profile-choose"]')?.focus();
      return;
    }
    const originalSettings = A.state.settings, settings = originalSettings || {};
    const before = { name: settings.name, image: settings.profileImage, hadName: Object.hasOwn(settings, 'name'), hadImage: Object.hasOwn(settings, 'profileImage') };
    const previousActivity = A.state.activity;
    A.state.settings = settings;
    settings.name = state.name;
    settings.profileImage = sanitizeSource(state.image);
    A.state.activity = [{ id: A.uid('a'), title: 'Perfil atualizado', detail: state.image ? 'Nome e foto de perfil' : 'Nome e iniciais', time: new Date().toISOString() }, ...(previousActivity || [])].slice(0, 80);
    let saved = false;
    try { saved = A.save(); } catch (error) { /* Keep this editor recoverable if storage is unavailable. */ }
    if (!saved) {
      if (before.hadName) settings.name = before.name; else delete settings.name;
      if (before.hadImage) settings.profileImage = before.image; else delete settings.profileImage;
      if (!originalSettings) delete A.state.settings;
      A.state.activity = previousActivity;
      state.message = '';
      // A save failure is retryable without asking the user to select the photo again.
      state.saveError = 'Não foi possível salvar neste navegador. Sua prévia foi mantida; tente salvar novamente.';
      syncForms(state);
      A.notify(state.saveError);
      return;
    }
    state.dirty = false;
    state.message = 'Perfil salvo. Seu nome e sua foto estão atualizados.';
    A.notify('Perfil atualizado.');
    A.render();
    document.querySelector('form[data-form="profile"] [data-profile-save]')?.focus({ preventScroll: true });
  };
  A.profile = { avatar, settings: settingsMarkup, topbar, sanitizeSource };
})();
