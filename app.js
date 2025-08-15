/* Elder Realms AI — MVP static demo
 * Stack: Tailwind (CDN), PouchDB (CDN), Mermaid (CDN)
 * Purpose: Pitch-ready static SaaS demo deployable to Netlify (no build step)
 */

// --- State & DB (PouchDB) ---
const db = new PouchDB('elder-realms-mvp');
const now = () => new Date().toISOString();

const seed = async () => {
  const existing = await db.allDocs();
  if (existing.total_rows > 0) return;
  const docs = [
    { _id: 'settings', type: 'settings', tenantId: 'tenant-demo', facility: 'Main Facility' },
    { _id: 'resident:1', type: 'resident', name: 'Ama Mensah', mobility: 'low', preferences: { diet: 'low-sodium' }, allergies: ['shellfish'] },
    { _id: 'resident:2', type: 'resident', name: 'Kwesi Boateng', mobility: 'medium', preferences: { diet: 'diabetic' }, allergies: ['fish'] },
    { _id: 'meal:1', type: 'meal', name: 'Jollof Rice', nutrition: { kcal: 650 }, allergens: ['none'], served_at: now() },
    { _id: 'meal:2', type: 'meal', name: 'Light Soup', nutrition: { kcal: 350 }, allergens: ['fish'], served_at: now() },
    { _id: 'task:1', type: 'task', status: 'open', title: 'Reposition Ama', assignee: 'Nurse A', shift: 'day', due_at: now() },
    { _id: 'task:2', type: 'task', status: 'in_progress', title: 'Check Kwesi BP', assignee: 'Nurse B', shift: 'evening', due_at: now() },
    { _id: 'log:1', type: 'conversation', role: 'resident', text: 'I feel cold', at: now() },
    { _id: 'cp:1', type: 'care_plan', resident_id: 'resident:1', title: 'Turn schedule (q2h)', frequency: 'q2h', last_completed_at: '' },
  ];
  await db.bulkDocs(docs);
};

// --- UI Helpers ---
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls = '', children = []) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const c of children) e.appendChild(c);
  return e;
};

// Toast helper (accessible, polite live region in #toastRegion)
function toast(message, { type = 'info', timeout = 3000 } = {}) {
  const region = document.getElementById('toastRegion');
  if (!region) { console.warn('toastRegion not found'); return; }
  const color = (
    type === 'success' ? 'bg-green-600 text-white' :
    type === 'error' ? 'bg-red-600 text-white' :
    type === 'warning' ? 'bg-amber-500 text-black' :
    'bg-slate-800 text-white'
  );
  const box = document.createElement('div');
  box.className = `rounded shadow-lg px-3 py-2 text-sm ${color} flex items-start gap-2 max-w-xs`;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  const span = document.createElement('span');
  span.textContent = message;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ml-auto text-xs opacity-80 hover:opacity-100 focus:outline-none';
  btn.setAttribute('aria-label', 'Dismiss notification');
  btn.textContent = '×';
  btn.addEventListener('click', () => { box.remove(); });
  box.appendChild(span);
  box.appendChild(btn);
  region.appendChild(box);
  if (timeout > 0) {
    setTimeout(() => box.remove(), timeout);
  }
}

// URL helpers for deep-linking tabs
function getRequestedTabFromURL() {
  try {
    const url = new URL(window.location.href);
    const qs = url.searchParams.get('tab');
    if (qs) return qs;
    const h = (url.hash || '').replace(/^#/, '');
    if (h && h.startsWith('tab=')) return h.split('=')[1];
  } catch {}
  return null;
}

function setTabInURL(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState({}, '', url.toString());
  } catch {}
}

const renderTabs = () => {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.add('hidden'));
      $(`#tab-${id}`).classList.remove('hidden');
      // active state
      buttons.forEach(b => b.classList.remove('tab-btn-active'));
      btn.classList.add('tab-btn-active');
      // persist selection
      try { localStorage.setItem('activeTab', id); } catch {}
      // update URL for deep link
      setTabInURL(id);
      // tab-specific loads
      if (id === 'diagrams') renderDiagrams();
      if (id === 'residents') loadResidents();
      if (id === 'repositioning') loadRepositioning();
      if (id === 'meals') loadMeals();
      if (id === 'tasks') loadTasks();
      if (id === 'careplans') loadCarePlans();
      if (id === 'analytics') loadAnalytics();
      if (id === 'prd') loadPRD();
    });
  });
  // Ensure Home is visible before any JS routing completes (SSR/static first paint)
  document.querySelector('#tab-home')?.classList.remove('hidden');
  // default tab
  const requested = getRequestedTabFromURL();
  // One-time migration: force everyone to Home once
  let useStored = (()=>{ try { return localStorage.getItem('activeTab'); } catch { return null; } })();
  const migrated = (()=>{ try { return localStorage.getItem('home_migration_done_v1'); } catch { return '1'; } })();
  if (!migrated) {
    try {
      localStorage.setItem('activeTab', 'home');
      localStorage.setItem('home_migration_done_v1', '1');
    } catch {}
    useStored = 'home';
  }

  const byRequest = requested && document.querySelector(`.tab-btn[data-tab="${requested}"]`);
  const byStored = useStored && document.querySelector(`.tab-btn[data-tab="${useStored}"]`);
  const target = (byRequest || byStored) || document.querySelector('.tab-btn');
  if (target) {
    target.click();
  } else {
    // Final fallback: show Home explicitly and mark its button active
    const homeBtn = document.querySelector('.tab-btn[data-tab="home"]');
    document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
    document.querySelector('#tab-home')?.classList.remove('hidden');
    if (homeBtn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn-active'));
      homeBtn.classList.add('tab-btn-active');
    }
    setTabInURL('home');
    try { localStorage.setItem('activeTab', 'home'); } catch {}
  }
};

// --- Residents ---
// Residents state & helpers
const rState = {
  page: 1,
  pageSize: 12,
  search: '',
  mobility: new Set(),
  diet: '',
  sort: 'name_asc',
};

function debounce(fn, ms = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
}

function getSelectedOptions(selectEl) {
  return Array.from(selectEl?.selectedOptions || []).map(o => o.value);
}

async function readAllResidents() {
  const { rows } = await db.find ? await db.find({ selector: { type: 'resident' } }) : await db.allDocs({ include_docs: true });
  return rows ? rows.map(r => r.doc).filter(d => d.type === 'resident') : (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc).filter(d=>d.type==='resident');
}

function applyResidentFiltersSort(items) {
  let out = items;
  if (rState.search) out = out.filter(r => String(r.name||'').toLowerCase().includes(rState.search));
  if (rState.mobility.size) out = out.filter(r => rState.mobility.has(String(r.mobility||'').toLowerCase()));
  if (rState.diet) out = out.filter(r => String(r.preferences?.diet||'').toLowerCase().includes(rState.diet));
  out.sort((a,b)=>{
    const an = String(a.name||'').toLowerCase();
    const bn = String(b.name||'').toLowerCase();
    if (rState.sort === 'name_desc') return bn.localeCompare(an);
    return an.localeCompare(bn);
  });
  return out;
}

async function loadResidents() {
  const all = await readAllResidents();
  const filtered = applyResidentFiltersSort(all);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / rState.pageSize));
  rState.page = Math.min(Math.max(1, rState.page), pages);
  const start = (rState.page - 1) * rState.pageSize;
  const pageItems = filtered.slice(start, start + rState.pageSize);

  const list = $('#residentList');
  list.innerHTML = '';
  if (!pageItems.length) {
    list.innerHTML = '<div class="text-sm text-slate-600">No residents match your filters.</div>';
  }
  for (const r of pageItems) {
    const card = el('div', 'bg-white border rounded p-3 shadow-soft');
    card.innerHTML = `<div class="flex items-start justify-between">
        <div>
          <div class="font-semibold text-blue-600">${r.name}</div>
          <div class="text-xs text-gray-600">Mobility: ${r.mobility||'-'}</div>
          <div class="text-xs text-gray-600">Diet: ${r.preferences?.diet || '-'} </div>
          <div class="text-xs text-gray-600">Allergies: ${(r.allergies||[]).join(', ') || 'none'}</div>
        </div>
        <button class="px-2 py-1 border rounded text-xs" data-id="${r._id}" style="border-color:#1D4ED8">Edit</button>
      </div>`;
    card.querySelector('button[data-id]')?.addEventListener('click', () => openResidentModal(r));
    list.appendChild(card);
  }

  const info = $('#residentPageInfo');
  const prev = $('#residentPrevPage');
  const next = $('#residentNextPage');
  if (info) info.textContent = `Page ${rState.page} of ${pages}`;
  if (prev) prev.disabled = rState.page <= 1;
  if (next) next.disabled = rState.page >= pages;
}

