/* Shared: helpers, navigation, animated image background */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function api(url, opts = {}) {
  const o = {credentials: 'same-origin', ...opts};
  if (o.body && !(o.body instanceof FormData)) { o.headers = {'Content-Type': 'application/json'}; o.body = JSON.stringify(o.body); }
  let r;
  try { r = await fetch(url, o); }
  catch { throw new Error('Cannot reach the server. Start it with "npm start" and open http://localhost:3000 in the browser.'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || (r.status === 404 || r.status === 405
    ? 'The server is not running this site. Use "npm start" and open http://localhost:3000 (do not open the .html files directly or use Live Server).'
    : 'Something went wrong (error ' + r.status + ').'));
  return data;
}
function say(el, text, ok) { el.textContent = text; el.className = 'msg' + (ok ? ' ok' : ''); }

/* ---- Navigation (changes with login state) ---- */
let ME = null;
const ready = (async () => {
  try { ME = (await api('/api/me')).user; } catch { ME = null; }
  const page = document.body.dataset.page;
  const link = (href, label, key) => `<a href="${href}" ${page === key ? 'aria-current="page"' : ''}>${label}</a>`;
  let h = link('/', 'Home', 'index') + link('/join.html', 'Join classes', 'join') +
          link('/recordings.html', 'Recordings', 'recordings') + link('/papers.html', 'Papers', 'papers');
  if (ME) {
    if (ME.role === 'admin') h += link('/admin.html', 'Admin', 'admin');
    h += link('/dashboard.html', 'My account', 'dashboard') + '<button class="btn small ghost-dark" id="logout">Log out</button>';
  } else h += '<a class="btn small" href="/login.html">Log in</a>';
  $('#menu').innerHTML = h;
  $('#logout')?.addEventListener('click', async () => { await api('/api/auth/logout', {method: 'POST'}); location.href = '/'; });
  $('#menuBtn').addEventListener('click', e => e.currentTarget.setAttribute('aria-expanded', $('#menu').classList.toggle('open')));
  return ME;
})();

/* ---- Animated image background: any element with data-fx ---- */
const CHIPS = ['&lt;/&gt; HTML', '01001001', 'Python', 'print("ICT")', 'Network', 'A/L · O/L'];
$$('[data-fx]').forEach(el => {
  const full = el.dataset.fx === 'full';
  const chips = (full ? CHIPS : CHIPS.slice(0, 3)).map((c, i) =>
    `<span class="chip-fx c${i + 1}" data-depth="${18 + i * 6}">${c}</span>`).join('');
  el.insertAdjacentHTML('afterbegin',
    `<div class="stage-img"><img src="/images/${full ? 'hero.jpg' : 'hero-face.jpg'}" alt="" decoding="async" ${full ? 'fetchpriority="high"' : ''}></div>
     <div class="lamp" aria-hidden="true"></div><canvas class="rain" aria-hidden="true"></canvas>
     <div class="chips" aria-hidden="true">${chips}</div>`);
  if (reduceMotion) return;
  const cv = $('.rain', el), ctx = cv.getContext('2d'), size = 16;
  let cols = [], raf;
  const fit = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    cols = Array.from({length: Math.ceil(cv.width / size)}, () => Math.random() * cv.height / size); };
  const draw = () => {
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over'; ctx.font = size + 'px monospace';
    cols.forEach((y, i) => {
      ctx.fillStyle = Math.random() > .92 ? '#f5a524' : '#4fd1c5';
      ctx.fillText(Math.random() > .5 ? '1' : '0', i * size, y * size);
      cols[i] = y * size > cv.height && Math.random() > .96 ? 0 : y + .5; });
    raf = requestAnimationFrame(draw); };
  let on = true;
  fit(); draw(); addEventListener('resize', fit);
  new IntersectionObserver(([e]) => { if (e.isIntersecting === on) return; on = e.isIntersecting; cancelAnimationFrame(raf); if (on) draw(); }).observe(el);
  if (matchMedia('(hover:hover)').matches) {
    const cs = $$('.chip-fx', el), img = $('.stage-img img', el);
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      cs.forEach(c => c.style.transform = `translate(${x * c.dataset.depth}px,${y * c.dataset.depth}px)`);
      img.style.transform = `translate(${x * -14}px,${y * -10}px)`; });
    el.addEventListener('mouseleave', () => { cs.forEach(c => c.style.transform = ''); img.style.transform = ''; });
  }
});
