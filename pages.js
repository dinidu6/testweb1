/* Page logic. Each block runs only on its own page. */
const PAGE = document.body.dataset.page;
const LANG = {si: 'Sinhala', en: 'English'};
const lock = '<span class="badge lock">Locked</span>';

const pages = {
/* ---------------- HOME ---------------- */
async index() {
  // typed headline
  const words = ['Grade 6-9', 'O/L students', ' English Medium'], t = $('#typed');
  if (reduceMotion) t.textContent = words[0];
  else { let w = 0, c = 0, del = false;
    const tick = () => { const word = words[w]; t.textContent = word.slice(0, c);
      if (!del && c === word.length) { del = true; return setTimeout(tick, 1600); }
      if (del && c === 0) { del = false; w = (w + 1) % words.length; return setTimeout(tick, 300); }
      c += del ? -1 : 1; setTimeout(tick, del ? 40 : 85); };
    setTimeout(tick, 3200); }
  // binary converter
  const bitsEl = $('#bits'), numEl = $('#num'); let bits = [];
  const drawBits = () => { bitsEl.innerHTML = '';
    bits.forEach((b, i) => { const el = document.createElement('button');
      el.className = 'bit' + (b ? ' on' : ''); el.type = 'button';
      el.setAttribute('aria-label', `Bit worth ${128 >> i}, currently ${b}`); el.innerHTML = `${b}<small>${128 >> i}</small>`;
      el.onclick = () => { bits[i] ^= 1; numEl.value = parseInt(bits.join(''), 2); drawBits(); }; bitsEl.append(el); });
    const on = bits.map((b, i) => b ? 128 >> i : null).filter(v => v !== null);
    $('#sum').textContent = on.length ? `${on.join(' + ')} = ${on.reduce((a, b) => a + b, 0)}` : '0 = 0'; };
  const fromNum = () => { const n = Math.min(255, Math.max(0, parseInt(numEl.value) || 0));
    bits = n.toString(2).padStart(8, '0').split('').map(Number); drawBits(); };
  numEl.oninput = fromNum; fromNum();
  // real stats
  api('/api/stats').then(s => { [['students', s.students], ['recordings', s.recordings], ['papers', s.papers], ['classes', s.classes]]
    .forEach(([k, v]) => { const el = $(`[data-stat="${k}"]`); let n = 0; const step = Math.max(1, Math.ceil(v / 40));
      const iv = setInterval(() => { n = Math.min(v, n + step); el.textContent = n.toLocaleString(); if (n === v) clearInterval(iv); }, 30); }); });
  // classes
  const classes = await api('/api/classes'), grid = $('#classGrid');
  const render = (f = 'all') => { grid.innerHTML = classes.filter(c => f === 'all' || c.level === f || c.lang === f).map(c => `
    <article class="card"><div class="top">${esc(c.name)}<small>${LANG[c.lang]} medium</small></div>
    <div class="body"><p>Live class: ${esc(c.schedule)}. Recordings, notes and papers included.</p>
    <div class="price">LKR ${c.price.toLocaleString()} / month</div>
    <a class="btn small" href="/join.html?class=${c.id}">Join this class</a></div></article>`).join(''); };
  $$('.chip').forEach(ch => ch.onclick = () => { $$('.chip').forEach(c => c.classList.remove('active')); ch.classList.add('active'); render(ch.dataset.filter); });
  render();
},

/* ---------------- LOGIN / REGISTER ---------------- */
async login() {
  const next = new URLSearchParams(location.search).get('next');
  const go = role => location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : (role === 'admin' ? '/admin.html' : '/dashboard.html');
  if (await ready) return go(ME.role);
  $$('.tab').forEach(tb => tb.onclick = () => { $$('.tab').forEach(x => x.classList.toggle('active', x === tb));
    $('#loginForm').hidden = tb.dataset.tab !== 'login'; $('#regForm').hidden = tb.dataset.tab !== 'reg'; });
  const submit = (form, url) => form.onsubmit = async e => { e.preventDefault(); const m = $('.msg', form);
    try { const r = await api(url, {method: 'POST', body: Object.fromEntries(new FormData(form))}); go(r.role); }
    catch (err) { say(m, err.message); } };
  submit($('#loginForm'), '/api/auth/login'); submit($('#regForm'), '/api/auth/register');
},

/* ---------------- JOIN ---------------- */
async join() {
  const me = await ready;
  if (!me) { $('#needLogin').hidden = false; $('#joinForm').hidden = true;
    $('#needLogin a').href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search); return; }
  const [classes, cfg] = await Promise.all([api('/api/classes'), api('/api/config')]);
  const want = +new URLSearchParams(location.search).get('class');
  $('#classPicker').innerHTML = classes.map((c, i) => `<label class="pick">
    <input type="radio" name="classId" value="${c.id}" ${(want ? want === c.id : i === 0) ? 'checked' : ''}>
    <span><strong>${esc(c.name)}</strong><small>${LANG[c.lang]} · ${esc(c.schedule)}</small></span><em>LKR ${c.price.toLocaleString()}</em></label>`).join('');
  $('#payBox').innerHTML = `<p><b>Bank:</b> ${esc(cfg.bank)}</p><p><b>Account name:</b> ${esc(cfg.accName)}</p><p><b>Account number:</b> ${esc(cfg.accNo)}</p>`;
  $('#who').textContent = `${me.name} (${me.phone})`;
  $('#joinForm').onsubmit = async e => { e.preventDefault(); const m = $('#msg'), f = e.target;
    try { await api('/api/enroll', {method: 'POST', body: new FormData(f)});
      say(m, 'Sent. We will check your slip and approve your class soon.', true); setTimeout(() => location.href = '/dashboard.html', 1500); }
    catch (err) { say(m, err.message); } };
},

