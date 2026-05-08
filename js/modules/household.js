// ══════════════════════════════════════
// js/modules/household.js
// Pair codes, memberships, household tab UI, partner view
// ══════════════════════════════════════
import {
  auth, db, PATHS,
  setDoc, getDoc, updateDoc, addDoc, deleteDoc,
  collection, getDocs,
  serverTimestamp, Timestamp,
  arrayUnion, arrayRemove,
} from '../firebase.js';
import { S, sv, getTotalExp } from '../state.js';
import { fmt } from '../utils.js';

let _rcFn = () => {};
export function setRcFn(fn) { _rcFn = fn; }

// ── Pair code generation ──────────────────────────────────
function _genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg   = () => Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

// ── Create household ──────────────────────────────────────
export async function createHousehold() {
  const user = auth.currentUser;
  if (!user) { showAuthModal(); return; }
  const name = (user.displayName || 'My') + "'s Household";
  const ref  = await addDoc(collection(db, 'households'), {
    name, ownerId: user.uid,
    memberUids: [user.uid],
    createdAt: serverTimestamp(), currency: 'INR',
  });
  await setDoc(PATHS.membership(ref.id, user.uid), {
    uid: user.uid,
    name: user.displayName || user.phoneNumber,
    phone: user.phoneNumber || '',
    avatarColor: 'indigo', role: 'owner',
    canSeeTxns: true, canEdit: true,
    sharedTags: ['daily', 'expenses', 'debts'],
    joinedAt: serverTimestamp(),
  });
  // Persist hhId to user doc so other devices pick it up
  await updateDoc(PATHS.user(user.uid), { householdId: ref.id }).catch(() =>
    setDoc(PATHS.user(user.uid), { householdId: ref.id }, { merge: true })
  );
  S.householdId = ref.id;
  sv();
  return ref.id;
}

// ── Generate pair code ────────────────────────────────────
export async function generatePairCode(role = 'partner', sharedTags = ['daily', 'expenses', 'debts']) {
  const user = auth.currentUser;
  if (!user) { showAuthModal(); return; }
  if (!S.householdId) S.householdId = await createHousehold();
  const code    = _genCode();
  const expires = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
  await setDoc(PATHS.pairCode(code), {
    householdId: S.householdId,
    createdBy: user.uid,
    createdByName: user.displayName || user.phoneNumber,
    role, sharedTags,
    expiresAt: expires, used: false,
  });
  // Show in modal
  document.getElementById('pair-code-display').style.display = '';
  document.getElementById('inv-gen-btn').style.display       = 'none';
  document.getElementById('pair-code-val').textContent       = code;
  window._currentPairCode = code;
  return code;
}

// ── Redeem pair code ──────────────────────────────────────
export async function redeemPairCode(rawCode) {
  const user = auth.currentUser;
  if (!user) { showAuthModal(); return; }
  const code = rawCode.trim().toUpperCase();
  const snap = await getDoc(PATHS.pairCode(code));
  if (!snap.exists())                                { _setPairErr('Code not found. Check and try again.'); return; }
  const d = snap.data();
  if (d.used)                                        { _setPairErr('Code already used.'); return; }
  if (d.expiresAt.toMillis() < Date.now())           { _setPairErr('Code expired. Ask for a new one.'); return; }
  if (d.createdBy === user.uid)                      { _setPairErr("That's your own code!"); return; }

  await updateDoc(PATHS.pairCode(code), { used: true, usedBy: user.uid, usedAt: serverTimestamp() });

  await setDoc(PATHS.membership(d.householdId, user.uid), {
    uid: user.uid,
    name: user.displayName || user.phoneNumber,
    phone: user.phoneNumber || '',
    avatarColor: _pickColor(user.uid),
    role: d.role, sharedTags: d.sharedTags,
    canSeeTxns: true, canEdit: d.role !== 'viewer',
    joinedAt: serverTimestamp(),
  });
  await updateDoc(PATHS.household(d.householdId), { memberUids: arrayUnion(user.uid) });
  await updateDoc(PATHS.user(user.uid), { householdId: d.householdId }).catch(() =>
    setDoc(PATHS.user(user.uid), { householdId: d.householdId }, { merge: true })
  );

  S.householdId = d.householdId; sv();
  _setPairErr('');
  document.getElementById('pair-code-inp').value = '';
  alert(`✅ Joined! You're now connected to ${d.createdByName}'s household.`);
  renderHousehold();
}

