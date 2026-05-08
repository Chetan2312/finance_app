// ══════════════════════════════════════
// js/modules/auth.js — Multi-provider auth
// Providers: Google, Phone OTP, Email+Password
// ══════════════════════════════════════
import {
  auth, db, PATHS,
  googleProvider, signInWithPopup,
  RecaptchaVerifier, signInWithPhoneNumber,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  setDoc, getDoc, serverTimestamp,
} from '../firebase.js';
import { S, startSync, stopSync } from '../state.js';

let _onSignedIn  = async () => {};
let _onSignedOut = () => {};
let _rcFn        = () => {};

// Phone OTP state
let _confirmResult = null;
let _recaptcha     = null;

// Email sub-mode
let _emailMode = 'login'; // 'login' | 'register'

export function setAuthCallbacks(onIn, onOut) { _onSignedIn = onIn; _onSignedOut = onOut; }
export function setAuthRcFn(fn) { _rcFn = fn; }

// ══════════════════════════════════════
// GOOGLE
// ══════════════════════════════════════
export async function signInWithGoogle() {
  _authErr('');
  try {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged takes over
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      _authErr(_friendlyErr(e.code) || e.message);
    }
  }
}

// ══════════════════════════════════════
// PHONE OTP
// ══════════════════════════════════════
function _setupRecaptcha() {
  if (_recaptcha) return;
  _recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => { _recaptcha = null; },
  });
}

export async function sendOTP() {
  const raw = document.getElementById('auth-phone')?.value?.trim();
  if (!raw) { _authErr('Enter your phone number.'); return; }
  _authErr('');
  _setAuthBtn('Sending…', true);
  try {
    _setupRecaptcha();
    _confirmResult = await signInWithPhoneNumber(auth, _fmtPhone(raw), _recaptcha);
    _showPhoneStep('otp');
    document.getElementById('auth-otp')?.focus();
    _setAuthBtn('Verify OTP', false);
  } catch (e) {
    _recaptcha?.clear(); _recaptcha = null;
    _authErr(_friendlyErr(e.code) || e.message);
    _setAuthBtn('Send OTP', false);
  }
}

export async function verifyOTP() {
  const code = document.getElementById('auth-otp')?.value?.trim();
  if (!code || code.length < 6) { _authErr('Enter the 6-digit code.'); return; }
  _authErr('');
  _setAuthBtn('Verifying…', true);
  try {
    await _confirmResult.confirm(code);
    // onAuthStateChanged fires — name step handled there if needed
  } catch (e) {
    _authErr('Invalid code. Try again.');
    _setAuthBtn('Verify OTP', false);
  }
}

export function phoneBack() {
  _showPhoneStep('phone');
  _setAuthBtn('Send OTP', false);
  _authErr('');
}

function _fmtPhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('91') && d.length === 12) return '+' + d;
  if (d.length === 10) return '+91' + d;
  return '+' + d;
}

function _showPhoneStep(step) {
  document.getElementById('phone-step-input').style.display = step === 'phone' ? '' : 'none';
  document.getElementById('phone-step-otp').style.display   = step === 'otp'   ? '' : 'none';
}

// ══════════════════════════════════════
// EMAIL / PASSWORD
// ══════════════════════════════════════
export function toggleEmailMode() {
  _emailMode = _emailMode === 'login' ? 'register' : 'login';
  const isReg = _emailMode === 'register';
  _authErr('');
  document.getElementById('email-name-wrap').style.display = isReg ? '' : 'none';
  document.getElementById('auth-submit-btn').textContent   = isReg ? 'Create account' : 'Sign in';
  document.getElementById('email-toggle-msg').innerHTML    = isReg
    ? 'Have an account? <button class="btn bg bxs" onclick="toggleEmailMode()">Sign in</button>'
    : 'New here? <button class="btn bg bxs" onclick="toggleEmailMode()">Create account</button>';
}

