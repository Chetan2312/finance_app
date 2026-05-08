# Phase 6 — Household Sharing (Phone OTP + Firebase)
## Instructions for Claude Code

Read this file top to bottom and apply every change in order.
Do not skip any step. After all changes are applied, run the deploy steps at the end.

---

## PART A — Manual Firebase Console Setup
### Do this BEFORE touching any code. Takes ~10 minutes.

1. Go to **https://console.firebase.google.com**
2. Click **Add project** → name it `finance-freedom` → disable Google Analytics → Create
3. In the left sidebar → **Authentication** → Get started
   - Click **Sign-in method** tab → Enable **Phone**
   - Under **Phone** settings, add a test phone number for development:
     - Phone: `+91 99999 99999` · Verification code: `123456`
   - Save
4. In left sidebar → **Firestore Database** → Create database
   - Choose **Start in production mode**
   - Region: **asia-south1 (Mumbai)** → Enable
5. In left sidebar → **Project settings** (gear icon)
   - Click **Add app** → Web (`</>`)
   - App nickname: `finance-freedom-web` → Register app
   - **Copy the entire `firebaseConfig` object** — you will paste it into `js/firebase.js`
6. In left sidebar → **Hosting** → Get started → follow prompts → Next → Next → Finish

---

## PART B — Files to CREATE

### FILE 1: `js/firebase.js`
Create this file. Replace the placeholder values with your real Firebase config from Step 5 above.

```js
// ══════════════════════════════════════
// js/firebase.js — Firebase init + helpers
// ══════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
// ─────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

export {
  RecaptchaVerifier, signInWithPhoneNumber, signOut,
  onAuthStateChanged, updateProfile,
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, getDocs, serverTimestamp, Timestamp,
  arrayUnion, arrayRemove,
};

// Current user as a Promise — use in modules that need user before Firestore reads
export function currentUser() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
  });
}

// ── Firestore path helpers ─────────────────────────────────
export const PATHS = {
  user:        uid         => doc(db, 'users', uid),
  household:   hhId        => doc(db, 'households', hhId),
  membership:  (hhId, uid) => doc(db, 'households', hhId, 'memberships', uid),
  memberships: hhId        => collection(db, 'households', hhId, 'memberships'),
  profile:     (hhId, uid) => doc(db, 'households', hhId, 'profiles', uid),
  pairCode:    code        => doc(db, 'pair_codes', code),
};
```

---

### FILE 2: `js/modules/auth.js`
Create this file. This is a full rewrite for Phone OTP — replaces the email/password version.