$('#residentPrevPage')?.addEventListener('click', () => { rState.page = Math.max(1, rState.page - 1); loadResidents(); });
$('#residentNextPage')?.addEventListener('click', () => { rState.page = rState.page + 1; loadResidents(); });

// Wire controls
$('#residentSearch')?.addEventListener('input', debounce((e)=>{ rState.search = String(e.target.value||'').toLowerCase().trim(); rState.page = 1; loadResidents(); }, 200));
$('#residentMobilityFilter')?.addEventListener('change', ()=>{ rState.mobility = new Set(getSelectedOptions($('#residentMobilityFilter')).map(s=>s.toLowerCase())); rState.page = 1; loadResidents(); });
$('#residentDietFilter')?.addEventListener('input', debounce((e)=>{ rState.diet = String(e.target.value||'').toLowerCase().trim(); rState.page = 1; loadResidents(); }, 200));
$('#residentSort')?.addEventListener('change', (e)=>{ rState.sort = e.target.value; rState.page = 1; loadResidents(); });

// Create/Edit/Delete modal
const rEl = {
  modal: () => document.getElementById('residentEditModal'),
  name: () => document.getElementById('rName'),
  mobility: () => document.getElementById('rMobility'),
  diet: () => document.getElementById('rDiet'),
  allergies: () => document.getElementById('rAllergies'),
  close: () => document.getElementById('rClose'),
  cancel: () => document.getElementById('rCancel'),
  save: () => document.getElementById('rSave'),
  del: () => document.getElementById('rDelete'),
};

let rEditing = { id: null };

// Modal a11y: focus trap, esc/overlay close, return focus
let rModalPrevFocus = null;
let rModalKeydownHandler = null;
let rModalClickHandler = null;

function setupResidentModalA11y() {
  const modal = rEl.modal();
  if (!modal) return;
  // Overlay click closes if clicking background (not dialog panel)
  rModalClickHandler = (e) => {
    if (e.target === modal) closeResidentModal();
  };
  modal.addEventListener('mousedown', rModalClickHandler);

  // Focus trap + ESC
  rModalKeydownHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeResidentModal(); return; }
    if (e.key === 'Tab') {
      const dialog = modal.querySelector('[role="dialog"]') || modal;
      const focusables = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  };
  document.addEventListener('keydown', rModalKeydownHandler);
}

function openResidentModal(resident = null) {
  rEditing.id = resident?._id || null;
  if (rEl.name()) rEl.name().value = resident?.name || '';
  if (rEl.mobility()) rEl.mobility().value = resident?.mobility || 'low';
  if (rEl.diet()) rEl.diet().value = resident?.preferences?.diet || '';
  if (rEl.allergies()) rEl.allergies().value = (resident?.allergies||[]).join(', ');
  // clear inline errors
  const err = document.getElementById('rNameError');
  if (err) err.classList.add('hidden');
  if (rEl.name()) rEl.name().setAttribute('aria-invalid', 'false');
  const m = rEl.modal(); if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
  // remember opener and focus first field
  rModalPrevFocus = document.activeElement;
  setTimeout(() => { rEl.name()?.focus(); }, 0);
  setupResidentModalA11y();
}

function closeResidentModal() {
  const m = rEl.modal(); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  rEditing.id = null;
  // remove listeners
  if (rModalKeydownHandler) { document.removeEventListener('keydown', rModalKeydownHandler); rModalKeydownHandler = null; }
  if (rModalClickHandler && m) { m.removeEventListener('mousedown', rModalClickHandler); rModalClickHandler = null; }
  // restore focus
  try { rModalPrevFocus && rModalPrevFocus.focus && rModalPrevFocus.focus(); } catch {}
}

async function saveResident() {
  const name = rEl.name()?.value.trim();
  if (!name) {
    const err = document.getElementById('rNameError');
    if (err) err.classList.remove('hidden');
    if (rEl.name()) { rEl.name().setAttribute('aria-invalid', 'true'); rEl.name().focus(); }
    toast('Name is required', { type: 'error' });
    return;
  }
  const mobility = rEl.mobility()?.value || 'low';
  const diet = rEl.diet()?.value || '';
  const allergies = (rEl.allergies()?.value || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (rEditing.id) {
    const current = await db.get(rEditing.id);
    await db.put({ ...current, name, mobility, preferences: { ...(current.preferences||{}), diet }, allergies, updated_at: now() });
  } else {
    await db.put({ _id: `resident:${Date.now()}`, type: 'resident', name, mobility, preferences: { diet }, allergies, created_at: now(), updated_at: now() });
  }
  closeResidentModal();
  loadResidents();
  populateResidentSelect?.();
  toast('Resident saved', { type: 'success' });
}

async function deleteResident() {
  if (!rEditing.id) { closeResidentModal(); return; }
  if (!confirm('Delete this resident? This cannot be undone.')) return;
  const current = await db.get(rEditing.id);
  await db.remove(current);
  closeResidentModal();
  loadResidents();
  populateResidentSelect?.();
  toast('Resident deleted', { type: 'success' });
}

$('#addResidentBtn')?.addEventListener('click', ()=> openResidentModal());
rEl.close()?.addEventListener('click', closeResidentModal);
rEl.cancel()?.addEventListener('click', closeResidentModal);
rEl.save()?.addEventListener('click', saveResident);
rEl.del()?.addEventListener('click', deleteResident);

// Import/Export
function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

function toCsv(rows) {
  const header = ['name','mobility','diet','allergies'];
  const escape = v => '"' + String(v||'').replace(/"/g,'""') + '"';
  const lines = [header.join(',')];
  for (const r of rows) lines.push([escape(r.name), escape(r.mobility), escape(r.preferences?.diet||''), escape((r.allergies||[]).join(';'))].join(','));
  return lines.join('\n');
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(s=>s.trim().toLowerCase());
  const idx = {
    name: header.indexOf('name'), mobility: header.indexOf('mobility'), diet: header.indexOf('diet'), allergies: header.indexOf('allergies')
  };
  const out = [];
  for (let i=1;i<lines.length;i++) {
    const cols = lines[i].split(',');
    const name = (cols[idx.name]||'').replace(/^"|"$/g,'').trim();
    if (!name) continue;
    const mobility = (cols[idx.mobility]||'').replace(/^"|"$/g,'').trim() || 'low';
    const diet = (cols[idx.diet]||'').replace(/^"|"$/g,'').trim();
    const allergiesRaw = (cols[idx.allergies]||'').replace(/^"|"$/g,'').trim();
    const allergies = allergiesRaw ? allergiesRaw.split(/[,;]+/).map(s=>s.trim()).filter(Boolean) : [];
    out.push({ name, mobility, preferences: { diet }, allergies });
  }
  return out;
}

$('#residentExportJsonBtn')?.addEventListener('click', async ()=>{
  const all = await readAllResidents();
  download('residents.json', JSON.stringify(all, null, 2));
});
$('#residentExportCsvBtn')?.addEventListener('click', async ()=>{
  const all = await readAllResidents();
  download('residents.csv', toCsv(all));
});
$('#residentImportBtn')?.addEventListener('click', async ()=>{
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,.csv,text/csv,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const text = await file.text();
    let items = [];
    try {
      if (file.name.toLowerCase().endsWith('.json')) items = JSON.parse(text);
      else items = parseCsv(text);
    } catch(e) { toast('Failed to parse file', { type: 'error' }); return; }
    let ok=0, skip=0;
    for (const it of items) {
      try {
        const name = (it.name||'').trim(); if (!name) { skip++; continue; }
        const mobility = (it.mobility||'low').toLowerCase();
        const diet = (it.preferences?.diet || it.diet || '').trim();
        const allergies = Array.isArray(it.allergies) ? it.allergies : String(it.allergies||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
        await db.put({ _id: `resident:${Date.now()}-${Math.random().toString(16).slice(2)}`, type: 'resident', name, mobility, preferences: { diet }, allergies, created_at: now(), updated_at: now() });
        ok++;
      } catch { skip++; }
    }
    toast(`Imported ${ok} resident(s). Skipped ${skip}.`, { type: ok ? 'success' : 'warning' });
    loadResidents();
    populateResidentSelect?.();
  };
  input.click();
});

// --- Assistant (mock NLU + streaming) ---
function mockAssistant(text, role) {
  const t = text.toLowerCase();
  if (t.includes('pain') || t.includes('hurt')) return 'I understand you feel pain. I will notify a caregiver and suggest a gentle turn to the left with pillow support.';
  if (t.includes('water') || t.includes('drink')) return 'I can request water for you. A caregiver will bring it shortly.';
  if (t.includes('cold')) return 'I will request a blanket and check room temperature settings.';
  if (t.includes('dizzy') || t.includes('dizziness')) return 'Please sit or lie down. I will alert staff to check vitals and ensure safety.';
  return role === 'resident' ? 'Thank you. I will inform staff and log your request.' : 'Acknowledged. I will log the note for this resident.';
}

async function streamReply(text, cb, delay=40) {
  const tokens = text.split(' ');
  for (let i=0;i<tokens.length;i++) {
    await new Promise(r=>setTimeout(r, delay));
    cb(tokens[i] + (i<tokens.length-1?' ':''));
  }
}

function appendTranscriptBubble(role, text) {
  const t = $('#assistantTranscript');
  const wrap = el('div', 'mb-3');
  wrap.innerHTML = `<div class="text-xs text-gray-500">${role} @ ${new Date().toLocaleString()}</div>
    <div class="p-2 bg-gray-100 rounded">${text}</div>
    <div class="p-2 rounded mt-1" data-reply style="background: linear-gradient(90deg, #F3E8FF, #DBEAFE);"><span class="font-semibold">Assistant:</span> <span data-txt></span></div>`;
  t.prepend(wrap);
  return { container: wrap, replyEl: wrap.querySelector('[data-txt]') };
}

let assistantStreaming = false;
async function handleAssistantSend(msg, role) {
  if (assistantStreaming) return;
  assistantStreaming = true;
  const sendBtn = document.getElementById('assistantSend');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.setAttribute('aria-busy','true'); sendBtn.textContent = 'Sending…'; }
  const { replyEl } = appendTranscriptBubble(role, msg);
  const reply = mockAssistant(msg, role);
  let acc = '';
  await streamReply(reply, (tok)=>{ acc += tok; replyEl.textContent = acc; }, 35);
  await db.put({ _id: `log:${Date.now()}`, type: 'conversation', role, text: msg, reply, at: now() });
  assistantStreaming = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.removeAttribute('aria-busy'); sendBtn.textContent = 'Send'; }
}

