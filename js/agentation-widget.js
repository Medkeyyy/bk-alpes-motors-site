/**
 * Agentation Widget — Vanilla JS
 * Annotation toolbar for visual feedback → agentation-mcp server (port 4747)
 */
(function () {
  const SERVER = 'http://localhost:4747';
  let sessionId = null;
  let isActive = false;
  let pins = [];

  /* ─── Init session ─────────────────────────────────────── */
  async function initSession() {
    try {
      const res = await fetch(`${SERVER}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'BK Alpes Motors Site', url: location.href }),
      });
      if (!res.ok) throw new Error('Server not responding');
      const data = await res.json();
      sessionId = data.id;
      sessionLabel.textContent = `Session: ${sessionId.slice(0, 8)}`;
      loadExistingAnnotations();
    } catch (e) {
      sessionLabel.textContent = 'Serveur hors ligne';
      sessionLabel.style.color = '#f87171';
    }
  }

  /* ─── Load existing annotations as pins ─────────────────── */
  async function loadExistingAnnotations() {
    if (!sessionId) return;
    try {
      const res = await fetch(`${SERVER}/sessions/${sessionId}`);
      const data = await res.json();
      (data.annotations || []).forEach(renderPin);
    } catch (_) {}
  }

  /* ─── Build UI ───────────────────────────────────────────── */
  const toolbar = document.createElement('div');
  toolbar.id = 'agentation-toolbar';
  toolbar.innerHTML = `
    <button id="ag-toggle" title="Activer les annotations">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
      </svg>
      <span>Annoter</span>
    </button>
    <span id="ag-session-label" style="font-size:11px;opacity:0.55;margin-left:6px;">Connexion...</span>
  `;

  /* Popup for writing comment */
  const popup = document.createElement('div');
  popup.id = 'ag-popup';
  popup.innerHTML = `
    <div id="ag-popup-inner">
      <p id="ag-popup-elem" style="font-size:11px;opacity:0.55;margin:0 0 8px;"></p>
      <textarea id="ag-popup-input" placeholder="Ton retour sur cet élément..." rows="3"></textarea>
      <div id="ag-popup-btns">
        <button id="ag-popup-cancel">Annuler</button>
        <button id="ag-popup-send">Envoyer</button>
      </div>
    </div>
  `;

  /* Overlay for click capture */
  const overlay = document.createElement('div');
  overlay.id = 'ag-overlay';

  /* Styles */
  const style = document.createElement('style');
  style.textContent = `
    #agentation-toolbar {
      position: fixed;
      bottom: 80px;
      right: 24px;
      z-index: 99999;
      display: flex;
      align-items: center;
      background: #18181b;
      color: #fff;
      border-radius: 40px;
      padding: 8px 16px 8px 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35);
      font-family: 'Poppins', system-ui, sans-serif;
      font-size: 13px;
      gap: 4px;
      cursor: default;
      user-select: none;
    }
    #ag-toggle {
      display: flex;
      align-items: center;
      gap: 7px;
      background: none;
      border: none;
      color: #fff;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
      transition: opacity 0.2s;
    }
    #ag-toggle:hover { opacity: 0.8; }
    #agentation-toolbar.active { background: #2563eb; }
    #agentation-toolbar.active #ag-toggle { color: #fff; }
    #ag-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 99990;
      cursor: crosshair;
    }
    #ag-overlay.on { display: block; }
    /* Element highlight on hover */
    .ag-hover-highlight {
      outline: 2px solid #2563eb !important;
      outline-offset: 2px !important;
    }
    /* Popup */
    #ag-popup {
      display: none;
      position: fixed;
      z-index: 99998;
      pointer-events: none;
    }
    #ag-popup.open {
      display: block;
      pointer-events: all;
    }
    #ag-popup-inner {
      background: #18181b;
      color: #fff;
      border-radius: 14px;
      padding: 16px;
      width: 280px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      font-family: 'Poppins', system-ui, sans-serif;
    }
    #ag-popup-input {
      width: 100%;
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      color: #fff;
      font-family: inherit;
      font-size: 13px;
      padding: 10px 12px;
      resize: none;
      outline: none;
      box-sizing: border-box;
    }
    #ag-popup-input:focus { border-color: #2563eb; }
    #ag-popup-btns {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 10px;
    }
    #ag-popup-cancel {
      background: none;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
      border-radius: 8px;
      padding: 6px 14px;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    #ag-popup-send {
      background: #2563eb;
      border: none;
      color: #fff;
      border-radius: 8px;
      padding: 6px 14px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    #ag-popup-send:hover { background: #1d4ed8; }
    /* Annotation pins */
    .ag-pin {
      position: absolute;
      z-index: 99995;
      width: 28px;
      height: 28px;
      background: #2563eb;
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg) translate(-50%, -50%);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.15s;
    }
    .ag-pin:hover { transform: rotate(-45deg) translate(-50%, -50%) scale(1.15); }
    .ag-pin.resolved { background: #16a34a; }
    .ag-pin-num {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(45deg);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      font-family: 'Poppins', system-ui, sans-serif;
    }
    /* Toast */
    #ag-toast {
      position: fixed;
      bottom: 140px;
      right: 24px;
      z-index: 99999;
      background: #16a34a;
      color: #fff;
      border-radius: 10px;
      padding: 10px 18px;
      font-family: 'Poppins', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s, transform 0.25s;
      pointer-events: none;
    }
    #ag-toast.show { opacity: 1; transform: translateY(0); }
  `;

  /* Toast element */
  const toast = document.createElement('div');
  toast.id = 'ag-toast';

  document.head.appendChild(style);
  document.body.appendChild(toolbar);
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  document.body.appendChild(toast);

  const toggleBtn = document.getElementById('ag-toggle');
  const sessionLabel = document.getElementById('ag-session-label');
  const popupElem = document.getElementById('ag-popup-elem');
  const popupInput = document.getElementById('ag-popup-input');

  /* ─── Toggle annotation mode ────────────────────────────── */
  toggleBtn.addEventListener('click', () => {
    isActive = !isActive;
    toolbar.classList.toggle('active', isActive);
    overlay.classList.toggle('on', isActive);
    toggleBtn.querySelector('span').textContent = isActive ? 'Annoter (actif)' : 'Annoter';
    if (!isActive) closePopup();
  });

  /* ─── Hover highlight ────────────────────────────────────── */
  let lastHovered = null;
  overlay.addEventListener('mousemove', (e) => {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'all';
    if (el && el !== lastHovered) {
      if (lastHovered) lastHovered.classList.remove('ag-hover-highlight');
      // Skip toolbar/overlay/popup
      if (!el.closest('#agentation-toolbar') && !el.closest('#ag-popup')) {
        el.classList.add('ag-hover-highlight');
        lastHovered = el;
      }
    }
  });

  overlay.addEventListener('mouseleave', () => {
    if (lastHovered) { lastHovered.classList.remove('ag-hover-highlight'); lastHovered = null; }
  });

  /* ─── Click → open popup ─────────────────────────────────── */
  let pendingClick = null;
  overlay.addEventListener('click', (e) => {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'all';
    if (!el || el.closest('#agentation-toolbar') || el.closest('#ag-popup')) return;

    pendingClick = {
      x: e.clientX / window.innerWidth * 100,
      y: e.clientY + window.scrollY,
      element: el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList].join('.') : ''),
      elementPath: getSelector(el),
      cssClasses: el.className || '',
      nearbyText: el.innerText ? el.innerText.slice(0, 80) : '',
    };

    popupElem.textContent = pendingClick.elementPath.slice(0, 60);
    popupInput.value = '';

    // Position popup near click
    const px = Math.min(e.clientX, window.innerWidth - 310);
    const py = Math.min(e.clientY + 12, window.innerHeight - 180);
    popup.style.left = px + 'px';
    popup.style.top = py + 'px';
    popup.classList.add('open');
    popupInput.focus();

    if (lastHovered) { lastHovered.classList.remove('ag-hover-highlight'); lastHovered = null; }
  });

  /* ─── Popup actions ──────────────────────────────────────── */
  document.getElementById('ag-popup-cancel').addEventListener('click', closePopup);

  document.getElementById('ag-popup-send').addEventListener('click', sendAnnotation);

  popupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendAnnotation();
    if (e.key === 'Escape') closePopup();
  });

  function closePopup() {
    popup.classList.remove('open');
    pendingClick = null;
  }

  async function sendAnnotation() {
    if (!pendingClick || !sessionId) return;
    const comment = popupInput.value.trim();
    if (!comment) { popupInput.focus(); return; }

    const body = { ...pendingClick, comment, timestamp: Date.now() };

    try {
      const res = await fetch(`${SERVER}/sessions/${sessionId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      closePopup();
      renderPin(data);
      showToast('Annotation envoyée ✓');
    } catch (e) {
      showToast('Erreur: serveur hors ligne');
    }
  }

  /* ─── Render pin on page ─────────────────────────────────── */
  let pinCount = 0;
  function renderPin(annotation) {
    pinCount++;
    const pin = document.createElement('div');
    pin.className = 'ag-pin' + (annotation.status === 'resolved' ? ' resolved' : '');
    pin.style.left = annotation.x + 'vw';
    pin.style.top = annotation.y + 'px';
    pin.title = annotation.comment;
    pin.innerHTML = `<span class="ag-pin-num">${pinCount}</span>`;
    document.body.appendChild(pin);
    pins.push(pin);

    // Click pin → show comment
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      alert(`#${pinCount}: ${annotation.comment}\n\nÉlément: ${annotation.elementPath || ''}`);
    });
  }

  /* ─── Toast ──────────────────────────────────────────────── */
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  /* ─── CSS selector helper ────────────────────────────────── */
  function getSelector(el) {
    const path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let sel = el.tagName.toLowerCase();
      if (el.id) { sel += '#' + el.id; path.unshift(sel); break; }
      if (el.className) {
        const classes = [...el.classList].filter(c => !c.startsWith('ag-')).slice(0, 2);
        if (classes.length) sel += '.' + classes.join('.');
      }
      const siblings = el.parentNode ? [...el.parentNode.children].filter(s => s.tagName === el.tagName) : [];
      if (siblings.length > 1) sel += `:nth-child(${[...el.parentNode.children].indexOf(el) + 1})`;
      path.unshift(sel);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  /* ─── Start ──────────────────────────────────────────────── */
  initSession();

})();