// ── Remove member ─────────────────────────────────────────
export async function removeMember(uid) {
  if (!S.householdId || !confirm('Remove this member?')) return;
  await deleteDoc(PATHS.membership(S.householdId, uid));
  await updateDoc(PATHS.household(S.householdId), { memberUids: arrayRemove(uid) });
  renderHousehold();
}

// ── Load partner profile ──────────────────────────────────
async function loadPartnerProfile(uid) {
  if (!S.householdId) return null;
  const [mSnap, pSnap] = await Promise.all([
    getDoc(PATHS.membership(S.householdId, uid)),
    getDoc(PATHS.profile(S.householdId, uid)),
  ]);
  if (!mSnap.exists() || !pSnap.exists()) return null;
  return { member: mSnap.data(), profile: pSnap.data() };
}

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════
export function renderHousehold() {
  const el = document.getElementById('pg-household');
  if (!el) return;
  const user = auth.currentUser;
  if (!user)          { el.innerHTML = _htmlSignInPrompt();  return; }
  if (!S.householdId) { el.innerHTML = _htmlNoHousehold();   _bindJoinInput(); return; }
  el.innerHTML = _htmlRoster();
  _bindJoinInput();
}

function _htmlSignInPrompt() {
  return `
  <div style="text-align:center;padding:4rem 1.5rem">
    <div style="font-size:2.5rem;margin-bottom:1rem">👥</div>
    <div style="font-family:var(--fd);font-size:1.5rem;font-weight:900;margin-bottom:.5rem">Household sharing</div>
    <p class="xxs c-muted" style="max-width:340px;margin:.5rem auto 1.5rem;line-height:1.7">
      Sign in to pair with your partner, family, or friends. Your existing data stays intact.
    </p>
    <button class="btn bp" onclick="showAuthModal()">Sign in with phone</button>
  </div>`;
}

function _htmlNoHousehold() {
  return `
  <div class="g2 mb1">
    <div class="card">
      <div class="sh"><div class="shdot"></div>Start a household</div>
      <p class="xxs c-muted" style="line-height:1.7;margin-bottom:1rem">
        Create a household, then share the invite code with your wife or others.
        Each person uses their own device with their own data.
      </p>
      <button class="btn bp" style="width:100%" onclick="hhCreate()">+ Create household</button>
    </div>
    <div class="card">
      <div class="sh"><div class="shdot" style="background:var(--teal)"></div>Join someone else's</div>
      <p class="xxs c-muted" style="line-height:1.7;margin-bottom:.75rem">Got an invite code? Enter it below.</p>
      <div class="fi"><label>Pair code</label>
        <input id="pair-code-inp" placeholder="e.g. 4F-9K-2X"
          style="font-family:var(--fm);font-size:1.1rem;letter-spacing:.14em;text-transform:uppercase">
      </div>
      <div id="pair-code-err" class="cb-dan xxs" style="display:none;margin-bottom:.5rem"></div>
      <button class="btn bok" style="width:100%" onclick="hhRedeem()">Join household</button>
    </div>
  </div>`;
}

