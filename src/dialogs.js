const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function createDialogs(getLanguage) {
  let queue = Promise.resolve();
  const word = (fa, en) => getLanguage() === 'fa' ? fa : en;

  function open(options) {
    const request = queue.then(() => new Promise(resolve => {
      const previousFocus = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = `modal studio-dialog ${options.className || ''}`;
      dialog.setAttribute('aria-labelledby', 'studio-dialog-title');
      dialog.setAttribute('aria-describedby', 'studio-dialog-description');
      dialog.innerHTML = `<div class="modal-box studio-dialog-box">
        <header class="studio-dialog-head"><div><h2 id="studio-dialog-title">${escapeHtml(options.title)}</h2><p id="studio-dialog-description">${escapeHtml(options.description || '')}</p></div><button class="btn btn-ghost btn-sm studio-dialog-close" type="button" aria-label="${word('بستن', 'Close')}">×</button></header>
        <form class="studio-dialog-form" method="dialog" novalidate><div class="studio-dialog-content"></div><p class="studio-dialog-error" role="alert" hidden></p><footer class="modal-action studio-dialog-actions"><button class="btn btn-ghost studio-dialog-cancel" type="button">${escapeHtml(options.cancelLabel || word('انصراف', 'Cancel'))}</button><button class="btn ${options.destructive ? 'btn-error' : 'btn-primary'} studio-dialog-submit" type="submit">${escapeHtml(options.confirmLabel || word('تأیید', 'Confirm'))}</button></footer></form>
      </div>`;
      (document.fullscreenElement || document.body).append(dialog);
      const content = dialog.querySelector('.studio-dialog-content');
      const form = dialog.querySelector('form');
      const submit = dialog.querySelector('.studio-dialog-submit');
      const error = dialog.querySelector('.studio-dialog-error');
      let busy = false;
      let done = false;
      const showError = message => { error.textContent = message; error.hidden = !message; };
      const finish = value => {
        if (done) return;
        done = true;
        dialog.close();
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(value);
      };
      dialog.querySelector('.studio-dialog-close').onclick = () => { if (!busy) finish(null); };
      dialog.querySelector('.studio-dialog-cancel').onclick = () => { if (!busy) finish(null); };
      dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) finish(null); });
      dialog.addEventListener('click', event => { if (event.target === dialog && !busy) finish(null); });
      form.onsubmit = async event => {
        event.preventDefault();
        if (busy) return;
        showError('');
        const invalid = content.querySelector(':invalid');
        if (invalid) { invalid.focus(); showError(word('این فیلد را درست تکمیل کنید.', 'Complete this field correctly.')); return; }
        busy = true; submit.disabled = true;
        const originalLabel = submit.textContent;
        submit.textContent = word('در حال انجام…', 'Working…');
        try {
          const value = await options.onConfirm?.({ content, dialog, showError });
          if (value !== false) finish(value ?? true);
        } catch (cause) { showError(cause.message || String(cause)); }
        finally { busy = false; if (!done) { submit.disabled = false; submit.textContent = originalLabel; } }
      };
      options.render?.({ content, dialog, submit, showError, finish });
      if (options.hideSubmit) submit.hidden = true;
      if (options.hideCancel) dialog.querySelector('.studio-dialog-cancel').hidden = true;
      dialog.showModal();
      (options.initialFocus?.(dialog) || content.querySelector('input,textarea,select,button') || submit).focus();
    }));
    queue = request.then(() => {}, () => {});
    return request;
  }

  function input(options) {
    return open({ ...options, render({ content }) {
      for (const field of options.fields || []) {
        const label = document.createElement('label');
        label.className = 'studio-field';
        const title = document.createElement('span'); title.textContent = field.label;
        const control = field.type === 'select' ? document.createElement('select') : document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
        control.name = field.name;
        control.className = field.type === 'select' ? 'select' : field.type === 'textarea' ? 'textarea' : 'input';
        if (control.tagName === 'INPUT') control.type = field.type === 'checkbox' ? 'checkbox' : field.type || 'text';
        if (field.type === 'select') for (const option of field.options || []) {
          const node = document.createElement('option'); node.value = option.value; node.textContent = option.label; control.append(node);
        }
        if (field.type === 'checkbox') control.checked = Boolean(field.value);
        else control.value = field.value ?? '';
        control.required = Boolean(field.required);
        if (field.placeholder) control.placeholder = field.placeholder;
        label.append(title, control); content.append(label);
      }
    }, async onConfirm({ content }) {
      const values = Object.fromEntries([...content.querySelectorAll('[name]')].map(control => [ control.name, control.type === 'checkbox' ? control.checked : control.value.trim() ]));
      for (const field of options.fields || []) if (field.required && !values[field.name]) throw new Error(word('این فیلد الزامی است.', 'This field is required.'));
      if (options.onConfirm) await options.onConfirm(values);
      return values;
    } });
  }

  return {
    open,
    input,
    async confirm(options) { return Boolean(await open({ ...options, destructive: options.destructive, onConfirm: options.onConfirm || (() => true) })); },
    async info(options) { await open({ ...options, hideCancel: true, confirmLabel: options.confirmLabel || word('متوجه شدم', 'Got it'), onConfirm: () => true }); },
    async choose(options) {
      const result = await input({ ...options, fields: [ { name: 'choice', type: 'select', label: options.label || options.title, options: options.items, value: options.value } ] });
      return result?.choice ?? null;
    }
  };
}

export function createNotifications(getHost) {
  let timer;
  function show(message, error) {
    const host = getHost();
    if (!host) return;
    host.textContent = message;
    host.className = `toast-note ${error ? 'error' : ''}`;
    host.setAttribute('role', error ? 'alert' : 'status');
    clearTimeout(timer);
    timer = setTimeout(() => { if (host.isConnected) { host.textContent = ''; host.className = 'toast-note'; } }, 4500);
  }
  return { success: message => show(message, false), error: message => show(message, true) };
}
