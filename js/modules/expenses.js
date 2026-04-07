// ══════════════════════════════════════
// EXPENSES — section render, item CRUD
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { DICONS } from '../../data/defaults.js';
import { S, sEm, setSEm, secEm, setSecEm, setICtx, iCtxSid, secTot, sv } from '../state.js';
import { openMo, cmo, buildEg } from './modals.js';

let rcFn = () => {};
export function setRcFn(fn) { rcFn = fn; }

export function renderExp() {
  document.getElementById('exp-cont').innerHTML = S.expSecs.map(s => renderSec(s, false)).join('');
  document.getElementById('cust-cont').innerHTML = S.custSecs.map(s => renderSec(s, true)).join('');
  attachExpInps();
}

function renderSec(sec, isC) {
  const tot = secTot(sec);
  return `<div class="esec" id="es-${sec.id}">
    <div class="esec-hd" onclick="togSec('${sec.id}')">
      <span style="font-size:.95rem;width:24px;text-align:center">${sec.icon}</span>
      <span class="esec-nm" style="color:${sec.color}">${sec.name}</span>
      <span class="esec-tot" id="st-${sec.id}">${fmt(tot)}</span>
      ${isC ? `<button class="btn bd bsm" style="padding:.15rem .45rem;margin-right:.3rem" onclick="event.stopPropagation();rmCustSec('${sec.id}')">✕</button>` : ''}
      <span class="esec-arr" id="arr-${sec.id}">▼</span>
    </div>
    <div class="esec-bd" id="eb-${sec.id}">${sec.isEmi ? renderEmiBody(sec) : renderItemBody(sec, isC)}</div>
  </div>`;
}

function renderItemBody(sec, isC) {
  return `<div class="egrid">${sec.items.map(it => `<div class="ei"><button class="eidel" onclick="rmExpItem('${sec.id}','${it.id}',${isC})" title="Remove">✕</button><div class="eilb">${it.label}</div><div class="eirow"><span class="rp">₹</span><input class="einp" type="number" placeholder="0" min="0" data-sid="${sec.id}" data-iid="${it.id}" data-cust="${isC}" value="${it.val || ''}"></div></div>`).join('')}</div>
  <div class="addrow"><button class="btn bg bsm" onclick="openItemModal('${sec.id}',false)">+ Add Item</button>${isC ? `<button class="btn bd bsm" onclick="rmCustSec('${sec.id}')">✕ Delete Section</button>` : ''}</div>`;
}

function renderEmiBody(sec) {
  let h = '<div class="sub-list">';
  if (!S.debts.length && !sec.items.length) h += `<div class="empty xxs" style="padding:.6rem">Debts added in Debts tab appear here.</div>`;
  S.debts.forEach(d => h += `<div class="sub-row"><span>${DICONS[d.type] || '🏦'}</span><div style="flex:1"><div class="sub-n">${d.name}<span class="lbdg">🔗 AUTO</span>${d.repay === 'interest' ? '<span class="bdg bdg-dan xxs">INT-ONLY</span>' : d.repay === 'bullet' ? '<span class="bdg bdg-warn xxs">BULLET</span>' : ''}</div><div class="sub-m">${d.rate}% p.a. · ${fmt(d.balance)}</div></div><span class="sub-a">${fmt(d.emi)}/mo</span></div>`);
  sec.items.filter(i => !i.linked).forEach(it => h += `<div class="sub-row"><span>📋</span><div style="flex:1"><div class="sub-n">${it.label}</div></div><div class="eirow" style="gap:3px"><span class="rp">₹</span><input class="einp" type="number" placeholder="0" min="0" data-sid="${sec.id}" data-iid="${it.id}" data-cust="false" value="${it.val || ''}" style="width:78px;background:transparent;border:none;color:var(--t1);font-family:var(--fm);font-size:.85rem;outline:none"><span class="xxs c-muted">/mo</span><button class="btn bd bsm bic" onclick="rmExpItem('${sec.id}','${it.id}',false)">✕</button></div></div>`);
  h += `</div><div class="addrow mt05"><button class="btn bg bsm" onclick="openItemModal('emi',true)">+ Manual EMI</button></div>`;
  return h;
}

export function togSec(id) {
  const b = document.getElementById('eb-' + id), a = document.getElementById('arr-' + id);
  b?.classList.toggle('op'); a?.classList.toggle('op');
}

function attachExpInps() {
  document.querySelectorAll('.einp').forEach(inp => {
    inp.addEventListener('input', () => {
      const sid = inp.dataset.sid, iid = inp.dataset.iid, isC = inp.dataset.cust === 'true';
      const arr = isC ? S.custSecs : S.expSecs; const sec = arr.find(s => s.id === sid);
      if (sec) { const it = sec.items.find(i => i.id === iid); if (it) { it.val = parseFloat(inp.value) || 0; sv(); rcFn(); const el = document.getElementById('st-' + sid); if (el) el.textContent = fmt(secTot(sec)); } }
    });
  });
}

export function openSecModal() {
  setSecEm('✨'); buildEg('eg-sec', () => secEm, e => setSecEm(e));
  document.getElementById('cs-nm').value = ''; openMo('mo-sec');
}

export function saveSection() {
  const nm = document.getElementById('cs-nm').value.trim(); if (!nm) { alert('Enter name'); return; }
  S.custSecs.push({ id: 'cs' + Date.now(), name: nm, icon: secEm, color: document.getElementById('cs-col').value, isEmi: false, isCustom: true, items: [] });
  cmo(); sv(); renderExp(); rcFn();
}

export function rmCustSec(id) {
  if (!confirm('Delete this section?')) return;
  S.custSecs = S.custSecs.filter(s => s.id !== id); sv(); renderExp(); rcFn();
}

export function openItemModal(sid, isEmi) {
  setICtx(sid, isEmi); setSEm(isEmi ? '📋' : '✨');
  document.getElementById('mo-item-t').textContent = isEmi ? '+ Manual EMI' : '+ Expense Item';
  document.getElementById('ii-nm').value = ''; document.getElementById('ii-amt').value = '';
  buildEg('eg-item', () => sEm, e => setSEm(e)); openMo('mo-item');
}

export function saveItem() {
  const nm = document.getElementById('ii-nm').value.trim(), amt = parseFloat(document.getElementById('ii-amt').value) || 0;
  if (!nm) { alert('Enter name'); return; }
  const item = { id: 'i' + Date.now(), label: sEm + ' ' + nm, val: amt, linked: null };
  if (iCtxSid === 'emi') { const s = S.expSecs.find(x => x.isEmi); if (s) s.items.push(item); }
  else { const s = [...S.expSecs, ...S.custSecs].find(x => x.id === iCtxSid); if (s) s.items.push(item); }
  cmo(); sv(); renderExp(); rcFn();
}

export function rmExpItem(sid, iid, isC) {
  const arr = isC ? S.custSecs : S.expSecs; const sec = arr.find(s => s.id === sid);
  if (sec) { sec.items = sec.items.filter(i => i.id !== iid); sv(); renderExp(); rcFn(); }
}
