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