```js
// ══════════════════════════════════════
// js/modules/auth.js — Phone OTP auth
// ══════════════════════════════════════
import {
  auth, db, PATHS,
  RecaptchaVerifier, signInWithPhoneNumber,
  signOut, onAuthStateChanged, updateProfile,
  setDoc, getDoc, serverTimestamp,
} from '../firebase.js';
import { S, startSync, stopSync } from '../state.js';

let _onSignedIn  = async () => {};
let _onSignedOut = () => {};
let _rcFn        = () => {};
let _confirmResult = null;
let _recaptcha     = null;

export function setAuthCallbacks(onIn, onOut) { _onSignedIn = onIn; _onSignedOut = onOut; }
export function setAuthRcFn(fn) { _rcFn = fn; }

// ── Format Indian phone numbers ───────────────────────────
function fmtPhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('91') && d.length === 12) return '+' + d;
  if (d.length === 10) return '+91' + d;
  return '+' + d;
}

// ── Recaptcha (invisible) ─────────────────────────────────
function setupRecaptcha() {
  if (_recaptcha) return;
  _recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => { _recaptcha = null; },
  });
}

// ── Step 1: send OTP ──────────────────────────────────────
export async function sendOTP() {
  const phone = document.getElementById('auth-phone')?.value?.trim();
  if (!phone) { _authErr('Enter your phone number.'); return; }
  _authErr('');
  _setAuthBtn('Sending…', true);
  try {
    setupRecaptcha();
    _confirmResult = await signInWithPhoneNumber(auth, fmtPhone(phone), _recaptcha);
    // Show OTP step
    document.getElementById('auth-step-phone').style.display = 'none';
    document.getElementById('auth-step-otp').style.display   = 'block';
    document.getElementById('auth-otp')?.focus();
    _setAuthBtn('Verify', false);
  } catch (e) {
    _recaptcha?.clear(); _recaptcha = null;
    _authErr(_friendlyErr(e.code) || e.message);
    _setAuthBtn('Send OTP', false);
  }
}

// ── Step 2: verify OTP ────────────────────────────────────
export async function verifyOTP() {
  const code = document.getElementById('auth-otp')?.value?.trim();
  if (!code || code.length < 6) { _authErr('Enter the 6-digit code.'); return; }
  _authErr('');
  _setAuthBtn('Verifying…', true);
  try {
    const cred = await _confirmResult.confirm(code);
    // onAuthStateChanged fires → takes it from here
    // Show name step if first time
    const snap = await getDoc(PATHS.user(cred.user.uid));
    if (!snap.exists() || !snap.data().name) {
      document.getElementById('auth-step-otp').style.display  = 'none';
      document.getElementById('auth-step-name').style.display = 'block';
      _setAuthBtn('Save & continue', false);
    }
  } catch (e) {
    _authErr('Invalid code. Try again.');
    _setAuthBtn('Verify', false);
  }
}

// ── Step 3: save name (first-time only) ──────────────────
export async function saveName() {
  const name = document.getElementById('auth-name')?.value?.trim();
  if (!name) { _authErr('Enter your name.'); return; }
  _setAuthBtn('Saving…', true);
  try {
    const user = auth.currentUser;
    await updateProfile(user, { displayName: name });
    await setDoc(PATHS.user(user.uid), {
      uid: user.uid, name,
      phone: user.phoneNumber,
      avatarColor: _pickColor(user.uid),
      createdAt: serverTimestamp(),
    }, { merge: true });
    hideAuthModal();
    _updateHeaderUI(user);
  } catch (e) {
    _authErr('Could not save name. Try again.');
    _setAuthBtn('Save & continue', false);
  }
}

// ── Unified submit handler ────────────────────────────────
export async function submitAuth() {
  const phoneStep = document.getElementById('auth-step-phone');
  const otpStep   = document.getElementById('auth-step-otp');
  const nameStep  = document.getElementById('auth-step-name');
  if (nameStep?.style.display !== 'none' && nameStep) { await saveName(); return; }
  if (otpStep?.style.display  !== 'none' && otpStep)  { await verifyOTP(); return; }
  await sendOTP();
}

// ── Sign out ──────────────────────────────────────────────
export async function signOutUser() {
  if (!confirm('Sign out?')) return;
  await signOut(auth);
}

// ── Auth state listener ───────────────────────────────────
export function initAuth() {
  onAuthStateChanged(auth, async user => {
    if (user) {
      S.userId = user.uid;
      // Ensure user doc exists
      const snap = await getDoc(PATHS.user(user.uid));
      if (!snap.exists()) {
        await setDoc(PATHS.user(user.uid), {
          uid: user.uid,
          name: user.displayName || '',
          phone: user.phoneNumber || '',
          avatarColor: _pickColor(user.uid),
          createdAt: serverTimestamp(),
        });
      } else {
        // If no displayName set yet, show name step
        if (!user.displayName && snap.data().name) {
          await updateProfile(user, { displayName: snap.data().name });
        }
      }
      // Resolve household
      const hhId = S.householdId || snap.data()?.householdId || null;
      if (hhId) {
        S.householdId = hhId;
        await startSync(hhId, user.uid, type => { _rcFn(); });
      }
      _updateHeaderUI(user);
      hideAuthModal();
      await _onSignedIn(user, hhId);
    } else {
      S.userId = null; S.householdId = null; S.members = [];
      stopSync();
      _updateHeaderUI(null);
      _onSignedOut();
    }
  });
}

// ── Modal helpers ─────────────────────────────────────────
export function showAuthModal() {
  const mo = document.getElementById('mo-auth');
  if (!mo) return;
  mo.classList.add('on');
  // Reset to phone step
  document.getElementById('auth-step-phone').style.display = 'block';
  document.getElementById('auth-step-otp').style.display   = 'none';
  document.getElementById('auth-step-name').style.display  = 'none';
  _setAuthBtn('Send OTP', false);
  _authErr('');
  document.getElementById('auth-phone')?.focus();
}

export function hideAuthModal() {
  document.getElementById('mo-auth')?.classList.remove('on');
}

// ── Internal helpers ──────────────────────────────────────
function _updateHeaderUI(user) {
  const btn  = document.getElementById('hdr-auth-btn');
  const area = document.getElementById('hdr-user');
  const name = document.getElementById('hdr-user-name');
  if (!btn) return;
  if (user) {
    btn.style.display  = 'none';
    if (area) area.style.display = 'flex';
    if (name) name.textContent = user.displayName || user.phoneNumber || 'You';
  } else {
    btn.style.display = '';
    if (area) area.style.display = 'none';
  }
}

function _setAuthBtn(label, disabled) {
  const btn = document.getElementById('auth-submit-btn');
  if (!btn) return;
  btn.textContent = label;
  btn.disabled    = disabled;
}

function _authErr(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = msg ? '' : 'none';
}

function _pickColor(uid) {
  const cols = ['indigo','rose','teal','amber','sky','coral'];
  return cols[uid.charCodeAt(0) % cols.length];
}

function _friendlyErr(code) {
  return ({
    'auth/invalid-phone-number':    'Invalid phone number. Use 10-digit Indian number.',
    'auth/too-many-requests':       'Too many attempts. Try again in a few minutes.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/code-expired':            'OTP expired. Go back and resend.',
    'auth/invalid-verification-code': 'Wrong OTP. Check and try again.',
  })[code] || '';
}

// ── Expose to window ──────────────────────────────────────
Object.assign(window, {
  showAuthModal, hideAuthModal, submitAuth,
  sendOTP, verifyOTP, saveName, signOutUser,
});
```

