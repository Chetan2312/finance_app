// ══════════════════════════════════════
// STORAGE.JS — IndexedDB wrapper (Phase 8)
// Replaces localStorage for all app data.
// Single object store "kv" with key/value pairs.
// Migration: auto-imports legacy ff6 key from localStorage on first run.
// ══════════════════════════════════════

const DB_NAME = 'ff7';
const DB_VER  = 1;
const STORE   = 'kv';
const LS_KEY  = 'ff6';          // legacy localStorage key
const IDB_KEY = 'ff7_data';     // IndexedDB record key

let _db = null;

// ── Open (singleton) ──
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Low-level get/put ──
export async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = e => reject(e.target.error);
  });
}

export async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

export async function idbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ── App-level save / load ──

/**
 * saveData(obj) — persist the full app state object to IndexedDB.
 * Returns a Promise that resolves when the write is complete.
 */
export async function saveData(obj) {
  await idbPut(IDB_KEY, obj);
}

/**
 * loadData() — load app state from IndexedDB.
 * On first run, migrates the legacy ff6 localStorage entry if present.
 * Returns the parsed data object, or null if nothing stored yet.
 */
export async function loadData() {
  let data = await idbGet(IDB_KEY);

  // ── One-time migration from localStorage ──
  if (!data) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        data = JSON.parse(raw);
        // Write into IndexedDB so next load is fast
        await saveData(data);
        // Remove from localStorage to avoid stale duplication
        localStorage.removeItem(LS_KEY);
        console.info('[ff7] Migrated legacy data from localStorage → IndexedDB');
      }
    } catch (e) {
      console.warn('[ff7] Migration failed:', e);
    }
  }

  return data || null;
}

// ── Export / Import ──

/**
 * exportData() — download a full JSON backup of all app data.
 */
export async function exportData() {
  const data = await idbGet(IDB_KEY);
  if (!data) { alert('No data to export yet.'); return; }
  const json   = JSON.stringify(data, null, 2);
  const blob   = new Blob([json], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  const date   = new Date().toISOString().split('T')[0];
  a.href       = url;
  a.download   = `financefreedom-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * importData(file) — restore app data from a JSON backup file.
 * Calls onSuccess(data) after writing so app.js can reload state.
 */
export function importData(file, onSuccess) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      // Basic sanity check
      if (typeof data !== 'object' || Array.isArray(data)) {
        alert('Invalid backup file.');
        return;
      }
      await saveData(data);
      alert('Import successful! Reloading data...');
      onSuccess(data);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}
