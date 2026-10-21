/* Imagens locais: o formulário guarda uma prévia; somente Salvar altera os dados. */
(() => {
  'use strict';
  const A = window.App, E = A.esc;
  const defaultFocus = 'assets/covers/focus-landscape.png';
  const MAX_FILE_BYTES = 8 * 1024 * 1024, TARGET_BYTES = 300 * 1024;
  const editors = new WeakMap();
  const sanitizeSource = value => {
    if (typeof value !== 'string') return '';
    if (/^assets\/covers\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpe?g|png|webp)$/.test(value)) return value;
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
    return '';
  };
  const initialValue = (value, kind) => sanitizeSource(value === undefined && kind === 'focus' ? defaultFocus : value);
  function previewMarkup(value, label) {
    return value
      ? `<img src="${E(value)}" alt="Prévia: ${E(label)}" class="image-editor-image"><span class="image-editor-placeholder" hidden>${A.icon('image', 24)}<span>Sem imagem</span></span>`
      : `<img alt="Prévia: ${E(label)}" class="image-editor-image" hidden><span class="image-editor-placeholder">${A.icon('image', 24)}<span>Sem imagem</span></span>`;
  }
  function imageEditor({ key, value, label = 'Imagem', kind = 'project' }) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,50}$/.test(key || '')) throw new Error('Identificador de imagem inválido.');
    kind = kind === 'focus' ? 'focus' : 'project';
    const source = initialValue(value, kind), id = A.uid('image-editor');
    return `<fieldset class="image-editor image-editor-${kind}" data-media-key="${E(key)}" data-media-kind="${kind}">
      <legend>${E(label)}</legend>
      <div class="image-editor-preview">${previewMarkup(source, label)}</div>
      <input type="hidden" name="${E(key)}" value="${E(source)}" data-media-value>
      <input class="image-editor-file" id="${E(id)}" type="file" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-label="${E(label)}" aria-describedby="${E(id)}-hint ${E(id)}-status">
      <div class="image-editor-actions">
        <button type="button" class="button" data-action="media-choose" data-media-action="choose" aria-controls="${E(id)}">${A.icon('plus', 16)}<span data-media-choose-label>${source ? 'Trocar imagem' : 'Adicionar imagem'}</span></button>
        <button type="button" class="button subtle" data-action="media-remove" data-media-action="remove"${source ? '' : ' disabled'}>Remover</button>
        <button type="button" class="text-link" data-action="media-default" data-media-action="restore"${source === defaultFocus ? ' disabled' : ''}>${kind === 'focus' ? 'Restaurar padrão' : 'Usar paisagem'}</button>
      </div>
      <p class="image-editor-hint" id="${E(id)}-hint">JPG, PNG ou WebP · até 8 MB. A imagem fica neste navegador.</p>
      <p class="image-editor-status" id="${E(id)}-status" role="status" aria-live="polite" aria-atomic="true"></p>
    </fieldset>`;
  }
  function stateFor(editor) {
    let state = editors.get(editor);
    if (!state) {
      state = { value: sanitizeSource(editor.querySelector('[data-media-value]')?.value || ''), token: 0, pending: false, error: '', saveError: '' };
      editors.set(editor, state);
    }
    return state;
  }
  function renderEditor(editor, state, message = '') {
    const input = editor.querySelector('[data-media-value]'), image = editor.querySelector('.image-editor-image');
    const empty = editor.querySelector('.image-editor-placeholder'), file = editor.querySelector('.image-editor-file');
    if (input) input.value = state.value;
    if (image) {
      image.hidden = !state.value;
      if (state.value) image.setAttribute('src', state.value);
      else image.removeAttribute('src');
    }
    if (empty) empty.hidden = !!state.value;
    editor.classList.toggle('is-loading', state.pending);
    editor.classList.toggle('has-error', !!(state.error || state.saveError));
    editor.setAttribute('aria-busy', String(state.pending));
    const status = editor.querySelector('.image-editor-status');
    if (status) status.textContent = state.error || state.saveError || message;
    if (file) file.setAttribute('aria-invalid', String(!!state.error));
    const choose = editor.querySelector('[data-media-choose-label]');
    if (choose) choose.textContent = state.pending ? 'Escolher outra imagem' : state.value ? 'Trocar imagem' : 'Adicionar imagem';
    const remove = editor.querySelector('[data-media-action="remove"]');
    if (remove) remove.disabled = !state.value && !state.pending && !state.error;
    const restore = editor.querySelector('[data-media-action="restore"]');
    if (restore) restore.disabled = state.value === defaultFocus && !state.pending && !state.error;
  }
  function setValue(editor, value, message = '') {
    const state = stateFor(editor);
    state.token++;
    state.pending = false;
    state.error = '';
    state.saveError = '';
    state.value = sanitizeSource(value);
    const file = editor.querySelector('.image-editor-file');
    if (file) file.value = '';
    renderEditor(editor, state, message);
  }
  async function normalizeFile(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
    }
    if (file.size > MAX_FILE_BYTES) throw new Error('Esta imagem excede 8 MB. Escolha um arquivo menor.');
    if (!file.size) throw new Error('Este arquivo está vazio. Escolha outra imagem.');
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (!jpeg && !png && !webp) throw new Error('Não foi possível ler esta imagem. Escolha outro JPG, PNG ou WebP.');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Esta imagem parece estar danificada. Escolha outro arquivo.'));
        image.src = url;
      });
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width * height > 60000000) throw new Error('Esta imagem é grande demais para preparar. Escolha uma versão menor.');
      const scale = Math.min(1, 1600 / width, 1000 / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a imagem neste navegador. Tente novamente.');
      function encode(quality) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
      }
      let value = encode(.82);
      if (value.length * .75 > TARGET_BYTES) value = encode(.72);
      for (let attempt = 0; value.length * .75 > TARGET_BYTES && attempt < 7; attempt++) {
        canvas.width = Math.max(1, Math.round(canvas.width * .8));
        canvas.height = Math.max(1, Math.round(canvas.height * .8));
        value = encode(.72);
      }
      if (!sanitizeSource(value)) throw new Error('Não foi possível preparar esta imagem. Escolha outro arquivo.');
      return value;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function chooseFile(editor, file) {
    if (!file) return;
    const state = stateFor(editor), token = ++state.token;
    state.pending = true;
    state.error = '';
    state.saveError = '';
    renderEditor(editor, state, 'Preparando imagem…');
    try {
      const value = await normalizeFile(file);
      if (token !== state.token || !editor.isConnected) return;
      state.value = value;
      state.pending = false;
      renderEditor(editor, state, 'Prévia pronta. Salve para aplicar.');
    } catch (error) {
      if (token !== state.token || !editor.isConnected) return;
      state.pending = false;
      state.error = error instanceof Error ? error.message : 'Não foi possível preparar a imagem. Tente outra.';
      renderEditor(editor, state);
    } finally {
      if (token === state.token) {
        const input = editor.querySelector('.image-editor-file');
        if (input) input.value = '';
      }
    }
  }
  function editorFor(form, key) {
    return [...(form?.querySelectorAll?.('[data-media-key]') || [])].find(el => el.dataset.mediaKey === key);
  }
  function setError(form, key, message) {
    const editor = editorFor(form, key);
    if (!editor) return;
    const state = stateFor(editor);
    state.saveError = String(message || '');
    renderEditor(editor, state);
  }
  function read(form, key) {
    const editor = editorFor(form, key);
    if (!editor) return { ok: false, value: '', error: 'O campo de imagem não está disponível. Reabra este formulário.' };
    const state = stateFor(editor);
    state.saveError = '';
    if (state.pending || state.error) {
      const error = state.pending ? 'Aguarde a imagem ficar pronta antes de salvar.' : state.error;
      renderEditor(editor, state, error);
      editor.querySelector('[data-media-action="choose"]')?.focus();
      return { ok: false, value: state.value, error };
    }
    return { ok: true, value: state.value, error: '' };
  }
  document.addEventListener('change', event => {
    const input = event.target;
    if (!input?.matches?.('.image-editor-file')) return;
    const editor = input.closest('[data-media-key]');
    if (editor) void chooseFile(editor, input.files?.[0]);
  });
  Object.assign(A.actions, {
    'media-choose': button => button.closest('[data-media-key]')?.querySelector('.image-editor-file')?.click(),
    'media-remove': button => {
      const editor = button.closest('[data-media-key]');
      if (editor) setValue(editor, '', 'Imagem removida da prévia. Salve para aplicar.');
    },
    'media-default': button => {
      const editor = button.closest('[data-media-key]');
      if (editor) setValue(editor, defaultFocus, 'Paisagem selecionada. Salve para aplicar.');
    }
  });
  A.media = { defaultFocus, sanitizeSource, imageEditor, read, setError, normalizeFile, setValue };
})();