---

### FILE 3: `js/modules/household.js`
Create this file with the following content:

```js
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
  if (!user)         { el.innerHTML = _htmlSignInPrompt();  return; }
  if (!S.householdId){ el.innerHTML = _htmlNoHousehold();   _bindJoinInput(); return; }
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
  const moStr    = new Date().toISOString().slice(0,7);
  const moExps   = (p.dailyExps||[]).filter(e => e.date?.startsWith(moStr));
  const moTotal  = moExps.reduce((s,e) => s + e.amt, 0);
  const recent   = [...(p.dailyExps||[])].sort((a,b) => b.date?.localeCompare(a.date)).slice(0,8);
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
```

---

### FILE 4: `firestore.rules`
Create this file at the project root.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth()      { return request.auth != null; }
    function isOwn(uid)    { return request.auth.uid == uid; }
    function isMember(hhId) {
      return isAuth() && exists(
        /databases/$(database)/documents/households/$(hhId)/memberships/$(request.auth.uid)
      );
    }
    function isOwner(hhId) {
      return isAuth() &&
        get(/databases/$(database)/documents/households/$(hhId)).data.ownerId == request.auth.uid;
    }

    // User profiles — any auth'd user can read (for name display), own write only
    match /users/{uid} {
      allow read:  if isAuth();
      allow write: if isAuth() && isOwn(uid);
    }

    // Pair codes — any auth'd user can read (needed to join) or mark used; members create
    match /pair_codes/{code} {
      allow read:   if isAuth();
      allow create: if isAuth();
      allow update: if isAuth();
    }

    // Households
    match /households/{hhId} {
      allow read:   if isMember(hhId);
      allow create: if isAuth();
      allow update: if isMember(hhId);
      allow delete: if isOwner(hhId);

      // Memberships — members read all; users write their own record only
      match /memberships/{uid} {
        allow read:   if isMember(hhId) || isAuth();
        allow create: if isAuth() && isOwn(uid);
        allow update: if isAuth() && (isOwn(uid) || isOwner(hhId));
        allow delete: if isOwner(hhId) || (isAuth() && isOwn(uid));
      }

      // Finance profiles — members read; only owner writes own profile
      match /profiles/{uid} {
        allow read:  if isMember(hhId);
        allow write: if isAuth() && isOwn(uid);
      }
    }
  }
}
```

---

### FILE 5: `firebase.json`
Create this file at the project root.

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "firestore.rules",
      "**/*.md",
      "**/*.bak"
    ],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.js",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }]
      }
    ]
  }
}
```

---

### FILE 6: `.firebaserc`
Create this file at the project root. Replace `YOUR_PROJECT_ID` with your actual Firebase project ID.

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

---

## PART C — Files to EDIT

### EDIT 1: `js/state.js` — add Firestore sync

Find this block near the top of state.js (the mutable refs section):

```js
export let charts    = { sip: null, alloc: null, stmt: null };
export let rptCharts = { bar: null, donut: null };
```

Add these lines immediately AFTER that block:

