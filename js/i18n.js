/* ============================================================
   VIEMAG i18n — Internationalization Engine
   Uses window.VIEMAG_TRANSLATIONS (no fetch needed)
   Supported: en | zh | vi
   ============================================================ */

const I18N = (() => {
  const LANGS = ['en', 'vi', 'id', 'zh-hans', 'zh'];
  let currentLang = 'en';
  let currentData = {};

  function getData(lang) {
    return (window.VIEMAG_TRANSLATIONS || {})[lang] || {};
  }

  function get(key) {
    const parts = key.split('.');
    let cur = currentData;
    for (const p of parts) {
      if (cur == null) return key;
      cur = cur[p];
    }
    return cur ?? key;
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = get(el.dataset.i18n);
      if (typeof v === 'string') el.innerHTML = v.replace(/\n/g, '<br>');
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const v = get(el.dataset.i18nPlaceholder);
      if (typeof v === 'string') el.placeholder = v;
    });
    const langAttr = currentLang === 'zh' ? 'zh-TW' : currentLang === 'zh-hans' ? 'zh-CN' : currentLang;
    document.documentElement.lang = langAttr;
  }

  function updateUI() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

  function setLang(lang) {
    if (!LANGS.includes(lang)) lang = 'en';
    currentLang = lang;
    currentData = getData(lang);
    localStorage.setItem('viemag_lang', lang);
    apply();
    updateUI();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang, data: currentData } }));
  }

  function init() {
    const urlParam = new URLSearchParams(location.search).get('lang');
    const saved = localStorage.getItem('viemag_lang');
    const preferred = urlParam || saved || 'en';
    setLang(preferred);
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-lang]');
      if (btn && LANGS.includes(btn.dataset.lang)) setLang(btn.dataset.lang);
    });
  }

  return { init, setLang, get, getLang: () => currentLang, getData: () => currentData };
})();