$('#assistantSend')?.addEventListener('click', async () => {
  const inputEl = $('#assistantInput');
  const input = inputEl.value.trim();
  const role = $('#assistantRole').value;
  if (!input || assistantStreaming) return;
  inputEl.value = '';
  handleAssistantSend(input, role);
});

$('#assistantQuick')?.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-intent]');
  if (!btn) return;
  if (assistantStreaming) return;
  const intent = btn.getAttribute('data-intent');
  const map = { pain: 'I feel pain', cold: 'I am cold', water: 'I need water', dizzy: 'I feel dizzy' };
  const text = map[intent] || 'Hello';
  const role = $('#assistantRole')?.value || 'resident';
  handleAssistantSend(text, role);
});

// Enter to send, Shift+Enter for newline
$('#assistantInput')?.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (assistantStreaming) return;
    const inputEl = e.currentTarget;
    const text = inputEl.value.trim();
    const role = $('#assistantRole')?.value || 'resident';
    if (!text) return;
    inputEl.value = '';
    handleAssistantSend(text, role);
  }
});

$('#assistantClear')?.addEventListener('click', async ()=>{
  if (!confirm('Clear transcript?')) return;
  const t = $('#assistantTranscript'); t.innerHTML = '';
  try {
    if (db.find) {
      const res = await db.find({ selector: { type: 'conversation' } });
      for (const r of res.docs) { await db.remove(r); }
    } else {
      const all = await db.allDocs({ include_docs: true });
      for (const row of all.rows) { const d = row.doc; if (d?.type === 'conversation') { await db.remove(d); } }
    }
  } catch(e) { console.warn('Failed to clear stored transcript', e); }
  toast('Transcript cleared', { type: 'success' });
});

// --- Repositioning Guidance (rule-based demo) ---
$('#repositioningForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const resident = $('#rpResident').value.trim();
  const weight = Number($('#rpWeight').value || 0);
  const mobility = $('#rpMobility').value;
  const pain = $('#rpPain').value.split(',').map(s=>s.trim()).filter(Boolean);

  let technique = 'Two-person log roll with knee support';
  if (weight < 60 && mobility === 'high') technique = 'Single caregiver assist with slide sheet';
  if (weight > 100 || mobility === 'low') technique = 'Use mechanical lift; avoid twisting; neutral spine.';

  const guidance = {
    technique,
    steps: [
      'Prepare area, lock bed brakes, adjust height to hips level',
      'Use slide sheet; keep back neutral; bend at knees',
      `Address pain points: ${pain.join(', ') || 'none reported'}`,
    ],
  };

  await db.put({ _id: `repo:${Date.now()}`, type: 'reposition', resident, params: { weight, mobility, pain }, guidance, at: now() });
  $('#rpOutput').innerHTML = `<div class="bg-white border rounded p-3 shadow-soft">
    <div class="font-semibold">Guidance</div>
    <div class="text-sm">Technique: ${guidance.technique}</div>
    <ul class="list-disc ml-5 text-sm mt-2">${guidance.steps.map(s=>`<li>${s}</li>`).join('')}</ul>
  </div>`;
});

// --- Repositioning schedule (per-resident) ---
async function rpFetchAll() {
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
  const residents = docs.filter(d=>d.type==='resident');
  const prefs = docs.filter(d=>d.type==='reposition_pref');
  const events = docs.filter(d=>d.type==='reposition');
  return { residents, prefs, events };
}

function rpLatestEventFor(events, residentId) {
  const ev = events.filter(e=>String(e.resident||'')===residentId).sort((a,b)=>new Date(b.at)-new Date(a.at))[0];
  return ev || null;
}

function minutesBetween(aIso, bIso) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.round((b-a)/60000);
}

// --- Data helpers (Phase 2) ---
async function getResidents() {
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
  return docs.filter(d=>d.type==='resident');
}

async function getRepositionPrefByResident(residentId) {
  try {
    if (db.find) {
      const res = await db.find({ selector: { type: 'reposition_pref', resident_id: residentId } });
      return res.docs[0] || null;
    }
  } catch {}
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
  return docs.find(d=>d.type==='reposition_pref' && d.resident_id===residentId) || null;
}

async function getLatestRepositionByResident(residentId) {
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
  const ev = docs.filter(d=>d.type==='reposition' && d.resident===residentId)
                 .sort((a,b)=>new Date(b.at)-new Date(a.at))[0];
  return ev || null;
}

async function logRepositionComplete(residentId, guidance={ technique: 'Logged completion' }) {
  const id = `repo:${residentId}:${Date.now()}`;
  await db.put({ _id: id, type: 'reposition', resident: residentId, params: {}, guidance, at: now() });
  return id;
}

function getResidentByIdSyncCache() {
  // simple memoization to avoid repeated allDocs in quick loops
  let cache = null;
  return async function(id) {
    if (!cache) {
      const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
      cache = docs.filter(d=>d.type==='resident').reduce((m,d)=>{ m[d._id]=d; return m; }, {});
    }
    return cache[id] || null;
  };
}
const getResidentById = getResidentByIdSyncCache();

