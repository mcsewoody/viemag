/* ── Apply saved theme immediately to prevent flash ── */
document.documentElement.setAttribute(
  'data-theme', localStorage.getItem('viemag_theme') || 'dark'
);

/* ── Shared nav renderer ── */
(function renderSharedNav() {
  const nav = `
<nav class="nav" role="navigation" aria-label="Main navigation">
  <div class="container container--wide">
    <div class="nav__inner">
      <a href="index.html" class="nav__logo" aria-label="VIEMAG Home">
        <span class="nav__logo-en">VIEMAG</span>
        <span class="nav__logo-cn">唯美格</span>
      </a>
      <div class="nav__links">
        <a href="index.html"        class="nav__link" data-i18n="nav.home">Home</a>
        <a href="brand-story.html"  class="nav__link" data-i18n="nav.brand">Brand Story</a>
        <a href="products.html"     class="nav__link" data-i18n="nav.products">Products</a>
        <a href="news.html"         class="nav__link" data-i18n="nav.news">Industry News</a>
        <a href="contact.html"      class="nav__link" data-i18n="nav.contact">Contact</a>
      </div>
      <div class="nav__right">
        <button class="theme-toggle" aria-label="Toggle colour theme" title="Switch theme">
          <span class="theme-toggle__icon">☀️</span>
        </button>
        <div class="lang-switch" role="group" aria-label="Language selector">
          <button class="lang-btn" data-lang="en"  aria-label="English">EN</button>
          <button class="lang-btn" data-lang="zh"  aria-label="繁體中文">繁中</button>
          <button class="lang-btn" data-lang="vi"  aria-label="Tiếng Việt">VI</button>
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
    <button class="lang-btn" data-lang="zh">繁中</button>
    <button class="lang-btn" data-lang="vi">VI</button>
  </div>
  <a href="contact.html" class="btn btn-primary" style="margin-top:8px" data-i18n="nav.cta_trade">Trade Inquiry</a>
</nav>`;
  document.body.insertAdjacentHTML('afterbegin', nav);
})();