```js
// v8: Firestore sync unsub handles
let _unsubProfile = null;
let _unsubMembers = null;

export async function startSync(householdId, userId, onUpdate) {
  stopSync();
  S.householdId = householdId;
  S.userId      = userId;
  let _db, _onSnapshot, _PATHS;
  try {
    const fb   = await import('./firebase.js');
    _db        = fb.db;
    _onSnapshot = fb.onSnapshot;
    _PATHS     = fb.PATHS;
  } catch(e) { console.warn('[state] Firebase not ready', e); return; }

  // Listen to own profile
  _unsubProfile = _onSnapshot(_PATHS.profile(householdId, userId), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.debts)     S.debts     = d.debts;
    if (d.sips)      S.sips      = d.sips;
    if (d.expSecs)   S.expSecs   = d.expSecs;
    if (d.dailyExps) S.dailyExps = d.dailyExps;
    if (d.dailyCats) S.dailyCats = d.dailyCats;
    if (onUpdate) onUpdate('profile');
  });

  // Listen to household memberships
  _unsubMembers = _onSnapshot(_PATHS.memberships(householdId), snap => {
    S.members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    if (onUpdate) onUpdate('members');
  });
}

export function stopSync() {
  if (_unsubProfile) { _unsubProfile(); _unsubProfile = null; }
  if (_unsubMembers) { _unsubMembers(); _unsubMembers = null; }
}
```

Also find the `buildPayload` function (or the block inside `sv()` that builds the localStorage object). It currently looks like:

```js
localStorage.setItem('ff6', JSON.stringify({
  inc: gv('s-inc'), xi: gv('s-xi'), sav: gv('s-sav'), xp: gv('s-xp'),
  debts: S.debts, sips: S.sips, expSecs: S.expSecs, custSecs: S.custSecs,
  dailyExps: S.dailyExps, dailyCats: S.dailyCats,
  strat: S.strat, theme: S.theme, chatHist: S.chatHist.slice(-20)
}));
```

Replace it with:

```js
const payload = {
  inc: gv('s-inc'), xi: gv('s-xi'), sav: gv('s-sav'), xp: gv('s-xp'),
  debts: S.debts, sips: S.sips, expSecs: S.expSecs, custSecs: S.custSecs,
  dailyExps: S.dailyExps, dailyCats: S.dailyCats,
  strat: S.strat, theme: S.theme, chatHist: S.chatHist.slice(-20),
  householdId: S.householdId,
};
localStorage.setItem('ff6', JSON.stringify(payload));

// Also push to Firestore if signed in + in a household
if (S.householdId && S.userId) {
  import('./firebase.js').then(({ db, PATHS, setDoc, serverTimestamp }) => {
    setDoc(PATHS.profile(S.householdId, S.userId), {
      ...payload, updatedAt: serverTimestamp(),
    }, { merge: true }).catch(e => console.warn('[sv] Firestore write failed', e));
  });
}
```

Also find the `load()` function and add householdId loading. Find the line:

```js
S.strat = d.strat || 'avalanche'; S.chatHist = d.chatHist || [];
```

Add immediately after it:

```js
S.householdId = d.householdId || null;
```

Also add to S object definition (find `chatHist: [], strat: 'avalanche', theme: 'dark',` and add after it):

```js
householdId: null, userId: null, members: [],
```

---

### EDIT 2: `js/app.js` — import and wire household + auth modules

Find the imports section at the top. After the last existing import line, add:

```js
// ── v8 modules ──
import { initAuth, setAuthCallbacks, setAuthRcFn, showAuthModal } from './modules/auth.js';
import { renderHousehold, initHouseholdWindowBindings, setRcFn as setHhRc } from './modules/household.js';
```

Find the `sw(t, el)` navigation function. Find this line inside it:

```js
if (t === 'invest')     loadInvest();
```

Add these lines immediately after it:

```js
if (t === 'household')  renderHousehold();
```

Find the `init()` function. At the end of it, before the closing `}`, add:

```js
// v8: household + auth
initHouseholdWindowBindings();
setHhRc(rc);
setAuthCallbacks(
  async (user, hhId) => { renderHousehold(); },
  () => { renderHousehold(); }
);
setAuthRcFn(rc);
initAuth();

// Handle ?join=CODE deep links
const joinCode = new URLSearchParams(location.search).get('join');
if (joinCode) {
  history.replaceState({}, '', location.pathname);
  sessionStorage.setItem('pending_join_code', joinCode);
}
```