export async function submitEmailAuth() {
  const email = document.getElementById('auth-email')?.value?.trim();
  const pass  = document.getElementById('auth-pass')?.value;
  const name  = document.getElementById('auth-email-name')?.value?.trim();
  if (!email || !pass) { _authErr('Enter email and password.'); return; }
  if (_emailMode === 'register' && !name) { _authErr('Enter your name.'); return; }
  if (pass.length < 6) { _authErr('Password must be at least 6 characters.'); return; }
  _authErr('');
  _setAuthBtn(_emailMode === 'register' ? 'Creating…' : 'Signing in…', true);
  try {
    if (_emailMode === 'register') {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(PATHS.user(cred.user.uid), {
        uid: cred.user.uid, name, email,
        avatarColor: _pickColor(cred.user.uid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (e) {
    _authErr(_friendlyErr(e.code) || e.message);
    _setAuthBtn(_emailMode === 'register' ? 'Create account' : 'Sign in', false);
  }
}

// ══════════════════════════════════════
// TAB SWITCHING
// ══════════════════════════════════════
export function switchAuthTab(tab) {
  // tab: 'phone' | 'email'
  _authErr('');
  document.getElementById('auth-tab-phone').classList.toggle('on', tab === 'phone');
  document.getElementById('auth-tab-email').classList.toggle('on', tab === 'email');
  document.getElementById('auth-pane-phone').style.display = tab === 'phone' ? '' : 'none';
  document.getElementById('auth-pane-email').style.display = tab === 'email' ? '' : 'none';
  if (tab === 'phone') {
    _showPhoneStep('phone');
    _setAuthBtn('Send OTP', false);
    document.getElementById('auth-phone')?.focus();
  } else {
    _emailMode = 'login';
    document.getElementById('email-name-wrap').style.display = 'none';
    document.getElementById('auth-submit-btn').textContent   = 'Sign in';
    document.getElementById('email-toggle-msg').innerHTML    =
      'New here? <button class="btn bg bxs" onclick="toggleEmailMode()">Create account</button>';
    document.getElementById('auth-email')?.focus();
  }
}

// Unified submit — routes based on active tab
export function submitAuth() {
  const phonePane = document.getElementById('auth-pane-phone');
  if (phonePane && phonePane.style.display !== 'none') {
    const otpStep = document.getElementById('phone-step-otp');
    if (otpStep && otpStep.style.display !== 'none') { verifyOTP(); return; }
    sendOTP();
  } else {
    submitEmailAuth();
  }
}

// ══════════════════════════════════════
// SIGN OUT
// ══════════════════════════════════════
export async function signOutUser() {
  if (!confirm('Sign out?')) return;
  await signOut(auth);
}

// ══════════════════════════════════════
// AUTH STATE LISTENER
// ══════════════════════════════════════
export function initAuth() {
  onAuthStateChanged(auth, async user => {
    if (user) {
      S.userId = user.uid;
      const snap = await getDoc(PATHS.user(user.uid));
      if (!snap.exists()) {
        await setDoc(PATHS.user(user.uid), {
          uid:         user.uid,
          name:        user.displayName || '',
          email:       user.email || '',
          phone:       user.phoneNumber || '',
          avatarColor: _pickColor(user.uid),
          createdAt:   serverTimestamp(),
        });
      } else {
        if (!user.displayName && snap.data().name) {
          await updateProfile(user, { displayName: snap.data().name });
        }
      }
      const hhId = S.householdId || snap.data()?.householdId || null;
      if (hhId) {
        S.householdId = hhId;
        await startSync(hhId, user.uid, () => { _rcFn(); });
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

// ══════════════════════════════════════
// MODAL
// ══════════════════════════════════════
export function showAuthModal() {
  const mo = document.getElementById('mo-auth');
  if (!mo) return;
  mo.classList.add('on');
  // Reset to phone tab
  switchAuthTab('phone');
  _authErr('');
}

export function hideAuthModal() {
  document.getElementById('mo-auth')?.classList.remove('on');
}

// ══════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════
function _updateHeaderUI(user) {
  const btn  = document.getElementById('hdr-auth-btn');
  const area = document.getElementById('hdr-user');
  const name = document.getElementById('hdr-user-name');
  if (!btn) return;
  if (user) {
    btn.style.display = 'none';
    if (area) area.style.display = 'flex';
    if (name) name.textContent = user.displayName || user.email || user.phoneNumber || 'You';
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
    'auth/email-already-in-use':      'Email already registered. Sign in instead.',
    'auth/invalid-email':             'Invalid email address.',
    'auth/user-not-found':            'No account found. Create one first.',
    'auth/wrong-password':            'Wrong password. Try again.',
    'auth/invalid-credential':        'Wrong email or password.',
    'auth/too-many-requests':         'Too many attempts. Try again later.',
    'auth/network-request-failed':    'Network error. Check your connection.',
    'auth/weak-password':             'Password too weak. Use at least 6 characters.',
    'auth/invalid-phone-number':      'Invalid phone number. Use 10-digit Indian number.',
    'auth/code-expired':              'OTP expired. Go back and resend.',
    'auth/invalid-verification-code': 'Wrong OTP. Check and try again.',
    'auth/popup-blocked':             'Popup blocked. Allow popups for this site.',
    'auth/account-exists-with-different-credential': 'Account exists with different sign-in method.',
  })[code] || '';
}

// ── Expose to window ──────────────────────────────────────
Object.assign(window, {
  showAuthModal, hideAuthModal,
  submitAuth, submitEmailAuth,
  sendOTP, verifyOTP, phoneBack,
  toggleEmailMode, switchAuthTab,
  signInWithGoogle, signOutUser,
});