/* ---------------- DASHBOARD ---------------- */
async dashboard() {
  const me = await ready; if (!me) return location.href = '/login.html?next=/dashboard.html';
  $('#hello').textContent = `Hello, ${me.name}`;
  const rows = await api('/api/my/enrollments'), label = {pending: 'Waiting for approval', approved: 'Approved', rejected: 'Rejected, send a clear slip'};
  $('#myClasses').innerHTML = rows.length ? rows.map(r => `<li class="paper"><div class="info"><h3>${esc(r.name)}</h3>
    <p>${esc(r.schedule)} · LKR ${r.price.toLocaleString()} / month</p></div>
    <span class="badge ${r.status}">${label[r.status]}</span>
    ${r.status === 'approved' ? '<a class="btn small" href="/recordings.html">Watch</a>' : r.status === 'rejected' ? '<a class="btn small" href="/join.html">Send again</a>' : ''}</li>`).join('')
    : '<li class="empty">You have not joined a class yet. <a href="/join.html">Join a class</a></li>';
},

/* ---------------- RECORDINGS ---------------- */
async recordings() {
  const [rows, classes] = await Promise.all([api('/api/recordings'), api('/api/classes')]); await ready;
  let cls = 'all', q = '';
  $('#chips').innerHTML = '<button class="chip active" data-id="all">All</button>' + classes.map(c => `<button class="chip" data-id="${c.id}">${esc(c.name)}</button>`).join('');
  const grid = $('#recGrid');
  const render = () => { const list = rows.filter(r => (cls === 'all' || r.class_id == cls) && (r.title + r.topic).toLowerCase().includes(q));
    $('#recCount').textContent = `${list.length} recording${list.length === 1 ? '' : 's'}`;
    grid.innerHTML = list.length ? list.map(r => `<article class="card rec">
      ${r.locked ? `<a class="thumb locked" href="${ME ? '/join.html?class=' + r.class_id : '/login.html?next=/recordings.html'}"><span class="play">🔒</span></a>`
        : `<button class="thumb" data-id="${esc(r.video)}" data-title="${esc(r.title)}" aria-label="Play ${esc(r.title)}"><img src="https://i.ytimg.com/vi/${esc(r.video)}/hqdefault.jpg" alt="" loading="lazy"><span class="play">▶</span><span class="len">${esc(r.length)}</span></button>`}
      <div class="body"><h3>${esc(r.title)}</h3><p>${esc(r.class_name)} · ${esc(r.topic)}</p><p>${fmtDate(r.date)} ${r.free ? '<span class="badge approved">Free</span>' : r.locked ? lock : ''}</p></div></article>`).join('')
      : '<p class="empty">No recordings yet. Check again after the next class.</p>'; };
  $('#chips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; $$('.chip').forEach(c => c.classList.toggle('active', c === b)); cls = b.dataset.id; render(); };
  $('#search').oninput = e => { q = e.target.value.toLowerCase().trim(); render(); };
  const modal = $('#modal'), frame = $('#frame'); let last;
  const close = () => { modal.hidden = true; frame.src = 'about:blank'; last?.focus(); };
  grid.onclick = e => { const b = e.target.closest('button.thumb'); if (!b) return; last = b;
    $('#modalTitle').textContent = b.dataset.title; frame.src = `https://www.youtube-nocookie.com/embed/${b.dataset.id}?autoplay=1&rel=0`;
    modal.hidden = false; $('#closeModal').focus(); };
  $('#closeModal').onclick = close; modal.onclick = e => e.target === modal && close();
  addEventListener('keydown', e => e.key === 'Escape' && !modal.hidden && close());
  render();
},

/* ---------------- PAPERS ---------------- */
async papers() {
  const [rows, classes] = await Promise.all([api('/api/papers'), api('/api/classes')]); await ready;
  let cls = 'all', type = 'all', q = '';
  $('#classSel').innerHTML = '<option value="all">All classes</option>' + classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const render = () => { const list = rows.filter(p => (cls === 'all' || p.class_id == cls) && (type === 'all' || p.type === type) && (p.title + p.year).toLowerCase().includes(q));
    $('#paperCount').textContent = `${list.length} file${list.length === 1 ? '' : 's'}`;
    $('#paperList').innerHTML = list.length ? list.map(p => `<li class="paper"><div class="ficon" aria-hidden="true">PDF</div>
      <div class="info"><h3>${esc(p.title)}</h3><p>${esc(p.class_name)} · ${esc(p.type)} · ${p.year} · ${esc(p.size)}</p></div>
      ${p.locked ? `<a class="btn small ghost-dark" href="${ME ? '/join.html?class=' + p.class_id : '/login.html?next=/papers.html'}">Join to download</a>`
        : `<a class="btn small" href="/api/papers/${p.id}/download">Download</a>`}</li>`).join('') : '<li class="empty">No files found. Try another filter.</li>'; };
  $('#classSel').onchange = e => { cls = e.target.value; render(); }; $('#typeSel').onchange = e => { type = e.target.value; render(); };
  $('#search').oninput = e => { q = e.target.value.toLowerCase().trim(); render(); };
  render();
},

/* ---------------- ADMIN ---------------- */
async admin() {
  const me = await ready; if (!me || me.role !== 'admin') return location.href = '/login.html?next=/admin.html';
  $$('.tab').forEach(tb => tb.onclick = () => { $$('.tab').forEach(x => x.classList.toggle('active', x === tb));
    $$('.panel').forEach(p => p.hidden = p.id !== 'p-' + tb.dataset.tab); });
  const A = '/api/admin', del = (url, fn) => async e => { if (!confirm('Delete this item?')) return; await api(url, {method: 'DELETE'}); fn(); };
  const fillClasses = classes => $$('select[name=classId]').forEach(s => s.innerHTML = classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(''));

  async function loadEnr() { const rows = await api(A + '/enrollments');
    $('#enrList').innerHTML = rows.length ? rows.map(r => `<li class="paper"><div class="info"><h3>${esc(r.name)} · ${esc(r.phone)}</h3>
      <p>${esc(r.class_name)} · ${esc(r.school || 'no school')} · ${fmtDate(r.created_at)}</p></div>
      <span class="badge ${r.status}">${r.status}</span>
      ${r.slip ? `<a class="btn small ghost-dark" target="_blank" rel="noopener" href="${A}/slips/${esc(r.slip)}">View slip</a>` : ''}
      <button class="btn small" data-id="${r.id}" data-s="approved">Approve</button>
      <button class="btn small ghost-dark" data-id="${r.id}" data-s="rejected">Reject</button></li>`).join('') : '<li class="empty">No requests yet.</li>'; }
  $('#enrList').onclick = async e => { const b = e.target.closest('button[data-s]'); if (!b) return;
    await api(`${A}/enrollments/${b.dataset.id}`, {method: 'POST', body: {status: b.dataset.s}}); loadEnr(); };

  async function loadClasses() { const rows = await api(A + '/classes'); fillClasses(rows);
    $('#clsList').innerHTML = rows.map(c => `<li class="paper"><div class="info"><h3>${esc(c.name)}</h3><p>${c.level === 'al' ? 'A/L' : 'Grade 6-11'} · ${LANG[c.lang]} · ${esc(c.schedule)} · LKR ${c.price}</p></div>
      <button class="btn small ghost-dark" data-id="${c.id}">Delete</button></li>`).join(''); }
  $('#clsList').onclick = e => { const b = e.target.closest('button'); b && del(`${A}/classes/${b.dataset.id}`, loadClasses)(); };

  async function loadRec() { const rows = await api('/api/recordings');
    $('#recList').innerHTML = rows.map(r => `<li class="paper"><div class="info"><h3>${esc(r.title)}</h3><p>${esc(r.class_name)} · ${fmtDate(r.date)}${r.free ? ' · Free' : ''}</p></div>
      <button class="btn small ghost-dark" data-id="${r.id}">Delete</button></li>`).join('') || '<li class="empty">No recordings.</li>'; }
  $('#recList').onclick = e => { const b = e.target.closest('button'); b && del(`${A}/recordings/${b.dataset.id}`, loadRec)(); };

  async function loadPap() { const rows = await api('/api/papers');
    $('#papList').innerHTML = rows.map(p => `<li class="paper"><div class="info"><h3>${esc(p.title)}</h3><p>${esc(p.class_name)} · ${esc(p.type)} · ${p.year}${p.free ? ' · Free' : ''}</p></div>
      <button class="btn small ghost-dark" data-id="${p.id}">Delete</button></li>`).join('') || '<li class="empty">No papers.</li>'; }
  $('#papList').onclick = e => { const b = e.target.closest('button'); b && del(`${A}/papers/${b.dataset.id}`, loadPap)(); };

  const post = (form, url, after, multipart) => form.onsubmit = async e => { e.preventDefault(); const m = $('.msg', form);
    try { const fd = new FormData(form); await api(url, {method: 'POST', body: multipart ? fd : Object.fromEntries(fd)});
      form.reset(); say(m, 'Saved.', true); after(); } catch (err) { say(m, err.message); } };
  post($('#clsForm'), A + '/classes', loadClasses); post($('#recForm'), A + '/recordings', loadRec);
  post($('#papForm'), A + '/papers', loadPap, true);
  await loadClasses(); loadEnr(); loadRec(); loadPap();
}
};
pages[PAGE]?.().catch(err => console.error(err));
