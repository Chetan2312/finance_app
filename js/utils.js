// ══════════════════════════════════════
// UTILS — formatting, DOM helpers
// ══════════════════════════════════════

export function fmt(n) {
  const a = Math.abs(n || 0), s = n < 0 ? '-' : '';
  if (a >= 10000000) return s + '₹' + (a / 10000000).toFixed(1) + 'Cr';
  if (a >= 100000) return s + '₹' + (a / 100000).toFixed(1) + 'L';
  if (a >= 1000) return s + '₹' + (a / 1000).toFixed(1) + 'k';
  return s + '₹' + Math.round(a).toLocaleString('en-IN');
}

export function fmtFull(n) {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function gv(id) {
  return document.getElementById(id)?.value || '';
}

export function N(id) {
  return parseFloat(document.getElementById(id)?.value) || 0;
}
