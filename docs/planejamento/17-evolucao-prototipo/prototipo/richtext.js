/* Local rich-text editor. Stored markup is always reduced to the allowlist below. */
(() => {
  'use strict';
  const A = window.App;
  const ranges = new WeakMap();
  const allowed = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a']);
  const blocks = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote']);
  const discarded = new Set(['script', 'style', 'iframe', 'svg', 'math', 'img', 'video', 'audio', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'textarea', 'button', 'select', 'canvas', 'template']);
  const aliases = { b: 'strong', i: 'em', strike: 's' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const safeURL = value => {
    const raw = String(value || '').trim();
    if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return '';
    if (/^#\/conhecimento\/[A-Za-z0-9_-]+$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
      if (url.protocol === 'mailto:' && /^[^@?]+@[^@?]+\.[^@?]+(?:\?.*)?$/.test(url.pathname + url.search) && !/%0[ad]/i.test(raw)) return url.href;
    } catch (_) { /* Invalid URLs stay plain text. */ }
    return '';
  };
  function sanitize(value) {
    const input = document.createElement('template');
    input.innerHTML = String(value || '');
    const output = document.createElement('div');
    function append(node, target) {
      if (node.nodeType === Node.TEXT_NODE) { target.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const original = node.localName.toLowerCase();
      if (discarded.has(original)) return;
      let tag = aliases[original] || original;
      if (tag === 'div') tag = [...node.children].some(child => blocks.has(child.localName) || child.localName === 'div') ? '' : 'p';
      if (!allowed.has(tag)) {
        [...node.childNodes].forEach(child => append(child, target));
        return;
      }
      const clean = document.createElement(tag);
      const alignment = node.getAttribute('data-align') || node.style.textAlign;
      if (blocks.has(tag) && ['left', 'center', 'right'].includes(alignment)) clean.setAttribute('data-align', alignment);
      if (tag === 'a') {
        const href = safeURL(node.getAttribute('href'));
        if (!href) { [...node.childNodes].forEach(child => append(child, target)); return; }
        clean.setAttribute('href', href);
        if (!href.startsWith('#')) {
          clean.setAttribute('target', '_blank');
          clean.setAttribute('rel', 'noopener noreferrer');
        }
      }
      [...node.childNodes].forEach(child => append(child, clean));
      target.append(clean);
    }
    [...input.content.childNodes].forEach(node => append(node, output));
    return output.innerHTML;
  }
  function fromText(value) {
    const text = String(value || '').replace(/\r\n?/g, '\n');
    return text ? text.split(/\n{2,}/).map(part => `<p>${escape(part).replace(/\n/g, '<br>')}</p>`).join('') : '';
  }
  function toText(value) {
    const root = document.createElement('div');
    root.innerHTML = sanitize(value);
    let result = '';
    const newline = () => { if (result && !result.endsWith('\n')) result += '\n'; };
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) { result += node.textContent; return; }
      const tag = node.localName;
      if (tag === 'br') { result += '\n'; return; }
      if (blocks.has(tag)) newline();
      [...node.childNodes].forEach(visit);
      if (blocks.has(tag)) newline();
    }
    [...root.childNodes].forEach(visit);
    return result.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const paths = {
    bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7zm0 8h7a4 4 0 0 1 0 8H7z"/>',
    italic: '<path d="M19 4h-9m4 16H5M15 4 9 20"/>',
    underline: '<path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16"/>',
    strikeThrough: '<path d="M17 5a6 6 0 0 0-10 2c0 2 2 3 5 4m-5 7a6 6 0 0 0 10-3M3 12h18"/>',
    insertUnorderedList: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="3.5" cy="6" r=".7"/><circle cx="3.5" cy="12" r=".7"/><circle cx="3.5" cy="18" r=".7"/>',
    insertOrderedList: '<path d="M10 6h11M10 12h11M10 18h11M3 3h1v5M3 8h3M3 13c0-2 3-2 3 0 0 1-3 3-3 5h3"/>',
    justifyLeft: '<path d="M3 5h18M3 10h12M3 15h18M3 20h12"/>',
    justifyCenter: '<path d="M3 5h18M6 10h12M3 15h18M6 20h12"/>',
    justifyRight: '<path d="M3 5h18M9 10h12M3 15h18M9 20h12"/>',
    link: '<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>',
    removeFormat: '<path d="m4 4 16 16M13 4h7M16 4l-3 9M9 17l-1 3M5 20h6M4 8h4"/>',
    undo: '<path d="M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5" transform="translate(0 -2)"/>',
    redo: '<path d="M21 10H10a6 6 0 0 0 0 12m11-12-5-5m5 5-5 5" transform="translate(0 -2)"/>'
  };
  const icon = command => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[command]}</svg>`;
  const button = (command, label, shortcut, toggle = true) => `<button type="button" class="rt-button" data-rt-command="${command}" aria-label="${label}" title="${label}${shortcut ? ` (${shortcut})` : ''}"${toggle ? ' aria-pressed="false"' : ''}${shortcut ? ` aria-keyshortcuts="${shortcut.replace('Ctrl', 'Control')}"` : ''}>${icon(command)}</button>`;
  function markup({ id = 'richtext-content', name = 'body', html, text = '', label = 'Conteúdo da captura', placeholder = 'Escreva sua ideia…', readOnly = false } = {}) {
    const content = sanitize(html ?? fromText(text));
    const toolbar = readOnly ? '' : `<div class="rt-toolbar" data-rt-toolbar role="group" aria-label="Formatação do texto">
      <label class="rt-block-label"><span class="sr-only">Estilo de parágrafo</span><select data-rt-block aria-label="Estilo de parágrafo"><option value="p">Parágrafo</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="blockquote">Citação</option></select></label>
      <div class="rt-group" role="group" aria-label="Estilo do texto">${button('bold', 'Negrito', 'Ctrl+B')}${button('italic', 'Itálico', 'Ctrl+I')}${button('underline', 'Sublinhado', 'Ctrl+U')}${button('strikeThrough', 'Tachado')}</div>
      <div class="rt-group" role="group" aria-label="Listas">${button('insertUnorderedList', 'Lista com marcadores')}${button('insertOrderedList', 'Lista numerada')}</div>
      <div class="rt-group" role="group" aria-label="Alinhamento">${button('justifyLeft', 'Alinhar à esquerda')}${button('justifyCenter', 'Centralizar')}${button('justifyRight', 'Alinhar à direita')}</div>
      <div class="rt-group" role="group" aria-label="Link e formatação">${button('link', 'Inserir ou editar link', 'Ctrl+K', false)}${button('removeFormat', 'Limpar formatação', '', false)}</div>
      <div class="rt-group" role="group" aria-label="Histórico">${button('undo', 'Desfazer', 'Ctrl+Z', false)}${button('redo', 'Refazer', 'Ctrl+Y', false)}</div>
    </div>
    <div class="rt-link-panel" data-rt-link-panel hidden>
      <label class="rt-link-label" for="${escape(id)}-url">Endereço do link<input id="${escape(id)}-url" data-rt-url type="url" inputmode="url" autocomplete="off" placeholder="https://exemplo.com" aria-describedby="${escape(id)}-link-error" disabled></label>
      <div class="rt-link-actions"><button type="button" class="rt-link-button rt-link-primary" data-rt-link="apply">Aplicar</button><button type="button" class="rt-link-button" data-rt-link="remove">Remover link</button><button type="button" class="rt-link-button" data-rt-link="cancel">Cancelar</button></div>
      <p class="rt-link-error" id="${escape(id)}-link-error" data-rt-link-error role="alert" hidden></p>
    </div>`;
    return `<div class="rt-field${readOnly ? ' rt-readonly' : ''}" data-rt-field>${toolbar}<div id="${escape(id)}" class="rt-editor rt-prose" data-rt-editor contenteditable="${readOnly ? 'false' : 'true'}" role="textbox" aria-multiline="true" aria-label="${escape(label)}"${readOnly ? ' aria-readonly="true"' : ' spellcheck="true"'} data-placeholder="${escape(placeholder)}">${content}</div><textarea name="${escape(name)}" data-rt-text hidden>${escape(toText(content))}</textarea><textarea name="bodyHtml" data-rt-html hidden>${escape(content)}</textarea></div>`;
  }
  function getField(root) {
    return root?.matches?.('[data-rt-field]') ? root : root?.querySelector?.('[data-rt-field]');
  }
  function read(root) {
    const field = getField(root);
    const editor = field?.querySelector('[data-rt-editor]');
    const bodyHtml = sanitize(editor ? editor.innerHTML : root?.querySelector?.('[name="bodyHtml"]')?.value || fromText(root?.querySelector?.('[name="body"]')?.value || ''));
    return { body: toText(bodyHtml), bodyHtml };
  }
  const editorFor = field => field?.querySelector('[data-rt-editor]');
  function remember(field) {
    const selection = window.getSelection();
    const editor = editorFor(field);
    if (selection?.rangeCount && editor?.contains(selection.anchorNode) && editor.contains(selection.focusNode)) ranges.set(field, selection.getRangeAt(0).cloneRange());
  }
  function restore(field) {
    const editor = editorFor(field);
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    let range = ranges.get(field);
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }
  function state(field) {
    if (!field || !field.isConnected) return;
    const editor = editorFor(field);
    const selection = window.getSelection();
    if (!selection?.anchorNode || !editor.contains(selection.anchorNode)) return;
    for (const item of field.querySelectorAll('[data-rt-command][aria-pressed]')) {
      let active = false;
      try { active = document.queryCommandState(item.dataset.rtCommand); } catch (_) {}
      item.setAttribute('aria-pressed', String(active));
    }
    const select = field.querySelector('[data-rt-block]');
    let node = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
    while (node && node !== editor && !['p', 'h2', 'h3', 'blockquote'].includes(node.localName)) node = node.parentElement;
    if (select) select.value = node && node !== editor ? node.localName : 'p';
  }
  function sync(field, emit = true) {
    const value = read(field);
    const text = field.querySelector('[data-rt-text]');
    const html = field.querySelector('[data-rt-html]');
    if (text) text.value = value.body;
    if (html) html.value = value.bodyHtml;
    remember(field);
    state(field);
    if (emit) field.dispatchEvent(new CustomEvent('richtextchange', { bubbles: true, detail: value }));
  }
  function command(field, name, value = null) {
    restore(field);
    document.execCommand(name, false, value);
    sync(field);
  }
  function currentLink(field) {
    let node = ranges.get(field)?.startContainer;
    if (node?.nodeType !== Node.ELEMENT_NODE) node = node?.parentElement;
    const link = node?.closest?.('a');
    return link && editorFor(field).contains(link) ? link : null;
  }
  function closeLink(field, focus = true) {
    field.querySelector('[data-rt-link-panel]').hidden = true;
    field.querySelector('[data-rt-link-error]').hidden = true;
    const input = field.querySelector('[data-rt-url]');
    input.removeAttribute('aria-invalid');
    input.value = '';
    input.disabled = true;
    if (focus) restore(field);
  }
  function openLink(field) {
    remember(field);
    const panel = field.querySelector('[data-rt-link-panel]');
    const input = field.querySelector('[data-rt-url]');
    panel.hidden = false;
    input.disabled = false;
    input.value = currentLink(field)?.getAttribute('href') || '';
    field.querySelector('[data-rt-link-error]').hidden = true;
    field.querySelector('[data-rt-link="remove"]').disabled = !currentLink(field);
    input.removeAttribute('aria-invalid');
    input.focus({ preventScroll: true });
    input.select();
  }
  function applyLink(field) {
    const input = field.querySelector('[data-rt-url]');
    const url = safeURL(input.value);
    if (!url) {
      const error = field.querySelector('[data-rt-link-error]');
      error.textContent = 'Use um endereço com https://, http:// ou mailto:.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    const link = currentLink(field);
    restore(field);
    if (link && window.getSelection().isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(link);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (window.getSelection().isCollapsed) document.execCommand('insertHTML', false, sanitize(`<a href="${escape(url)}">${escape(url)}</a>`));
    else document.execCommand('createLink', false, url);
    // Executed links receive the same browsing protections as their serialized form.
    editorFor(field).querySelectorAll('a').forEach(anchor => {
      if (!anchor.getAttribute('href').startsWith('#')) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    });
    sync(field);
    closeLink(field);
  }
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const node = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection?.anchorNode?.parentElement;
    const field = node?.closest?.('[data-rt-field]');
    if (field) { remember(field); state(field); }
  });
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('[data-rt-toolbar] button');
    if (button) { remember(button.closest('[data-rt-field]')); event.preventDefault(); }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-rt-command], [data-rt-link]');
    if (!button) return;
    const field = button.closest('[data-rt-field]');
    if (!field) return;
    event.preventDefault();
    if (button.dataset.rtCommand === 'link') openLink(field);
    else if (button.dataset.rtCommand) command(field, button.dataset.rtCommand);
    else if (button.dataset.rtLink === 'apply') applyLink(field);
    else if (button.dataset.rtLink === 'remove') {
      const link = currentLink(field);
      if (link) {
        const range = document.createRange();
        range.selectNodeContents(link);
        ranges.set(field, range);
        command(field, 'unlink');
      }
      closeLink(field);
    } else closeLink(field);
  });
  document.addEventListener('change', event => {
    if (event.target.matches?.('[data-rt-block]')) command(event.target.closest('[data-rt-field]'), 'formatBlock', event.target.value);
  });
  document.addEventListener('input', event => {
    if (event.target.matches?.('[data-rt-editor]')) sync(event.target.closest('[data-rt-field]'));
  });
  document.addEventListener('keydown', event => {
    const field = event.target.closest?.('[data-rt-field]');
    if (!field || field.classList.contains('rt-readonly')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && event.target.closest('[data-rt-editor]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openLink(field);
    } else if (event.target.matches('[data-rt-url]') && event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyLink(field);
    } else if (!field.querySelector('[data-rt-link-panel]').hidden && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeLink(field);
    }
  }, true);
  document.addEventListener('paste', event => {
    const editor = event.target.closest?.('[data-rt-editor][contenteditable="true"]');
    if (!editor) return;
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertHTML', false, html ? sanitize(html) || fromText(text) : fromText(text));
    sync(editor.closest('[data-rt-field]'));
  });
  document.addEventListener('drop', event => {
    const editor = event.target.closest?.('[data-rt-editor][contenteditable="true"]');
    if (!editor) return;
    event.preventDefault();
    const text = event.dataTransfer?.getData('text/plain') || '';
    if (text) {
      const field = editor.closest('[data-rt-field]');
      // Drops insert only plain text at the last caret; files and rich markup never enter the document.
      restore(field);
      document.execCommand('insertText', false, text);
      sync(field);
    }
  });
  document.addEventListener('submit', event => {
    event.target.querySelectorAll?.('[data-rt-field]').forEach(field => sync(field, false));
  }, true);
  A.richText = { markup, read, sanitize, fromText, toText };
})();