Find the `Object.assign(window, {` block at the bottom. Add these to it:

```js
showAuthModal,
renderHousehold,
```

---

### EDIT 3: `index.html` — update header, nav, add pages and modals

**3a. Replace the `<header class="hdr">` block** with:

```html
<header class="hdr">
  <div class="logo">
    <div class="logo-mark">FinanceFreedom</div>
    <div class="logo-sub">// WEALTH OS · v8 · LOCAL + SYNC</div>
  </div>
  <div class="hdr-r">
    <div class="sav-badge" id="sv-badge"><span class="sav-dot"></span><span id="sv-txt">SAVED</span></div>
    <button class="ico-btn" onclick="toggleTheme()" id="theme-btn" title="Toggle theme">🌙</button>
    <button class="btn bg bsm" id="hdr-auth-btn" onclick="showAuthModal()"
      style="font-family:var(--fm);font-size:.6rem;letter-spacing:.06em">SIGN IN</button>
    <div id="hdr-user" style="display:none;align-items:center;gap:.4rem">
      <div class="sav-badge" style="background:var(--info-s);color:var(--p2);border-color:rgba(124,115,230,.3)">
        <span class="sav-dot" style="background:var(--p2)"></span>
        <span id="hdr-user-name">—</span>
      </div>
      <button class="ico-btn bsm" onclick="signOutUser()" title="Sign out" style="font-size:.7rem">⏻</button>
    </div>
  </div>
</header>
```

**3b. Replace the `<nav class="nav">` block** with:

```html
<nav class="nav">
  <button class="ntab on" onclick="sw('overview',this)">📊 Overview</button>
  <button class="ntab"    onclick="sw('expenses',this)">💸 Expenses</button>
  <button class="ntab"    onclick="sw('debts',this)">💳 Debts</button>
  <button class="ntab"    onclick="sw('sip',this)">📈 SIPs</button>
  <button class="ntab"    onclick="sw('invest',this)">💰 Invest</button>
  <button class="ntab"    onclick="sw('daily',this)">🗓 Daily</button>
  <button class="ntab"    onclick="sw('milestones',this)">🎯 Milestones</button>
  <button class="ntab"    onclick="sw('budget',this)">🧮 Budget</button>
  <button class="ntab"    onclick="sw('reports',this)">📋 Reports</button>
  <button class="ntab"    onclick="sw('statements',this)">🏦 Statements</button>
  <button class="ntab"    onclick="sw('household',this)">👥 Household</button>
  <button class="ntab"    onclick="sw('ai',this)">🤖 AI</button>
</nav>
```

**3c. Add new page divs** — inside `<div class="wrap">`, after the last existing `<!-- ════ AI ════ -->` page div, add:

```html
<!-- ════ HOUSEHOLD ════ -->
<div id="pg-household" class="page">
  <!-- Rendered by js/modules/household.js -->
</div>
```

**3d. Add auth + recaptcha before closing `</body>`**, immediately before the existing `<script type="module" src="js/app.js"></script>` line:

```html
<!-- Invisible recaptcha container (required for Phone OTP) -->
<div id="recaptcha-container"></div>

<!-- AUTH MODAL — Phone OTP -->
<div class="ovl" id="mo-auth">
  <div class="modal" style="max-width:380px">

    <!-- Step 1: phone number -->
    <div id="auth-step-phone">
      <div class="mo-t">📱 Sign in with phone</div>
      <p class="xxs c-muted" style="margin-bottom:.9rem;line-height:1.65">
        Enter your mobile number. We'll send a one-time code via SMS.
      </p>
      <div class="fi">
        <label>Phone number</label>
        <div style="display:flex;align-items:center;gap:.4rem">
          <span style="font-family:var(--fm);font-size:.85rem;color:var(--t2);padding:.55rem .7rem;background:var(--s1);border:1.5px solid var(--b1);border-radius:var(--rm);white-space:nowrap">+91</span>
          <input id="auth-phone" type="tel" placeholder="98765 43210" autocomplete="tel"
            style="flex:1" onkeydown="if(event.key==='Enter')sendOTP()">
        </div>
      </div>
    </div>

    <!-- Step 2: OTP -->
    <div id="auth-step-otp" style="display:none">
      <div class="mo-t">🔐 Enter OTP</div>
      <p class="xxs c-muted" style="margin-bottom:.9rem;line-height:1.65">
        Check your SMS. Enter the 6-digit code below.
      </p>
      <div class="fi">
        <label>Verification code</label>
        <input id="auth-otp" type="number" placeholder="123456"
          style="font-family:var(--fm);font-size:1.4rem;letter-spacing:.18em;text-align:center"
          onkeydown="if(event.key==='Enter')verifyOTP()">
      </div>
      <div class="xxs c-muted" style="margin-bottom:.5rem">
        Wrong number? <button class="btn bg bxs" onclick="document.getElementById('auth-step-phone').style.display='block';document.getElementById('auth-step-otp').style.display='none'">← Back</button>
      </div>
    </div>

    <!-- Step 3: name (first time only) -->
    <div id="auth-step-name" style="display:none">
      <div class="mo-t">✨ What's your name?</div>
      <p class="xxs c-muted" style="margin-bottom:.9rem;line-height:1.65">
        This is shown to your household members.
      </p>
      <div class="fi">
        <label>Your name</label>
        <input id="auth-name" placeholder="e.g. Aakash" autocomplete="name"
          onkeydown="if(event.key==='Enter')saveName()">
      </div>
    </div>

    <div id="auth-error" class="cb-dan xxs" style="display:none;margin-bottom:.5rem"></div>
    <div class="mo-ft">
      <button class="btn bp" style="flex:1" id="auth-submit-btn" onclick="submitAuth()">Send OTP</button>
      <button class="btn bg" onclick="hideAuthModal()">Cancel</button>
    </div>
    <div class="ib xxs" style="margin-top:.75rem;line-height:1.6">
      🔒 Your financial data stays on your device. Sign-in only enables sync with people you explicitly pair with.
    </div>
  </div>
</div>
```

---

### EDIT 4: `css/components.css` — add household styles

At the very end of the file, append:

```css
/* ═══════════════════════════════
   OTP INPUT
═══════════════════════════════ */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0 }
input[type=number] { -moz-appearance:textfield }

/* ═══════════════════════════════
   HOUSEHOLD / PAIR CODE
═══════════════════════════════ */
#pair-code-val {
  user-select:all;
  cursor:pointer;
  padding:.4rem .6rem;
  background:var(--s1);
  border:1.5px solid var(--b1);
  border-radius:var(--rm);
  display:inline-block;
  min-width:160px;
}
#pair-code-val:hover { border-color:var(--p); }
```

---

## PART D — Deploy

Run the following commands in your terminal from the project root:

```bash
# 1. Install Firebase CLI (one-time)
npm install -g firebase-tools

# 2. Log in
firebase login

# 3. Deploy Firestore rules + hosting
firebase deploy --only firestore:rules,hosting
```

After deploy succeeds, Firebase will print a **Hosting URL** like:
`https://finance-freedom-xxxxx.web.app`

**Add this URL to Firebase Auth authorized domains:**
- Firebase Console → Authentication → Settings → Authorized domains → Add domain
- Add your `.web.app` domain (it's usually added automatically — just verify it's there)

---

## PART E — Test Checklist

### On your device (owner):
1. Open the hosted URL
2. Click **SIGN IN** → enter your phone → receive SMS → enter OTP → enter your name
3. Click **👥 Household** tab → click **Create household**
4. Click **+ Invite member** → Generate code → copy the 6-character code
5. Send the code to your wife via WhatsApp

### On your wife's device:
1. Open the same hosted URL
2. Click **SIGN IN** → phone → OTP → her name
3. Click **👥 Household** → enter the pair code → **Join household**
4. She should see your household roster

### Verify sync:
1. You add a daily expense → she refreshes → she sees your total in the Household tab
2. She adds an expense → you click **View →** next to her name → see her data

### Deep link test:
Instead of sharing the code manually, use the **🔗 Share link** button.
The URL encodes the pair code — opening it on another device auto-fills the code.

---

## Notes

- **Data privacy**: Each person's full data is stored in their own Firestore profile. Only members of the same household can read it. Sharing rules (which sections are visible) are enforced on the client — for a family app this is appropriate.
- **Offline**: The app still works 100% offline. Firestore syncs when connectivity returns.
- **localhost**: Phone OTP works on localhost — Firebase allows it by default for development.
- **Cost**: Firestore free tier = 50K reads + 20K writes/day. A family of 6 using this daily will stay well within free limits.