function _htmlRoster() {
  const user    = auth.currentUser;
  const members = S.members.length
    ? S.members
    : [{ uid: user.uid, name: user.displayName || user.phoneNumber || 'You', avatarColor: 'indigo', role: 'owner', sharedTags: [] }];

  const cards = members.map(m => {
    const isYou = m.uid === user.uid;
    const col   = m.avatarColor || 'indigo';
    return `
    <div class="dcard" style="border-left:3px solid var(--${col})">
      <div class="dcard-hd">
        <div class="dcard-ico" style="background:rgba(124,115,230,.1)">
          <span style="font-family:var(--fd);font-weight:900;font-size:1.1rem;color:var(--${col})">${(m.name||'?')[0].toUpperCase()}</span>
        </div>
        <div class="dcard-ti">
          <div class="dcard-nm">
            ${m.name || 'Member'}
            ${isYou ? '<span class="bdg bdg-p" style="font-size:.5rem">YOU</span>' : ''}
            <span class="bdg bdg-muted" style="font-size:.5rem">${(m.role||'member').toUpperCase()}</span>
          </div>
          <div class="dcard-mt">${m.phone || ''}</div>
        </div>
        <div class="dcard-rt" style="display:flex;gap:.35rem">
          ${!isYou ? `<button class="btn bg bsm" onclick="hhViewPartner('${m.uid}')">View →</button>` : ''}
          ${!isYou && auth.currentUser?.uid === S.members.find(x=>x.role==='owner')?.uid
            ? `<button class="btn bd bsm" onclick="hhRemove('${m.uid}')">✕</button>` : ''}
        </div>
      </div>
      <div class="flex gap4 wrap" style="margin-top:.4rem">
        ${(m.sharedTags||[]).map(t=>`<span class="bdg bdg-teal" style="font-size:.52rem">${t}</span>`).join('')}
        <span class="bdg bdg-muted" style="font-size:.52rem">${m.canEdit?'can edit':'view only'}</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="g2 mb1">
    <div class="card">
      <div class="sh"><div class="shdot"></div>Members
        <span class="bdg bdg-muted" style="margin-left:.5rem">${members.length} of 6</span>
      </div>
      ${cards}
      <div style="display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
        <button class="btn bp" onclick="hhInvite()">+ Invite member</button>
        <button class="btn bg" onclick="hhCreate()">Create new household</button>
      </div>
    </div>

    <div class="card">
      <div class="sh"><div class="shdot" style="background:var(--teal)"></div>Join a household</div>
      <p class="xxs c-muted" style="line-height:1.7;margin-bottom:.75rem">Have a code from another household?</p>
      <div class="fi"><label>Pair code</label>
        <input id="pair-code-inp" placeholder="e.g. 4F-9K-2X"
          style="font-family:var(--fm);font-size:1.1rem;letter-spacing:.14em;text-transform:uppercase">
      </div>
      <div id="pair-code-err" class="cb-dan xxs" style="display:none;margin-bottom:.5rem"></div>
      <button class="btn bok" style="width:100%" onclick="hhRedeem()">Join</button>
    </div>
  </div>

  <!-- Partner detail (loaded on demand) -->
  <div id="hh-partner-panel"></div>

  <!-- Invite modal -->
  <div class="ovl" id="mo-invite">
    <div class="modal">
      <div class="mo-t">📤 Invite to household</div>
      <div class="fi"><label>Their role</label>
        <select id="inv-role">
          <option value="partner">Partner (two-way)</option>
          <option value="viewer">Viewer (read-only)</option>
          <option value="member">Member (two-way)</option>
        </select>
      </div>
      <div class="fi"><label>Share these sections</label>
        <div class="flex gap4 wrap" style="margin-top:.3rem" id="inv-tags">
          ${['daily','expenses','debts','sips'].map(t =>
            `<label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;cursor:pointer;color:var(--t2)">
               <input type="checkbox" value="${t}" ${['daily','expenses','debts'].includes(t)?'checked':''} style="accent-color:var(--p)"> ${t}
             </label>`).join('')}
        </div>
      </div>
      <div id="pair-code-display" style="display:none;text-align:center;padding:.75rem 0">
        <div class="xxs c-muted" style="margin-bottom:.4rem;font-family:var(--fm);letter-spacing:.1em">PAIR CODE · VALID 10 MIN</div>
        <div id="pair-code-val" style="font-family:var(--fm);font-size:2.2rem;font-weight:700;letter-spacing:.18em;color:var(--p2)"></div>
        <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-top:.75rem">
          <button class="btn bp bsm" onclick="hhCopyCode()">📋 Copy</button>
          <button class="btn bg bsm" onclick="hhShareLink()">🔗 Share link</button>
          <button class="btn bg bsm" onclick="hhRefreshCode()">🔄 New code</button>
        </div>
        <div class="cb-warn xxs" style="margin-top:.65rem">Share now — code expires in 10 minutes.</div>
      </div>
      <div class="mo-ft">
        <button class="btn bp" style="flex:1" id="inv-gen-btn" onclick="hhGenCode()">Generate code</button>
        <button class="btn bg" onclick="cmo()">Close</button>
      </div>
    </div>
  </div>`;
}

// ── Partner detail ────────────────────────────────────────
export async function viewPartner(uid) {
  const panel = document.getElementById('hh-partner-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="card mt1"><div class="xxs c-muted">Loading…</div></div>';
  const data = await loadPartnerProfile(uid);
  if (!data) { panel.innerHTML = '<div class="cb-warn xxs mt1">No data shared yet.</div>'; return; }
  const { member: m, profile: p } = data;
  const moStr  = new Date().toISOString().slice(0,7);
  const moExps = (p.dailyExps||[]).filter(e => e.date?.startsWith(moStr));
  const moTotal = moExps.reduce((s,e) => s + e.amt, 0);
  const recent  = [...(p.dailyExps||[])].sort((a,b) => b.date?.localeCompare(a.date)).slice(0,8);
  panel.innerHTML = `
  <div class="card mt1">
    <div class="sh"><div class="shdot" style="background:var(--${m.avatarColor||'rose'})"></div>
      ${m.name}'s data
      <span class="bdg bdg-muted" style="margin-left:auto;font-size:.52rem">read-only</span>
    </div>
    <div class="g4 mb1">
      <div class="kcard"><div class="kl">Daily · this month</div><div class="kv c-rose">${fmt(moTotal)}</div></div>
      <div class="kcard"><div class="kl">Entries</div><div class="kv">${moExps.length}</div></div>
      <div class="kcard"><div class="kl">Debts</div><div class="kv c-warn">${(p.debts||[]).length}</div></div>
      <div class="kcard"><div class="kl">SIPs</div><div class="kv c-sky">${(p.sips||[]).length}</div></div>
    </div>
    <div style="font-family:var(--fd);font-size:.82rem;font-weight:800;margin-bottom:.5rem">Recent daily expenses</div>
    ${recent.length ? recent.map(e => {
      const cat = (p.dailyCats||[]).find(c=>c.id===e.catId)||{name:'Other',icon:'💸',color:'#94a3b8'};
      return `<div class="dex-entry">
        <span class="dex-date">${e.date}</span>
        <span class="dex-cat-dot" style="background:${cat.color}"></span>
        <span class="dex-label">${cat.icon} ${cat.name}${e.note?` <span class="dex-note">— ${e.note}</span>`:''}</span>
        <span class="dex-amt">${fmt(e.amt)}</span>
      </div>`;
    }).join('') : '<div class="empty xxs">No daily expenses shared yet.</div>'}
    <button class="btn bg bsm" style="margin-top:.75rem" onclick="document.getElementById('hh-partner-panel').innerHTML=''">Close</button>
  </div>`;
}

// ── Input auto-format ─────────────────────────────────────
function _bindJoinInput() {
  const inp = document.getElementById('pair-code-inp');
  if (!inp) return;
  inp.addEventListener('input', () => {
    let v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (v.length > 2) v = v.slice(0,2)+'-'+v.slice(2);
    if (v.length > 5) v = v.slice(0,5)+'-'+v.slice(5);
    inp.value = v.slice(0,8);
  });
}

function _setPairErr(msg) {
  const el = document.getElementById('pair-code-err');
  if (el) { el.textContent = msg; el.style.display = msg ? '' : 'none'; }
}

function _pickColor(uid) {
  const cols = ['rose','teal','amber','sky','coral','lime'];
  return cols[uid.charCodeAt(0) % cols.length];
}

// ── Window bindings ───────────────────────────────────────
export function initHouseholdWindowBindings() {
  Object.assign(window, {
    hhCreate:      async () => { await createHousehold(); renderHousehold(); },
    hhRedeem:      async () => { await redeemPairCode(document.getElementById('pair-code-inp')?.value||''); },
    hhInvite:      () => { document.getElementById('pair-code-display').style.display='none'; document.getElementById('inv-gen-btn').style.display=''; openMo('mo-invite'); },
    hhViewPartner: viewPartner,
    hhRemove:      removeMember,
    hhGenCode:     async () => {
      const role = document.getElementById('inv-role')?.value||'partner';
      const tags = [...(document.querySelectorAll('#inv-tags input:checked')||[])].map(i=>i.value);
      await generatePairCode(role, tags);
    },
    hhCopyCode:    () => { navigator.clipboard.writeText(window._currentPairCode||''); alert('Copied!'); },
    hhShareLink:   () => {
      const code = window._currentPairCode||'';
      const url  = `${location.origin}${location.pathname}?join=${code}`;
      if (navigator.share) navigator.share({ title:'Join my FinanceFreedom household', url });
      else { navigator.clipboard.writeText(url); alert('Link copied!'); }
    },
    hhRefreshCode: async () => {
      const role = document.getElementById('inv-role')?.value||'partner';
      const tags = [...(document.querySelectorAll('#inv-tags input:checked')||[])].map(i=>i.value);
      await generatePairCode(role, tags);
    },
    renderHousehold,
  });
}
