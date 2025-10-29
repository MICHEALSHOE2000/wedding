/* app.js
   Stage 4 — JavaScript for Ngozi & Bosun wedding prototype
   - Modern ES6+
   - Modular functions
   - Good defaults and progressive enhancement
*/

/* =========================
   CONFIG
   ========================= */
const CONFIG = {
  countdownTarget: new Date('2025-12-20T12:00:00'), // YYYY-MM-DDTHH:mm:ss
  rsvpFormSelector: '#rsvp-form',
  sidebarSelector: '.sidebar',
  menuToggleSelector: '#menu-toggle',
  navLinkSelector: '.nav-link',
  navToggleSelector: '.nav-toggle',
  modalSelector: '#person-modal',
  modalPanelSelector: '.modal-panel',
  gallerySelector: '.gallery-grid',
  partyCardSelector: '.party-card',
  floatRsvpSelector: '#float-rsvp'
};

/* =========================
   UTILITIES
   ========================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const clamp = (n, min = 0) => Math.max(min, n);

/* Tiny helper to set aria-hidden and open class consistently */
function setOpen(el, isOpen) {
  if (!el) return;
  el.classList.toggle('open', !!isOpen);
  el.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

/* =========================
   COUNTDOWN
   ========================= */
function startCountdown(targetDate, rootSelector = '#countdown') {
  const root = document.querySelector(rootSelector);
  if (!root || !targetDate) return;

  function update() {
    const now = new Date();
    let diff = Math.floor((targetDate - now) / 1000); // seconds
    if (diff < 0) diff = 0;

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    root.querySelector('[data-unit="days"]').textContent = String(days).padStart(2, '0');
    root.querySelector('[data-unit="hours"]').textContent = String(hours).padStart(2, '0');
    root.querySelector('[data-unit="minutes"]').textContent = String(minutes).padStart(2, '0');
    root.querySelector('[data-unit="seconds"]').textContent = String(seconds).padStart(2, '0');

    if (diff === 0) {
      // Optionally display a message when countdown reaches zero
      root.setAttribute('aria-live', 'polite');
      clearInterval(timer);
    }
  }

  update();
  const timer = setInterval(update, 1000);
}

/* =========================
   SIDEBAR / DRAWER
   ========================= */
function initSidebar() {
  const sidebar = document.querySelector(CONFIG.sidebarSelector);
  const toggle = document.querySelector(CONFIG.menuToggleSelector);
  const floatRsvp = document.querySelector(CONFIG.floatRsvpSelector);
  let lastFocused = null;

  function openSidebar() {
    lastFocused = document.activeElement;
    sidebar.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    // shift focus to first link
    const firstLink = sidebar.querySelector('.nav-link, .nav-toggle');
    firstLink?.focus();
    document.documentElement.classList.add('no-scroll');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
    if (lastFocused) lastFocused.focus();
  }

  toggle?.addEventListener('click', (e) => {
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) closeSidebar();
    else openSidebar();
  });

  // Close when clicking outside (mobile)
  document.addEventListener('click', (e) => {
    if (!sidebar) return;
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || e.target.matches(CONFIG.menuToggleSelector) || (floatRsvp && floatRsvp.contains(e.target))) return;
    closeSidebar();
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sidebar.classList.contains('open')) closeSidebar();
    }
  });

  // Submenu toggle behavior (The Wedding)
  $$(CONFIG.navToggleSelector).forEach(btn => {
    const controls = btn.getAttribute('aria-controls');
    const submenu = controls ? document.getElementById(controls) : btn.nextElementSibling;
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if (submenu) {
        if (expanded) submenu.setAttribute('hidden', '');
        else submenu.removeAttribute('hidden');
      }
    });
  });
}

/* =========================
   SMOOTH SCROLL FOR NAV LINKS
   ========================= */
function initSmoothScroll() {
  $$(CONFIG.navLinkSelector).forEach(link => {
    link.addEventListener('click', (e) => {
      // Allow regular behaviour for external links
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;

      e.preventDefault();
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      const topOffset = Math.max(12, 0);
      const rect = target.getBoundingClientRect();
      const absoluteTop = rect.top + window.pageYOffset - topOffset;

      window.scrollTo({
        top: absoluteTop,
        behavior: 'smooth'
      });

      // If sidebar was open, close it (mobile)
      const sidebar = document.querySelector(CONFIG.sidebarSelector);
      if (sidebar?.classList.contains('open')) {
        sidebar.classList.remove('open');
        sidebar.setAttribute('aria-hidden', 'true');
      }

      // update focus for accessibility
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      // remove tabindex once blurred
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    });
  });
}

/* =========================
   RSVP FORM (Formspree) - AJAX with fallback
   ========================= */
