/* ── Apply saved theme immediately to prevent flash ── */
document.documentElement.setAttribute(
  'data-theme', localStorage.getItem('viemag_theme') || 'light'
);

/* ── Shared nav renderer ── */
(function renderSharedNav() {
  const nav = `
<nav class="nav" role="navigation" aria-label="Main navigation">
  <div class="container container--wide">
    <div class="nav__inner">
      <a href="index.html" class="nav__logo" aria-label="VIEMAG Home">
        <span class="nav__logo-en">VIEMAG</span>
      </a>
      <div class="nav__links">
        <a href="index.html"        class="nav__link" data-i18n="nav.home">Home</a>
        <a href="brand-story.html"  class="nav__link" data-i18n="nav.brand">Brand Story</a>
        <a href="products.html"     class="nav__link" data-i18n="nav.products">Products</a>
        <a href="news.html"         class="nav__link" data-i18n="nav.news">Industry News</a>
        <a href="contact.html"      class="nav__link" data-i18n="nav.contact">Contact</a>
      </div>
      <div class="nav__right">
        <div class="theme-picker">
          <button class="theme-picker__btn" aria-label="Choose theme" title="Choose colour theme">
            <span class="theme-picker__dot"></span>
          </button>
          <div class="theme-picker__panel" role="listbox" aria-label="Colour themes">
            <button class="theme-swatch" data-theme="dark"  aria-label="Dark"      style="background:#0A1628"></button>
            <button class="theme-swatch" data-theme="light" aria-label="Cream"     style="background:#F8F5EF;outline:1px solid #d0c8bc"></button>
            <button class="theme-swatch" data-theme="p1"    aria-label="Warm Sand" style="background:#FAF3E8;outline:1px solid #d8c9b4"></button>
            <button class="theme-swatch" data-theme="p2"    aria-label="Pearl"     style="background:#F5F4F0;outline:1px solid #d0cec8"></button>
            <button class="theme-swatch" data-theme="p4"    aria-label="Mint"      style="background:#F2F7F5;outline:1px solid #c2d8d0"></button>
          </div>
        </div>
        <div class="lang-switch" role="group" aria-label="Language selector">
          <button class="lang-btn" data-lang="en"      aria-label="English">EN</button>
          <button class="lang-btn" data-lang="vi"      aria-label="Tiếng Việt">VI</button>
          <button class="lang-btn" data-lang="id"      aria-label="Bahasa Indonesia">ID</button>
          <button class="lang-btn" data-lang="zh-hans" aria-label="简体中文">简中</button>
          <button class="lang-btn" data-lang="zh"      aria-label="繁體中文">繁中</button>
        </div>
        <a href="contact.html" class="btn btn-outline" data-i18n="nav.cta_trade">Trade Inquiry</a>
        <a href="contact.html#buy"  class="btn btn-primary" data-i18n="nav.cta_buy">Where to Buy</a>
      </div>
      <button class="nav__hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>
<nav class="nav__mobile" aria-label="Mobile navigation">
  <a href="index.html"        class="nav__link" data-i18n="nav.home">Home</a>
  <a href="brand-story.html"  class="nav__link" data-i18n="nav.brand">Brand Story</a>
  <a href="products.html"     class="nav__link" data-i18n="nav.products">Products</a>
  <a href="news.html"         class="nav__link" data-i18n="nav.news">Industry News</a>
  <a href="contact.html"      class="nav__link" data-i18n="nav.contact">Contact</a>
  <div class="lang-switch" style="margin-top:8px">
    <button class="lang-btn" data-lang="en">EN</button>
    <button class="lang-btn" data-lang="vi">VI</button>
    <button class="lang-btn" data-lang="id">ID</button>
    <button class="lang-btn" data-lang="zh-hans">简中</button>
    <button class="lang-btn" data-lang="zh">繁中</button>
  </div>
  <a href="contact.html" class="btn btn-primary" style="margin-top:8px" data-i18n="nav.cta_trade">Trade Inquiry</a>
</nav>`;
  document.body.insertAdjacentHTML('afterbegin', nav);
})();