async function loadRepositioning() {
  const { residents, prefs, events } = await rpFetchAll();
  const sel = document.getElementById('rpResidentSelect');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- Select resident --</option>' + residents.map(r=>`<option value="${r._id}">${r.name}</option>`).join('');
  if (prev) sel.value = prev;

  const residentId = sel.value;
  const intervalInput = document.getElementById('rpInterval');
  const statusBox = document.getElementById('rpStatus');
  const saveBtn = document.getElementById('rpSaveInterval');
  const completeBtn = document.getElementById('rpCompleteNow');

  const currentPref = prefs.find(p=>p.resident_id===residentId);
  if (residentId && currentPref) intervalInput.value = currentPref.interval_mins;
  else intervalInput.value = '';

  function renderStatus() {
    statusBox.innerHTML = '';
    if (!residentId) { statusBox.textContent = 'Select a resident to view schedule status.'; return; }
    const pref = prefs.find(p=>p.resident_id===residentId);
    if (!pref) { statusBox.textContent = 'No interval set. Enter minutes and Save Interval.'; return; }
    const latest = rpLatestEventFor(events, residentId);
    const lastAt = latest?.at || null;
    const nextDueMs = lastAt ? new Date(lastAt).getTime() + pref.interval_mins*60000 : Date.now();
    const dueInMins = Math.round((nextDueMs - Date.now())/60000);
    const overdue = dueInMins < 0;
    const color = overdue ? 'text-red-700' : 'text-green-700';
    const whenTxt = lastAt ? new Date(lastAt).toLocaleString() : 'never';
    const msg = overdue ? `OVERDUE by ${Math.abs(dueInMins)} min` : `Due in ${dueInMins} min`;
    statusBox.innerHTML = `<div class="p-2 rounded ${overdue?'bg-red-50':'bg-green-50'} ${color}">Last completed: <span class="font-medium">${whenTxt}</span> · Interval: <span class="font-medium">${pref.interval_mins} min</span> · <span class="font-semibold">${msg}</span></div>`;
  }

  renderStatus();

  saveBtn.onclick = async () => {
    if (!sel.value) { toast('Select a resident first', { type: 'error' }); return; }
    const mins = Number(intervalInput.value || 0);
    if (!mins || mins <= 0) { toast('Enter a valid interval in minutes', { type: 'error' }); return; }
    // upsert pref
    try {
      const existing = await db.find ? (await db.find({ selector: { type:'reposition_pref', resident_id: sel.value }})).docs[0] : null;
      if (existing) await db.put({ ...existing, interval_mins: mins });
      else await db.put({ _id: `rpref:${sel.value}`, type: 'reposition_pref', resident_id: sel.value, interval_mins: mins, updated_at: now() });
    } catch {
      // fallback naive upsert
      await db.put({ _id: `rpref:${sel.value}`, type: 'reposition_pref', resident_id: sel.value, interval_mins: mins, updated_at: now() });
    }
    loadRepositioning();
    loadAnalytics();
    toast('Repositioning interval saved', { type: 'success' });
  };

  completeBtn.onclick = async () => {
    if (!sel.value) { toast('Select a resident first', { type: 'error' }); return; }
    await db.put({ _id: `repo:${sel.value}:${Date.now()}`, type: 'reposition', resident: sel.value, params: {}, guidance: { technique: 'Logged completion' }, at: now() });
    loadRepositioning();
    loadAnalytics();
    toast('Reposition completion logged', { type: 'success' });
  };

  sel.onchange = () => loadRepositioning();
}

// --- Meals & Feedback ---
function getSelectedResidentId() { return $('#mealResidentSelect')?.value || ''; }
async function populateResidentSelect() {
  const residents = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc).filter(d=>d.type==='resident');
  const sel = $('#mealResidentSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select resident --</option>' + residents.map(r=>`<option value="${r._id}">${r.name}</option>`).join('');
  if (current) sel.value = current;
}

