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
  apiKey: "AIzaSyA9mklqLCRBOD_F9iMtEKQxZJWcHjRXLEc",
  authDomain: "nidhipath-20eef.firebaseapp.com",
  projectId: "nidhipath-20eef",
  storageBucket: "nidhipath-20eef.firebasestorage.app",
  messagingSenderId: "40636800809",
  appId: "1:40636800809:web:f6915523a06ab36c492138"
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