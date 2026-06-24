/* ============================================================
   VIEMAG — Main JavaScript
   Scroll animations, nav, mobile menu, form
   ============================================================ */

/* ── Scroll Reveal (Intersection Observer) ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

function initReveal() {
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

/* ── Sticky Nav shadow on scroll ── */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile hamburger
  const ham = document.querySelector('.nav__hamburger');
  const mobile = document.querySelector('.nav__mobile');
  if (ham && mobile) {
    ham.addEventListener('click', () => {
      const open = mobile.classList.toggle('open');
      ham.setAttribute('aria-expanded', open);
    });
    // Close on link click
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobile.classList.remove('open')));
  }

  // Active nav link
  const page = location.pathname.split('/').pop().replace('.html', '') || 'index';
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('href') || '';
    const match = href.replace('.html', '').replace('./', '');
    if ((page === 'index' && match === 'index') ||
        (page !== 'index' && match.includes(page))) {
      link.classList.add('active');
    }
  });
}

/* ── Counter animation for stats ── */
function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const isFloat = target % 1 !== 0;
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const val = Math.round(target * ease);
    el.textContent = isFloat ? val.toFixed(1) : val;
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function initCounters() {
  const stats = document.querySelectorAll('.stat-num[data-target]');
  if (!stats.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCounter(e.target, +e.target.dataset.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  stats.forEach(el => obs.observe(el));
}

/* ── Contact form submission ── */
function initContactForm() {
  const form = document.querySelector('.contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = '✓ Sent!';
    btn.style.background = 'var(--green)';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = btn.dataset.original || 'Send Inquiry';
      btn.style.background = '';
      form.reset();
    }, 3000);
  });
  const btn = form.querySelector('[type=submit]');
  if (btn) btn.dataset.original = btn.textContent;
  // Update submit button text on lang change
  document.addEventListener('langchange', ({ detail }) => {
    if (btn) btn.textContent = detail.data?.contact_page?.form_submit || btn.dataset.original;
  });
}