function initRSVP() {
  const form = document.querySelector(CONFIG.rsvpFormSelector);
  if (!form) return;

  const statusEl = document.getElementById('rsvp-status');
  const submitBtn = form.querySelector('.btn-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Basic client-side validation
    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');
    if (!name?.value.trim() || !email?.value.trim()) {
      statusEl.textContent = 'Please enter your name and email.';
      name?.focus();
      return;
    }

    // Prepare form data
    const action = form.getAttribute('action') || '';
    if (!action || !action.includes('formspree.io')) {
      statusEl.textContent = 'Form destination not configured. Please set your Formspree form ID in the form action.';
      return;
    }

    const formData = new FormData(form);
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    statusEl.textContent = '';

    try {
      // POST to Formspree endpoint
      const res = await fetch(action, {
        method: form.method || 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        // Success
        form.reset();
        statusEl.textContent = 'Thanks — your RSVP has been received!';
        // Optionally, show a temporary visual confirmation
        submitBtn.textContent = 'Sent ✓';
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 1400);
      } else {
        // Try to read JSON response for error
        let msg = 'There was an error sending your RSVP. Please try again.';
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch (err) { /* ignore parse errors */ }
        statusEl.textContent = msg;
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } catch (err) {
      // Network or other error
      console.error('RSVP submit error', err);
      statusEl.textContent = 'Network error — please check your connection and try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

/* =========================
   MODAL / LIGHTBOX (single modal for party and gallery)
   ========================= */
function initModal() {
  const modal = document.querySelector(CONFIG.modalSelector);
  const modalPanel = modal ? modal.querySelector(CONFIG.modalPanelSelector) : null;
  const modalClose = modal ? modal.querySelector('.modal-close') : null;
  let lastFocused = null;

  if (!modal) return;

  function openModal(contentHTML = '', title = '') {
    lastFocused = document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    const titleEl = modal.querySelector('#modal-title');
    const bodyEl = modal.querySelector('#modal-body');
    if (titleEl) titleEl.textContent = title || '';
    if (bodyEl) bodyEl.innerHTML = contentHTML;
    // focus the close button
    modalClose?.focus();
    document.documentElement.classList.add('no-scroll');
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    // clear content for cleanliness
    const bodyEl = modal.querySelector('#modal-body');
    if (bodyEl) bodyEl.innerHTML = '';
    if (lastFocused) lastFocused.focus();
  }

  // Close on overlay click (outside panel)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on close button
  modalClose?.addEventListener('click', () => closeModal());

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  // Wiring: party member buttons
  $$(CONFIG.partyCardSelector).forEach(btn => {
    btn.addEventListener('click', () => {
      const personKey = btn.dataset.person;
      // Try to extract info from the markup, fallback to data attributes
      const name = btn.querySelector('h3')?.textContent || btn.dataset.name || 'Guest';
      const role = btn.querySelector('.party-role')?.textContent || btn.dataset.role || '';
      const imgEl = btn.querySelector('img');
      const imgHTML = imgEl ? `<img src="${imgEl.src}" alt="${imgEl.alt}" style="width:100%;height:auto;border-radius:10px;margin-bottom:12px;">` : '';
      const bio = (btn.dataset.bio) ? btn.dataset.bio : `<p>${role}</p>`;
      const content = `${imgHTML}<div>${bio}</div>`;
      openModal(content, name);
    });
  });

  // Wiring: gallery click -> open image in modal
  const gallery = document.querySelector(CONFIG.gallerySelector);
  if (gallery) {
    gallery.addEventListener('click', (e) => {
      const fig = e.target.closest('figure.gallery-item');
      if (!fig) return;
      const img = fig.querySelector('img');
      const caption = fig.querySelector('figcaption')?.textContent || '';
      const content = `<img src="${img.src}" alt="${img.alt}" style="width:100%;height:auto;border-radius:8px;"><p style="margin-top:8px;color:var(--muted-gray)">${caption}</p>`;
      openModal(content, 'Photo');
    });
  }

  // Expose functions for debugging if needed
  return { openModal, closeModal };
}

/* =========================
   INIT
   ========================= */
function init() {
  document.documentElement.classList.remove('no-js'); // if you set no-js by default, useful

  // Start countdown
  try {
    startCountdown(CONFIG.countdownTarget);
  } catch (err) {
    console.warn('Countdown init failed', err);
  }

  // Sidebar
  try { initSidebar(); } catch (err) { console.warn('Sidebar init failed', err); }

  // Smooth Scroll
  try { initSmoothScroll(); } catch (err) { console.warn('Smooth scroll init failed', err); }

  // RSVP
  try { initRSVP(); } catch (err) { console.warn('RSVP init failed', err); }

  // Modal + gallery + party
  try { initModal(); } catch (err) { console.warn('Modal init failed', err); }

  // Small enhancement: keyboard shortcut "r" to jump to RSVP (helpful)
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const rsvp = document.getElementById('rsvp');
      if (rsvp) {
        rsvp.scrollIntoView({ behavior: 'smooth', block: 'start' });
        rsvp.setAttribute('tabindex', '-1');
        rsvp.focus({ preventScroll: true });
      }
    }
  });

  // Improve focus styles for keyboard users (adds class when tabbing)
  function handleFirstTab(e) {
    if (e.key === 'Tab') {
      document.documentElement.classList.add('show-focus');
      window.removeEventListener('keydown', handleFirstTab);
    }
  }
  window.addEventListener('keydown', handleFirstTab);
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
