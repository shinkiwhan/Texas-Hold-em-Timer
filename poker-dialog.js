(function (root) {
  let activeClose = null;

  function ensureStyles() {
    if (document.getElementById('poker-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'poker-dialog-styles';
    style.textContent = `
      .poker-dialog-backdrop {
        position: fixed; inset: 0; z-index: 2000; display: flex;
        align-items: center; justify-content: center; padding: 20px;
        background: rgba(0,0,0,.76); backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px); animation: poker-dialog-fade .16s ease-out;
      }
      .poker-dialog {
        width: min(390px, 100%); padding: 22px; color: #fafafa;
        background: #18181b; border: 1px solid #3f3f46; border-radius: 18px;
        box-shadow: 0 24px 80px rgba(0,0,0,.72); text-align: left;
        animation: poker-dialog-pop .18s ease-out;
      }
      .poker-dialog-title { margin: 0; font-size: 21px; line-height: 1.3; }
      .poker-dialog-message { margin: 10px 0 0; color: #a1a1aa; font-size: 15px; line-height: 1.55; white-space: pre-line; }
      .poker-dialog-input {
        width: 100%; min-height: 48px; margin-top: 16px; padding: 0 14px;
        color: #fff; background: #09090b; border: 1px solid #52525b;
        border-radius: 10px; font: inherit; font-size: 17px; outline: none;
      }
      .poker-dialog-input:focus { border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,.14); }
      .poker-dialog-actions { display: flex; gap: 10px; margin-top: 20px; }
      .poker-dialog-actions button {
        flex: 1; width: auto; min-height: 46px; margin: 0; padding: 10px 14px;
        border-radius: 10px; border: 1px solid #52525b; font: inherit;
        font-size: 15px; font-weight: 800; cursor: pointer;
      }
      .poker-dialog-cancel { color: #fafafa; background: #27272a; }
      .poker-dialog-confirm { color: #181000; background: #fbbf24; border-color: #fbbf24 !important; }
      .poker-dialog-confirm.danger { color: #fff; background: #991b1b; border-color: #dc2626 !important; }
      @keyframes poker-dialog-fade { from { opacity: 0; } }
      @keyframes poker-dialog-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } }
      @media (prefers-reduced-motion: reduce) { .poker-dialog-backdrop, .poker-dialog { animation: none; } }
    `;
    document.head.appendChild(style);
  }

  function open(options) {
    ensureStyles();
    if (activeClose) activeClose(null);
    const config = Object.assign({
      title: '확인', message: '', confirmText: '확인', cancelText: '취소',
      danger: false, cancelable: true, input: false,
    }, options || {});

    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const backdrop = document.createElement('div');
      backdrop.className = 'poker-dialog-backdrop';
      backdrop.setAttribute('role', 'presentation');

      const dialog = document.createElement('section');
      dialog.className = 'poker-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      const title = document.createElement('h2');
      title.className = 'poker-dialog-title';
      title.textContent = config.title;
      const titleId = `poker-dialog-title-${Date.now()}`;
      title.id = titleId;
      dialog.setAttribute('aria-labelledby', titleId);
      dialog.appendChild(title);

      if (config.message) {
        const message = document.createElement('p');
        message.className = 'poker-dialog-message';
        message.textContent = config.message;
        dialog.appendChild(message);
      }

      let input = null;
      if (config.input) {
        input = document.createElement('input');
        input.className = 'poker-dialog-input';
        input.value = config.value || '';
        input.placeholder = config.placeholder || '';
        input.autocomplete = 'off';
        if (config.maxLength) input.maxLength = config.maxLength;
        if (config.inputMode) input.inputMode = config.inputMode;
        dialog.appendChild(input);
      }

      const actions = document.createElement('div');
      actions.className = 'poker-dialog-actions';
      if (config.cancelable) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'poker-dialog-cancel';
        cancel.textContent = config.cancelText;
        cancel.addEventListener('click', () => close(null));
        actions.appendChild(cancel);
      }
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = `poker-dialog-confirm${config.danger ? ' danger' : ''}`;
      confirm.textContent = config.confirmText;
      confirm.addEventListener('click', () => close(input ? input.value : true));
      actions.appendChild(confirm);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);

      function onKeydown(event) {
        if (event.key === 'Escape' && config.cancelable) close(null);
        if (event.key === 'Enter' && input) close(input.value);
      }
      function close(value) {
        if (!backdrop.isConnected) return;
        document.removeEventListener('keydown', onKeydown);
        backdrop.remove();
        activeClose = null;
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        resolve(value);
      }
      activeClose = close;
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop && config.cancelable) close(null);
      });
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      setTimeout(() => (input || confirm).focus(), 0);
    });
  }

  root.PokerDialog = Object.freeze({
    confirm(options) { return open(Object.assign({}, options, { cancelable: true, input: false })).then(Boolean); },
    alert(options) { return open(Object.assign({}, options, { cancelable: false, input: false })).then(() => undefined); },
    prompt(options) { return open(Object.assign({}, options, { cancelable: true, input: true })); },
  });
})(window);