/* ── SVG Illustrations for product cards ── */
const CAT_SVG = {
  A: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="8" fill="#C8941A"/>
    <circle cx="60" cy="60" r="18" stroke="#C8941A" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>
    <circle cx="60" cy="60" r="28" stroke="#C8941A" stroke-width="1" opacity="0.5"/>
    <circle cx="60" cy="60" r="40" stroke="#4A7AB5" stroke-width="1" opacity="0.3"/>
    <circle cx="60" cy="60" r="52" stroke="#4A7AB5" stroke-width="0.5" opacity="0.15"/>
    <line x1="60" y1="8" x2="60" y2="32" stroke="#C8941A" stroke-width="1.5" opacity="0.6"/>
    <line x1="60" y1="88" x2="60" y2="112" stroke="#C8941A" stroke-width="1.5" opacity="0.6"/>
    <line x1="8" y1="60" x2="32" y2="60" stroke="#C8941A" stroke-width="1.5" opacity="0.6"/>
    <line x1="88" y1="60" x2="112" y2="60" stroke="#C8941A" stroke-width="1.5" opacity="0.6"/>
  </svg>`,
  B: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 75 L30 45 L90 45 L100 75 L20 75Z" stroke="#C8941A" stroke-width="1.5" fill="rgba(200,148,26,0.05)"/>
    <circle cx="35" cy="80" r="8" stroke="#C8941A" stroke-width="1.5" fill="none"/>
    <circle cx="85" cy="80" r="8" stroke="#C8941A" stroke-width="1.5" fill="none"/>
    <circle cx="60" cy="55" r="6" fill="#C8941A" opacity="0.8"/>
    <circle cx="60" cy="55" r="12" stroke="#C8941A" stroke-width="1" opacity="0.5"/>
    <circle cx="60" cy="55" r="18" stroke="#C8941A" stroke-width="0.5" opacity="0.3"/>
    <line x1="60" y1="20" x2="60" y2="37" stroke="#C8941A" stroke-width="1" opacity="0.5"/>
  </svg>`,
  C: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="35" y="30" width="50" height="65" rx="8" stroke="#C8941A" stroke-width="1.5" fill="rgba(200,148,26,0.05)"/>
    <rect x="47" y="22" width="26" height="10" rx="4" stroke="#C8941A" stroke-width="1.5" fill="none"/>
    <circle cx="60" cy="63" r="10" fill="rgba(200,148,26,0.2)" stroke="#C8941A" stroke-width="1.5"/>
    <path d="M55 63 L59 67 L66 59" stroke="#C8941A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="40" y="80" width="40" height="5" rx="2" fill="rgba(200,148,26,0.3)"/>
  </svg>`,
  D: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="25" width="60" height="55" rx="6" stroke="#C8941A" stroke-width="1.5" fill="rgba(200,148,26,0.05)"/>
    <line x1="60" y1="80" x2="60" y2="100" stroke="#C8941A" stroke-width="1.5"/>
    <line x1="40" y1="100" x2="80" y2="100" stroke="#C8941A" stroke-width="1.5"/>
    <circle cx="60" cy="52" r="8" fill="#C8941A" opacity="0.8"/>
    <circle cx="60" cy="52" r="14" stroke="#C8941A" stroke-width="1" opacity="0.5"/>
    <circle cx="60" cy="52" r="20" stroke="#C8941A" stroke-width="0.5" opacity="0.25"/>
  </svg>`,
  E: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="6" fill="#C8941A"/>
    <circle cx="30" cy="40" r="4" fill="rgba(200,148,26,0.6)"/>
    <circle cx="90" cy="40" r="4" fill="rgba(200,148,26,0.6)"/>
    <circle cx="30" cy="80" r="4" fill="rgba(200,148,26,0.6)"/>
    <circle cx="90" cy="80" r="4" fill="rgba(200,148,26,0.6)"/>
    <circle cx="60" cy="20" r="4" fill="rgba(200,148,26,0.4)"/>
    <circle cx="60" cy="100" r="4" fill="rgba(200,148,26,0.4)"/>
    <line x1="60" y1="60" x2="30" y2="40" stroke="rgba(200,148,26,0.4)" stroke-width="1"/>
    <line x1="60" y1="60" x2="90" y2="40" stroke="rgba(200,148,26,0.4)" stroke-width="1"/>
    <line x1="60" y1="60" x2="30" y2="80" stroke="rgba(200,148,26,0.4)" stroke-width="1"/>
    <line x1="60" y1="60" x2="90" y2="80" stroke="rgba(200,148,26,0.4)" stroke-width="1"/>
    <line x1="60" y1="60" x2="60" y2="20" stroke="rgba(200,148,26,0.4)" stroke-width="1"/>
    <line x1="60" y1="60" x2="60" y2="100" stroke="rgba(200,148,26,0.4)" stroke-width="1"/>
  </svg>`
};

/* ── News article placeholders ── */
function newsIllustration(cat) {
  const colors = { Technology: '#4A7AB5', Market: '#5A8A6B', Product: '#C8941A', Industry: '#C84A3A' };
  const c = colors[cat] || '#C8941A';
  return `<svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <rect width="320" height="200" fill="#0A1628"/>
    <circle cx="160" cy="100" r="40" stroke="${c}" stroke-width="1" opacity="0.5"/>
    <circle cx="160" cy="100" r="70" stroke="${c}" stroke-width="0.5" opacity="0.25"/>
    <circle cx="160" cy="100" r="12" fill="${c}" opacity="0.8"/>
    <line x1="160" y1="30" x2="160" y2="60" stroke="${c}" stroke-width="1" opacity="0.4"/>
    <line x1="160" y1="140" x2="160" y2="170" stroke="${c}" stroke-width="1" opacity="0.4"/>
    <line x1="90" y1="100" x2="120" y2="100" stroke="${c}" stroke-width="1" opacity="0.4"/>
    <line x1="200" y1="100" x2="230" y2="100" stroke="${c}" stroke-width="1" opacity="0.4"/>
  </svg>`;
}

/* ── Theme picker ── */
const THEME_BG = {
  dark: '#0A1628', light: '#F8F5EF',
  p1: '#FAF3E8',   p2: '#F5F4F0', p4: '#F2F7F5'
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
  document.querySelectorAll('.theme-picker__dot').forEach(el => {
    el.style.background = THEME_BG[theme] || THEME_BG.light;
    el.style.boxShadow = theme === 'dark' ? 'none' : 'inset 0 0 0 1.5px rgba(0,0,0,0.15)';
  });
}

function initThemePicker() {
  const saved = localStorage.getItem('viemag_theme') || 'light';
  applyTheme(saved);

  document.addEventListener('click', e => {
    const swatch = e.target.closest('.theme-swatch');
    if (swatch) {
      applyTheme(swatch.dataset.theme);
      localStorage.setItem('viemag_theme', swatch.dataset.theme);
      document.querySelector('.theme-picker__panel')?.classList.remove('open');
      return;
    }
    if (e.target.closest('.theme-picker__btn')) {
      document.querySelector('.theme-picker__panel')?.classList.toggle('open');
      return;
    }
    if (!e.target.closest('.theme-picker')) {
      document.querySelector('.theme-picker__panel')?.classList.remove('open');
    }
  });
}

/* ── Export helpers ── */
window.VIEMAG = { CAT_SVG, newsIllustration };

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  initThemePicker();
  initNav();
  initReveal();
  initCounters();
  initContactForm();
  I18N.init();
});
