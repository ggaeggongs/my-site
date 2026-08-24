/* =========================================================
   푸른금융지주 공용 스크립트 (모든 페이지 공통)
   - 순수 JavaScript. 설치 불필요.
   ========================================================= */

// 1) 스크롤 시 상단 내비게이션 그림자
var nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', function () {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// 2) 모바일 햄버거 메뉴 열고 닫기
var hamburger = document.getElementById('hamburger');
var mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  // 메뉴 안의 링크를 누르면 메뉴 닫기
  mobileMenu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

// 3) 스크롤 등장 애니메이션
var io = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) {
    if (e.isIntersecting) e.target.classList.add('in');
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

// 4) 서브 내비게이션(페이지 내 탭) — 현재 보고 있는 섹션 강조
var subnavLinks = document.querySelectorAll('.subnav a');
if (subnavLinks.length) {
  var sections = [];
  subnavLinks.forEach(function (link) {
    var id = link.getAttribute('href');
    if (id && id.charAt(0) === '#') {
      var sec = document.querySelector(id);
      if (sec) sections.push({ link: link, sec: sec });
    }
  });
  window.addEventListener('scroll', function () {
    var pos = window.scrollY + 160;
    var current = null;
    sections.forEach(function (item) {
      if (item.sec.offsetTop <= pos) current = item;
    });
    subnavLinks.forEach(function (l) { l.classList.remove('active'); });
    if (current) current.link.classList.add('active');
  });
}

// 4-1) 현재 페이지에 해당하는 상단 메뉴 강조 (data-nav 기준)
(function () {
  var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var map = {
    'about.html': 'about', 'affiliates.html': 'about',
    'governance.html': 'governance',
    'ir.html': 'ir', 'pr.html': 'pr', 'esg.html': 'esg', 'recruit.html': 'recruit'
  };
  var key = map[path];
  if (key) {
    var item = document.querySelector('.nav-item[data-nav="' + key + '"]');
    if (item) item.classList.add('active');
  }
})();

// 5) 문의 폼 (현재는 화면 안내만 — 추후 DB/AI 연동 예정)
var form = document.getElementById('contactForm');
var formMsg = document.getElementById('formMsg');
if (form && formMsg) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    formMsg.classList.add('show');
    form.querySelectorAll('input, textarea').forEach(function (i) { i.value = ''; });
    formMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