// --- Analytics helpers ---
function svgSparkline(points = [], { width = 80, height = 20, stroke = '#0ea5e9' } = {}) {
  if (!points.length) return '';
  const max = Math.max(1, ...points);
  const stepX = width / Math.max(1, points.length - 1);
  const coords = points.map((v, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(height - (v / max) * height);
    return `${x},${y}`;
  }).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline fill="none" stroke="${stroke}" stroke-width="2" points="${coords}"/></svg>`;
}

function populateAnalyticsControlsOptions(residents) {
  const sel = document.getElementById('analyticsResidentFilter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">All residents</option>' + residents.map(r=>`<option value="${r._id}">${r.name}</option>`).join('');
  if (prev) sel.value = prev;
}

// --- Care Plans ---
async function loadCarePlans() {
  // populate resident select
  const list = document.getElementById('carePlanList');
  const summary = document.getElementById('cpSummary');
  list.innerHTML = '';
  // filter by selected resident
  const sel = document.getElementById('cpResidentSelect');
  const rid = sel?.value || '';
  const filtered = rid ? items.filter(i=>i.resident_id===rid) : items;
  // summary with due soon/overdue counts
  let dueSoon = 0, overdue = 0;
  for (const cp of filtered) {
    const info = carePlanDueInfo(cp);
    if (info.overdue) overdue++;
    else if (info.badgeHtml) dueSoon++;
  }
  const extra = (dueSoon || overdue) ? ` · Due soon: ${dueSoon} · Overdue: ${overdue}` : '';
  if (rid) {
    const r = residents.find(x=>x._id===rid);
    summary.textContent = r ? `Showing ${filtered.length} item(s) for ${r.name}${extra}` : '';
  } else {
    summary.textContent = `Showing ${filtered.length} item(s)${extra}`;
  }

  for (const cp of filtered) {
    const dueInfo = carePlanDueInfo(cp);
    const row = el('div', 'bg-white border rounded p-3 shadow-soft');
    row.innerHTML = `<div class="flex items-start justify-between">
        <div>
          <div class="font-medium">${cp.title} ${dueInfo.badgeHtml}</div>
          <div class="text-xs text-gray-600">Freq: ${cp.frequency || '-'} · Last: ${cp.last_completed_at ? new Date(cp.last_completed_at).toLocaleString() : 'never'}</div>
        </div>
        <div class="flex gap-2">
          <button class="px-2 py-1 border rounded text-xs" data-act="notes" style="border-color:#6B7280">View Notes</button>
          <button class="px-2 py-1 border rounded text-xs" data-act="done" style="border-color:#1D4ED8">Complete Now</button>
        </div>
      </div>
      <div class="mt-2 hidden" data-notes></div>`;
    // actions
    row.querySelector('[data-act="done"]').addEventListener('click', async ()=>{
      const latest = await db.get(cp._id);
      const note = prompt('Completion note (optional)?') || '';
      const ts = now();
      await db.put({ _id: `cp_event:${cp._id}:${Date.now()}`, type: 'care_plan_event', care_plan_id: cp._id, resident_id: cp.resident_id, note, at: ts });
      await db.put({ ...latest, last_completed_at: ts });
      loadCarePlans();
      loadAnalytics();
    });
    row.querySelector('[data-act="notes"]').addEventListener('click', async ()=>{
      const target = row.querySelector('[data-notes]');
      if (!target) return;
      if (!target.classList.contains('hidden')) { target.classList.add('hidden'); return; }
      const docs2 = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
      const events = docs2.filter(d=>d.type==='care_plan_event' && d.care_plan_id===cp._id)
                          .sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,10);
      if (!events.length) { target.innerHTML = '<div class="text-xs text-slate-600">No notes yet.</div>'; }
      else {
        target.innerHTML = `<div class="border-t pt-2">
          <div class="text-xs font-medium text-slate-700 mb-1">Recent Notes</div>
          <ul class="text-xs text-slate-700 list-disc ml-5">${events.map(e=>`<li>${new Date(e.at).toLocaleString()}: ${e.note?e.note:'(no note)'}</li>`).join('')}</ul>
        </div>`;
      }
      target.classList.remove('hidden');
    });
    list.appendChild(row);
  }
}

document.getElementById('cpResidentSelect')?.addEventListener('change', loadCarePlans);

// ... (rest of the code remains the same)

// --- Analytics (simple) ---
async function loadAnalytics() {
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
  const meals = docs.filter(d=>d.type==='meal');
  const residents = docs.filter(d=>d.type==='resident');
  const feedbacks = docs.filter(d=>d.type==='meal_feedback');
  const convs = docs.filter(d=>d.type==='conversation');
  const repos = docs.filter(d=>d.type==='reposition');
  const rprefs = docs.filter(d=>d.type==='reposition_pref');
  const cps = docs.filter(d=>d.type==='care_plan');
  const taskEvents = docs.filter(d=>d.type==='task_event');
  const tasks = docs.filter(d=>d.type==='task');

  const avgRating = feedbacks.length ? (feedbacks.reduce((s,f)=>s+Number(f.rating||0),0)/feedbacks.length).toFixed(1) : '—';
  const pos = feedbacks.filter(f=>f.ai_analysis==='positive').length;
  const neg = feedbacks.filter(f=>f.ai_analysis==='negative').length;
  const neu = feedbacks.filter(f=>f.ai_analysis==='neutral').length;
  const posPct = feedbacks.length ? Math.round((pos/feedbacks.length)*100)+'%' : '—';
  const negPct = feedbacks.length ? Math.round((neg/feedbacks.length)*100)+'%' : '—';

  // Potential allergy alerts seen in feedbacks (meal allergens intersect resident allergies)
  let allergyHits = 0;
  for (const fb of feedbacks) {
    const meal = meals.find(m=>m._id===fb.meal_id);
    const resident = residents.find(r=>r._id===fb.resident_id);
    if (!meal || !resident) continue;
    const allergies = new Set((resident.allergies||[]).map(a=>String(a).toLowerCase()));
    const mealAllergens = (meal.allergens||[]).map(a=>String(a).toLowerCase());
    if (mealAllergens.some(a=>allergies.has(a))) allergyHits++;
  }

  const cards = [
    { title: 'Residents', value: residents.length },
    { title: 'Open Tasks', value: tasks.filter(t=>t.status!=='done').length },
    { title: 'Avg Meal Rating', value: avgRating },
    { title: 'Positive Feedback', value: `${pos} (${posPct})` },
    { title: 'Negative Feedback', value: `${neg} (${negPct})` },
    { title: 'Allergy Alerts (potential)', value: allergyHits },
    { title: 'Conversations Logged', value: convs.length },
    { title: 'Reposition Events', value: repos.length },
    { title: 'Meals', value: meals.length },
  ];

  // Compute Reposition Due Now
  try {
    let dueNow = 0, tracked = 0;
    const byResident = Object.fromEntries(residents.map(r=>[r._id, { pref: null, latest: null }]));
    for (const p of rprefs) { if (byResident[p.resident_id]) byResident[p.resident_id].pref = p; }
    for (const rid of Object.keys(byResident)) {
      const pref = byResident[rid].pref;
      if (!pref) continue;
      tracked++;
      const latest = repos.filter(e=>String(e.resident||'')===rid).sort((a,b)=>new Date(b.at)-new Date(a.at))[0];
      const lastAt = latest?.at || null;
      const nextDue = lastAt ? new Date(lastAt).getTime() + pref.interval_mins*60000 : Date.now();
      if (Date.now() >= nextDue) dueNow++;
    }
    const pct = tracked ? Math.round((dueNow/tracked)*100) + '%' : '—';
    cards.push({ title: 'Reposition Due Now', value: `${dueNow}/${tracked} (${pct})` });
  } catch {}

  // Reposition adherence (last 24h)
  let adherenceOverall = '—';
  let adherenceList = [];
  try {
    const windowEnd = Date.now();
    const windowStart = windowEnd - 24*60*60*1000;
    const byResident = Object.fromEntries(residents.map(r=>[r._id, { name: r.name, pref: null, events: [] }]));
    for (const p of rprefs) { if (byResident[p.resident_id]) byResident[p.resident_id].pref = p; }
    for (const ev of repos) {
      const rid = String(ev.resident||'');
      const t = new Date(ev.at||ev.created_at||ev.updated_at||ev._id?.split(':').pop()).getTime();
      if (!byResident[rid]) continue;
      if (t >= windowStart && t <= windowEnd) byResident[rid].events.push(t);
    }
    const rows = [];
    for (const rid of Object.keys(byResident)) {
      const row = byResident[rid];
      if (!row.pref) continue;
      const interval = Number(row.pref.interval_mins||0); if (!interval) continue;
      const exp = Math.max(1, Math.ceil((windowEnd - windowStart) / (interval*60000)));
      const evs = row.events.sort((a,b)=>a-b);
      const done = evs.length;
      let ontime = 0;
      for (let i=1;i<evs.length;i++) {
        const deltaMin = Math.round((evs[i]-evs[i-1])/60000);
        if (deltaMin <= interval + 5) ontime++;
      }
      const adherence = Math.min(1, done/exp);
      const ontimePct = evs.length>1 ? (Math.round((ontime/(evs.length-1))*100)) : 100;
      rows.push({ rid, name: row.name, adherence, ontimePct });
    }
    rows.sort((a,b)=>a.adherence-b.adherence);
    adherenceList = rows;
    if (rows.length) {
      const avg = rows.reduce((s,r)=>s + r.adherence, 0) / rows.length;
      adherenceOverall = Math.round(avg*100) + '%';
      cards.push({ title: 'Avg Reposition Adherence (24h)', value: adherenceOverall });
    } else {
      cards.push({ title: 'Avg Reposition Adherence (24h)', value: '—' });
    }
  } catch {}

  // Care Plans completed today
  try {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const start = new Date(y, m, d).getTime();
    const end = new Date(y, m, d+1).getTime();
    const completedToday = cps.filter(cp => cp.last_completed_at && (()=>{ const t = new Date(cp.last_completed_at).getTime(); return t>=start && t<end;})()).length;
    cards.push({ title: 'Care Plans Completed Today', value: `${completedToday}/${cps.length || 0}` });
    const adherencePct = (cps.length ? Math.round((completedToday / cps.length) * 100) + '%' : '—');
    cards.push({ title: 'Care Plan Adherence Today', value: adherencePct });
  } catch {}

  // Task Nudges Today
  try {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const start = new Date(y, m, d).getTime();
    const end = new Date(y, m, d+1).getTime();
    const nudgesToday = taskEvents.filter(e => e.action==='nudge' && (()=>{ const t = new Date(e.at).getTime(); return t>=start && t<end;})()).length;
    cards.push({ title: 'Task Nudges Today', value: String(nudgesToday) });
  } catch {}

  const container = $('#analyticsCards');
  container.innerHTML = '';
  for (const c of cards) {
    const card = el('div', 'bg-white border rounded p-4 shadow-soft');
    card.innerHTML = `<div class="text-sm text-gray-500">${c.title}</div>
      <div class="text-2xl font-bold">${c.value}</div>`;
    container.appendChild(card);
  }
  // Controls: populate resident filter
  try { populateAnalyticsControlsOptions(residents); } catch {}

  // Wire controls once per render (override handlers)
  const resSel = document.getElementById('analyticsResidentFilter');
  const toggleBtn = document.getElementById('analyticsToggleFull');
  const resetBtn = document.getElementById('analyticsReset');
  const exportBtn = document.getElementById('analyticsExportCsv');
  const live = document.getElementById('analyticsLive');
  const fullPref = (()=>{ try { return localStorage.getItem('analytics_full_table') === '1'; } catch { return false; } })();
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', fullPref ? 'true' : 'false');
    toggleBtn.textContent = fullPref ? 'View top 5' : 'View full table';
    toggleBtn.onclick = () => {
      const curr = toggleBtn.getAttribute('aria-pressed') === 'true';
      const next = !curr;
      toggleBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      toggleBtn.textContent = next ? 'View top 5' : 'View full table';
      try { localStorage.setItem('analytics_full_table', next ? '1' : '0'); } catch {}
      loadAnalytics();
      // focus management: move focus to table caption when rerendered
      setTimeout(()=>{ document.getElementById('analyticsTableCaption')?.focus(); }, 0);
    };
  }
  if (resSel) {
    resSel.onchange = () => { loadAnalytics(); setTimeout(()=>{ document.getElementById('analyticsTableCaption')?.focus(); }, 0); };
  }
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (resSel) resSel.value = '';
      if (toggleBtn) { toggleBtn.setAttribute('aria-pressed','false'); toggleBtn.textContent = 'View full table'; }
      try { localStorage.setItem('analytics_full_table','0'); } catch {}
      loadAnalytics();
      if (live) live.textContent = 'Filters reset. Showing top 5 for all residents';
      setTimeout(()=>{ document.getElementById('analyticsTableCaption')?.focus(); }, 0);
    };
  }

  // Apply resident filter
  let list = adherenceList || [];
  const ridFilter = resSel?.value || '';
  if (ridFilter) list = list.filter(r => r.rid === ridFilter);
  const showFull = toggleBtn?.getAttribute('aria-pressed') === 'true';

  // Build trends per resident (24h bins by hour)
  const trendsByRid = {};
  try {
    const end = Date.now();
    const start = end - 24*60*60*1000;
    const hours = Array.from({length: 24}, (_,i)=> start + i*60*60*1000);
    const byRidTimes = {};
    for (const ev of repos) {
      const rid = String(ev.resident||'');
      const t = new Date(ev.at||ev.created_at||ev.updated_at||0).getTime();
      if (t >= start && t <= end) {
        (byRidTimes[rid] ||= []).push(t);
      }
    }
    for (const [rid, arr] of Object.entries(byRidTimes)) {
      const counts = new Array(24).fill(0);
      for (const t of arr) {
        const idx = Math.min(23, Math.max(0, Math.floor((t - start) / (60*60*1000))));
        counts[idx] += 1;
      }
      trendsByRid[rid] = counts;
    }
  } catch {}

  // Detailed adherence table
  if (list && list.length) {
    const view = showFull ? list : list.slice(0, 5);
    const block = el('div', 'bg-white border rounded p-4 shadow-soft md:col-span-3');
    const totalTxt = `${list.length} resident${list.length===1?'':'s'}`;
    const caption = `Reposition Adherence — Last 24h (${showFull ? 'Full list' : 'Top risk'}) — ${totalTxt}`;
    const tableHtml = `<div class="text-sm text-gray-600 mb-2">${caption}</div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm" role="table" aria-describedby="analyticsTableCaption">
          <caption id="analyticsTableCaption" tabindex="-1" class="sr-only">${caption}</caption>
          <thead>
            <tr class="text-left text-gray-500">
              <th scope="col" class="py-1 pr-4">Resident</th>
              <th scope="col" class="py-1 pr-4">Adherence</th>
              <th scope="col" class="py-1 pr-4">On-time %</th>
              <th scope="col" class="py-1">Trend (24h)</th>
            </tr>
          </thead>
          <tbody>
            ${view.map(r=>{
              const trend = trendsByRid[r.rid] || [];
              return `<tr>
                <td class="py-1 pr-4">${r.name}</td>
                <td class="py-1 pr-4">${Math.round(r.adherence*100)}%</td>
                <td class="py-1 pr-4">${r.ontimePct}%</td>
                <td class="py-1">${svgSparkline(trend)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    block.innerHTML = tableHtml;
    container.appendChild(block);
    if (live) live.textContent = `${showFull ? 'Showing full list' : 'Showing top 5'} • ${totalTxt}`;
    if (exportBtn) {
      exportBtn.onclick = () => {
        // Build header: summary cols + Hour00..Hour23 raw counts
        const hourCols = Array.from({length:24}, (_,i)=>`Hour${String(i).padStart(2,'0')}`);
        const header = ['Resident','Adherence','OnTimePct', ...hourCols];
        const escape = v => '"' + String(v??'').replace(/"/g,'""') + '"';
        const lines = [header.join(',')];
        for (const r of view) {
          const counts = (trendsByRid[r.rid] || new Array(24).fill(0)).slice(0,24);
          const row = [
            escape(r.name),
            escape(Math.round(r.adherence*100)+'%'),
            escape(r.ontimePct+'%'),
            ...counts.map(n=>String(n))
          ];
          lines.push(row.join(','));
        }
        const csv = lines.join('\n');
        const stamp = new Date().toISOString().replace(/[:.]/g,'-');
        download(`adherence-${showFull?'full':'top5'}-with-hours-${stamp}.csv`, csv);
      };
    }
  } else {
    if (live) live.textContent = 'No adherence data to display';
    if (exportBtn) exportBtn.onclick = () => alert('No data to export');
  }
}

// ... (rest of the code remains the same)

// --- Tasks ---
async function loadTasks() {
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc).filter(d=>d.type==='task');
  const assigneeFilter = (document.getElementById('taskAssigneeFilter')?.value || '').trim().toLowerCase();
  const shiftFilter = (document.getElementById('taskShiftFilter')?.value || '').trim().toLowerCase();
  let items = docs;
  if (assigneeFilter) items = items.filter(t => String(t.assignee||'').toLowerCase().includes(assigneeFilter));
  if (shiftFilter) items = items.filter(t => String(t.shift||'').toLowerCase() === shiftFilter);
  const list = $('#taskList');
  list.innerHTML = '';
  for (const t of items) {
    const overdue = t.due_at ? (new Date(t.due_at).getTime() < Date.now() && t.status !== 'done') : false;
    const dueStr = t.due_at ? new Date(t.due_at).toLocaleString() : '-';
    const overdueBadge = overdue ? '<span class="badge badge-red ml-2">Overdue</span>' : '';
    const row = el('div', 'bg-white border rounded p-3 flex items-center justify-between shadow-soft');
    row.innerHTML = `<div>
        <div class="font-medium">${t.title} ${overdueBadge}</div>
        <div class="text-xs text-gray-600">Status: ${t.status} · Assignee: ${t.assignee || '-'} · Shift: ${t.shift || '-'} · Due: ${dueStr}</div>
      </div>
      <div class="flex gap-2">
        <button class="px-2 py-1 border rounded text-xs" data-act="start" style="border-color:#6B21A8">Start</button>
        <button class="px-2 py-1 border rounded text-xs" data-act="nudge" style="border-color:#F59E0B">Nudge</button>
        <button class="px-2 py-1 border rounded text-xs" data-act="done" style="border-color:#1D4ED8">Done</button>
      </div>`;
    row.querySelector('[data-act="start"]').addEventListener('click', async ()=>{ await db.put({ ...t, _id: t._id, _rev: t._rev, status: 'in_progress' }); loadTasks(); });
    row.querySelector('[data-act="nudge"]').addEventListener('click', async ()=>{ await db.put({ _id: `task_event:${t._id}:${Date.now()}`, type: 'task_event', task_id: t._id, action: 'nudge', at: now() }); alert('Nudge sent'); loadAnalytics(); });
    row.querySelector('[data-act="done"]').addEventListener('click', async ()=>{ await db.put({ ...t, _id: t._id, _rev: t._rev, status: 'done' }); loadTasks(); });
    list.appendChild(row);

  }
}

const DIAG_AI = `sequenceDiagram\n  participant U as Device\n  participant GW as Kong\n  participant KC as Keycloak\n  participant AI as AI Service\n  participant ASR as Vosk\n  participant NLU as NLU\n  participant TR as Translate\n  participant API as API\n  U->>GW: HTTPS + Token\n  GW->>KC: Introspect\n  KC-->>GW: OK\n  alt Voice\n    U->>AI: Audio ref\n    AI->>ASR: Transcribe\n  else Text\n    U->>AI: Text\n  end\n  AI->>NLU: Intent\n  NLU-->>AI: Entities\n  AI->>API: Log\n  AI-->>U: Response\n`;

function renderDiagrams() {
  const arch = $('#diagram-arch');
  const erd = $('#diagram-erd');
  const ai = $('#diagram-ai');
  arch.textContent = DIAG_ARCH;
  erd.textContent = DIAG_ERD;
  ai.textContent = DIAG_AI;
  mermaid.run({ nodes: [arch, erd, ai] });
}

// --- Settings ---
$('#saveSettings')?.addEventListener('click', async () => {
  const tenantId = $('#tenantId').value || 'tenant-demo';
  const facility = $('#facilityName').value || 'Main Facility';
  try {
    const s = await db.get('settings');
    await db.put({ ...s, tenantId, facility });
  } catch {
    await db.put({ _id: 'settings', type: 'settings', tenantId, facility });
  }
  alert('Saved');
});

// --- Init ---
(async function init() {
  try {
    // enable pouchdb-find if available (loaded via plugin) — optional
    if (db.createIndex) {
      await db.createIndex({ index: { fields: ['type'] } });
    }
    await seed();
  } catch (e) {
    console.error('Init error', e);
  }
  // Mobile mode detection and boot
  const isMobileMode = getMobileModeFlag();
  if (isMobileMode) {
    enableMobileShell(true);
    renderMobileTabs();
  } else {
    renderTabs();
  }
  // Listen for SW messages (e.g., notification click routing)
  try {
    navigator.serviceWorker?.addEventListener('message', (evt)=>{
      if (evt?.data?.type === 'open-rounds') {
        document.querySelector('.mobile-tab-btn[data-mtab="rounds"]')?.click();
      }
    });
  } catch {}
  document.getElementById('year').textContent = new Date().getFullYear();
})();

// --- Mobile Mode (Caregiver shell) ---
function getMobileModeFlag() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('m');
    if (q === '1') { try { localStorage.setItem('mMode', '1'); } catch {} return true; }
    if (q === '0') { try { localStorage.setItem('mMode', '0'); } catch {} return false; }
    const stored = (()=>{ try { return localStorage.getItem('mMode'); } catch { return null; } })();
    return stored === '1';
  } catch {
    return false;
  }
}

function setMobileModeFlag(active) {
  try { localStorage.setItem('mMode', active ? '1' : '0'); } catch {}
  try {
    const url = new URL(window.location.href);
    if (active) url.searchParams.set('m', '1'); else url.searchParams.delete('m');
    window.history.replaceState({}, '', url.toString());
  } catch {}
}

function enableMobileShell(active) {
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const footer = document.querySelector('footer');
  const mobile = document.getElementById('mobileShell');
  const desktopNav = document.getElementById('desktopNav');
  if (!mobile) return;
  if (active) {
    header && header.classList.add('hidden');
    main && main.classList.add('hidden');
    footer && footer.classList.add('hidden');
    desktopNav && desktopNav.setAttribute('aria-hidden', 'true');
    mobile.classList.remove('hidden');
    mobile.removeAttribute('aria-hidden');
  } else {
    header && header.classList.remove('hidden');
    main && main.classList.remove('hidden');
    footer && footer.classList.remove('hidden');
    desktopNav && desktopNav.removeAttribute('aria-hidden');
    mobile.classList.add('hidden');
    mobile.setAttribute('aria-hidden', 'true');
  }
}

function renderMobileTabs() {
  setMobileModeFlag(true);
  enableMobileShell(true);
  const btns = Array.from(document.querySelectorAll('.mobile-tab-btn'));
  const views = {
    rounds: document.getElementById('mview-rounds'),
    scan: document.getElementById('mview-scan'),
    guidance: document.getElementById('mview-guidance'),
    settings: document.getElementById('mview-settings'),
  };
  let mobileRoundsTimerId = null;
  let mobileNotifyTimerId = null;

  function activate(id) {
    Object.values(views).forEach(v => v && v.classList.add('hidden'));
    const target = views[id] || views.rounds;
    if (target) target.classList.remove('hidden');
    btns.forEach(b => b.removeAttribute('aria-current'));
    const activeBtn = btns.find(b => b.getAttribute('data-mtab') === id);
    if (activeBtn) activeBtn.setAttribute('aria-current', 'page');
    // Lazy load per-view
    if (mobileRoundsTimerId) { clearInterval(mobileRoundsTimerId); mobileRoundsTimerId = null; }
    if (mobileNotifyTimerId) { clearInterval(mobileNotifyTimerId); mobileNotifyTimerId = null; }
    if (id === 'rounds') {
      loadMobileRounds();
      mobileRoundsTimerId = setInterval(() => {
        // re-render timers every minute
        loadMobileRounds({ skipFilterInit: true });
      }, 60_000);
    }
    // Start foreground notification ticker in mobile mode regardless of active view
    mobileDueNotificationTick();
    mobileNotifyTimerId = setInterval(mobileDueNotificationTick, 60_000);
    if (id === 'scan') loadMobileScan();
    if (id === 'guidance') loadMobileGuidance();
    if (id === 'settings') loadMobileSettings();
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-mtab');
      activate(id);
    });
  });

  // Default view
  activate('rounds');
}

// --- Mobile view loaders (stubs for PR1) ---
async function loadMobileRounds(opts={}) {
  const list = document.getElementById('mRoundsList');
  const filterSel = document.getElementById('mRoundsResidentFilter');
  if (!list || !filterSel) return;
  list.innerHTML = '<div class="text-sm text-slate-600">Loading rounds…</div>';
  try {
    const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
    const residents = docs.filter(d=>d.type==='resident');
    const prefs = docs.filter(d=>d.type==='reposition_pref');
    const events = docs.filter(d=>d.type==='reposition');

    // Populate filter once (unless told to skip)
    if (!opts.skipFilterInit && filterSel.children.length <= 1) {
      const options = ['<option value="">All residents</option>'].concat(
        residents.map(r=>`<option value="${r._id}">${r.name}</option>`)
      );
      filterSel.innerHTML = options.join('');
      filterSel.addEventListener('change', () => loadMobileRounds({ skipFilterInit: true }));
    }

    const selected = filterSel.value;
    const items = [];
    for (const r of residents) {
      if (selected && r._id !== selected) continue;
      const pref = prefs.find(p=>p.resident_id===r._id);
      if (!pref) continue;
      const latest = events.filter(e=>e.resident===r._id).sort((a,b)=>new Date(b.at)-new Date(a.at))[0];
      const lastAt = latest?.at || null;
      const nextDueMs = lastAt ? new Date(lastAt).getTime() + pref.interval_mins*60000 : Date.now();
      const diffMin = Math.round((nextDueMs - Date.now())/60000);
      const overdue = diffMin < 0;
      const badge = overdue ? '<span class="badge badge-red">OVERDUE</span>' : '<span class="badge badge-green">Scheduled</span>';
      const whenTxt = lastAt ? new Date(lastAt).toLocaleTimeString() : 'never';
      items.push({ r, pref, overdue, diffMin, whenTxt });
    }

    // Sort: overdue first, then most overdue at top
    items.sort((a,b)=>{
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.diffMin - b.diffMin; // smaller (more overdue) first
    });

    list.innerHTML = items.map(({ r, pref, overdue, diffMin, whenTxt })=>`
      <div class="bg-white border rounded p-3 shadow-soft flex items-center justify-between">
        <div>
          <div class="font-medium">${r.name} ${overdue?'<span class=\'text-red-700 text-xs ml-1\'>(overdue)</span>':''}</div>
          <div class="text-xs text-slate-600">Mobility: ${r.mobility||'-'} · Last: ${whenTxt} · Every ${pref.interval_mins} min · ${overdue?`OVERDUE by ${Math.abs(diffMin)} min`:`Due in ${diffMin} min`}</div>
        </div>
        <div class="flex gap-2">
          <button class="px-2 py-1 border rounded text-xs" data-rstart="${r._id}">Start</button>
          <button class="px-2 py-1 border rounded text-xs" data-rcomplete="${r._id}">Complete</button>
        </div>
      </div>
    `).join('') || '<div class="text-sm text-slate-600">No residents match the filter.</div>';

    // Wire actions via delegation
    list.querySelectorAll('[data-rstart]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const rid = btn.getAttribute('data-rstart');
        try { localStorage.setItem('mGuideResident', rid); } catch {}
        document.querySelector('.mobile-tab-btn[data-mtab="guidance"]').click();
      });
    });
    list.querySelectorAll('[data-rcomplete]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const rid = btn.getAttribute('data-rcomplete');
        await logRepositionComplete(rid, { technique: 'Mobile quick complete' });
        toast('Reposition logged', { type: 'success' });
        loadMobileRounds({ skipFilterInit: true });
      });
    });
  } catch (e) {
    list.innerHTML = '<div class="text-sm text-red-700">Failed to load rounds.</div>';
  }
}

async function loadMobileScan() {
  const list = document.getElementById('mScanList');
  const input = document.getElementById('mScanSearch');
  const qrBtn = document.getElementById('mScanQr');
  if (!list || !input) return;
  const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
  const allResidents = docs.filter(d=>d.type==='resident').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

  function render(filter=''){
    const f = filter.trim().toLowerCase();
    list.innerHTML = '';
    const rows = (f ? allResidents.filter(r=>String(r.name||'').toLowerCase().includes(f)) : allResidents);
    for (const r of rows) {
      const row = el('button', 'w-full text-left bg-white border rounded p-3 shadow-soft');
      row.textContent = r.name + (r.mobility ? ` — ${r.mobility}` : '');
      row.addEventListener('click', () => {
        try { localStorage.setItem('mGuideResident', r._id); } catch {}
        document.querySelector('.mobile-tab-btn[data-mtab="guidance"]').click();
      });
      list.appendChild(row);
    }
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-sm text-slate-600';
      empty.textContent = 'No residents match your search.';
      list.appendChild(empty);
    }
  }

  function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }
  const onInput = debounce(()=> render(input.value), 200);
  input.removeEventListener?.('input', onInput); // guard in case of re-entry
  input.addEventListener('input', onInput);
  qrBtn?.addEventListener('click', ()=> toast('QR scanning will arrive in Phase 3', { type: 'info' }));
  render('');
}

// --- Guided Reposition Flow ---
const GUIDE_STEPS = [
  { id: 'prep', title: 'Preparation', text: 'Prepare area and confirm safety.', checks: [
    { id: 'brakes', label: 'Bed or chair brakes locked' },
    { id: 'height', label: 'Bed height at caregiver hip level' },
    { id: 'clear', label: 'Environment clear of obstacles' },
  ]},
  { id: 'body_mech', title: 'Body Mechanics', text: 'Use neutral spine and bend at knees.', checks: [
    { id: 'slide', label: 'Slide sheet or draw sheet in place' },
    { id: 'neutral', label: 'Back neutral; avoid twisting' },
  ]},
  { id: 'complete', title: 'Completion', text: 'Confirm comfort and document.', checks: [
    { id: 'comfort', label: 'Resident comfortable and supported' },
    { id: 'pain', label: 'Any pain reported is addressed' },
  ]},
];

function getGuideState() {
  try { return JSON.parse(localStorage.getItem('mGuideState')||'null') || {}; } catch { return {}; }
}
function setGuideState(state) {
  try { localStorage.setItem('mGuideState', JSON.stringify(state)); } catch {}
}
function resetGuideState(residentId) {
  const state = { residentId, stepIndex: 0, checks: {} };
  setGuideState(state);
  try { localStorage.setItem('mGuideResident', residentId||''); } catch {}
  return state;
}

async function loadMobileGuidance() {
  const summary = document.getElementById('mGuideResidentSummary');
  const stepsEl = document.getElementById('mGuideSteps');
  const prevBtn = document.getElementById('mGuidePrev');
  const nextBtn = document.getElementById('mGuideNext');
  const completeBtn = document.getElementById('mGuideComplete');

  // Resolve residentId
  let rid = (()=>{ try { return localStorage.getItem('mGuideResident'); } catch { return ''; } })();
  let state = getGuideState();
  if (!state.residentId && rid) state = resetGuideState(rid);
  if (!rid && state.residentId) rid = state.residentId;
  if (!rid) {
    if (summary) summary.textContent = 'No resident selected yet. Use Scan to choose.';
    stepsEl && (stepsEl.innerHTML = '');
    [prevBtn, nextBtn, completeBtn].forEach(b=> b && (b.disabled = true));
    return;
  }

  // Render resident summary
  const r = await getResidentById(rid);
  if (summary) summary.textContent = r ? `${r.name}${r.mobility?` — ${r.mobility}`:''}` : `Resident: ${rid}`;

  // Ensure state format
  if (typeof state.stepIndex !== 'number') state.stepIndex = 0;
  if (!state.checks) state.checks = {};
  state.residentId = rid;
  setGuideState(state);

  function currentStep(){ return GUIDE_STEPS[Math.max(0, Math.min(GUIDE_STEPS.length-1, state.stepIndex))]; }
  function isStepComplete(step){
    const m = state.checks[step.id] || {};
    return (step.checks||[]).every(c=>m[c.id]);
  }
  function renderStep() {
    const step = currentStep();
    stepsEl.innerHTML = '';
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className = 'font-medium'; title.textContent = step.title;
    const txt = document.createElement('div'); txt.className = 'text-sm text-slate-700'; txt.textContent = step.text;
    li.appendChild(title); li.appendChild(txt);

    if (step.checks && step.checks.length) {
      const ul = document.createElement('ul'); ul.className = 'mt-2 space-y-2';
      const checked = state.checks[step.id] || {};
      for (const c of step.checks) {
        const liC = document.createElement('li');
        const label = document.createElement('label'); label.className = 'inline-flex items-center gap-2 text-sm';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!checked[c.id];
        cb.addEventListener('change', ()=>{ state.checks[step.id] = { ...(state.checks[step.id]||{}), [c.id]: cb.checked }; setGuideState(state); syncButtons(); });
        label.appendChild(cb);
        const span = document.createElement('span'); span.textContent = c.label; label.appendChild(span);
        liC.appendChild(label); ul.appendChild(liC);
      }
      li.appendChild(ul);
    }
    stepsEl.appendChild(li);
    syncButtons();
  }

  function syncButtons() {
    const idx = state.stepIndex;
    const last = GUIDE_STEPS.length - 1;
    if (prevBtn) prevBtn.disabled = (idx === 0);
    const step = currentStep();
    const canAdvance = isStepComplete(step) || !(step.checks && step.checks.length);
    if (nextBtn) nextBtn.disabled = (idx >= last) || !canAdvance;
    if (completeBtn) completeBtn.disabled = (idx < last) || !canAdvance;
  }

  prevBtn?.addEventListener('click', ()=>{ state.stepIndex = Math.max(0, state.stepIndex-1); setGuideState(state); renderStep(); });
  nextBtn?.addEventListener('click', ()=>{
    const step = currentStep();
    if (step.checks && step.checks.length && !isStepComplete(step)) { toast('Please complete safety checks', { type: 'warning' }); return; }
    state.stepIndex = Math.min(GUIDE_STEPS.length-1, state.stepIndex+1); setGuideState(state); renderStep();
  });
  completeBtn?.addEventListener('click', async ()=>{
    const step = currentStep();
    if (step.checks && step.checks.length && !isStepComplete(step)) { toast('Please complete safety checks', { type: 'warning' }); return; }
    const payload = { technique: 'Mobile guided', steps: GUIDE_STEPS.map(s=>({ id: s.id, checks: Object.entries(state.checks[s.id]||{}).filter(([,v])=>v).map(([k])=>k) })) };
    await logRepositionComplete(rid, payload);
    toast('Reposition completion logged', { type: 'success' });
    // reset and return to rounds
    resetGuideState(rid);
    document.querySelector('.mobile-tab-btn[data-mtab="rounds"]').click();
  });

  // Initial render
  renderStep();
}

function loadMobileSettings() {
  document.getElementById('mNotifEnable')?.addEventListener('click', async ()=>{
    if (!('Notification' in window)) { toast('Notifications not supported', { type: 'warning' }); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') toast('Notifications enabled', { type: 'success' });
    else toast('Notifications not granted', { type: 'warning' });
  });
}

// --- Foreground notifications ticker (mobile mode) ---
function getNotifyThrottle() {
  try { return JSON.parse(localStorage.getItem('mNotifyThrottle')||'{}'); } catch { return {}; }
}
function setNotifyThrottle(map) {
  try { localStorage.setItem('mNotifyThrottle', JSON.stringify(map)); } catch {}
}
async function mobileDueNotificationTick() {
  try {
    const docs = (await db.allDocs({ include_docs: true })).rows.map(r=>r.doc);
    const residents = docs.filter(d=>d.type==='resident');
    const prefs = docs.filter(d=>d.type==='reposition_pref');
    const events = docs.filter(d=>d.type==='reposition');
    const throttle = getNotifyThrottle();

    const nowMs = Date.now();
    const toNotify = [];
    for (const r of residents) {
      const pref = prefs.find(p=>p.resident_id===r._id);
      if (!pref) continue;
      const latest = events.filter(e=>e.resident===r._id).sort((a,b)=>new Date(b.at)-new Date(a.at))[0];
      const lastAtMs = latest ? new Date(latest.at).getTime() : 0;
      const nextDueMs = (lastAtMs || nowMs) + pref.interval_mins*60000;
      const diffMin = Math.round((nextDueMs - nowMs)/60000);
      const overdue = diffMin < 0;

      // Notify if overdue, or due within 5 minutes
      const status = overdue ? 'overdue' : (diffMin <= 5 ? 'dueSoon' : 'ok');
      if (status === 'ok') continue;
      const key = r._id + ':' + status;
      const lastNote = throttle[key] || 0;
      if (nowMs - lastNote < 15*60*1000) continue; // throttle 15 minutes per resident/status
      throttle[key] = nowMs;
      toNotify.push({ r, status, diffMin });
    }

    if (toNotify.length) setNotifyThrottle(throttle);
    for (const n of toNotify) await showRepoNotification(n);
  } catch (e) {
    // fail silent
  }
}

async function showRepoNotification({ r, status, diffMin }) {
  const title = status === 'overdue' ? `Reposition overdue: ${r.name}` : `Reposition due soon: ${r.name}`;
  const body = status === 'overdue' ? `Overdue by ${Math.abs(diffMin)} min` : `Due in ${diffMin} min`;
  const tag = `repo-${r._id}`;
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.showNotification) {
      try { await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' }); return; } catch {}
    }
  }
  // Fallback to toast
  toast(`${title} — ${body}`, { type: status==='overdue' ? 'error' : 'info' });
}
