// ══════════════════════════════════════
// DEBTS — debt cards, CRUD, strategy toggle
// ══════════════════════════════════════
import { fmt } from '../utils.js';
import { DICONS, COLS } from '../../data/defaults.js';
import { S, sv } from '../state.js';
import { openMo, cmo } from './modals.js';
import { renderExp } from './expenses.js';

let rcFn = () => {};
export function setRcFn(fn) { rcFn = fn; }

export function upRepHint() {
  const h = { emi: 'Standard reducing EMI — balance reduces each month.', interest: '⚠️ Interest-Only: pay only interest monthly. Full principal due at closure. Tracked in Milestones.', bullet: '🎯 Bullet loan: minimal payments, full amount at maturity.' };
  document.getElementById('rp-hint').textContent = h[document.getElementById('d-rp').value] || '';
}

export function openDebtModal(id) {
  document.getElementById('debt-edit-id') || document.getElementById('d-eid').setAttribute('id', 'debt-edit-id');
  document.getElementById('d-eid').value = id || ''; document.getElementById('mo-debt-t').textContent = id ? '✏️ Edit Debt' : '💳 Add Debt';
  if (id) {
    const d = S.debts.find(x => x.id === id);
    if (d) { document.getElementById('d-nm').value = d.name; document.getElementById('d-bal').value = d.balance; document.getElementById('d-rt').value = d.rate; document.getElementById('d-emi').value = d.emi; document.getElementById('d-tp').value = d.type; document.getElementById('d-rp').value = d.repay || 'emi'; document.getElementById('d-tn').value = d.tenor || ''; }
  } else {
    ['d-nm', 'd-bal', 'd-rt', 'd-emi', 'd-tn'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('d-tp').value = 'home'; document.getElementById('d-rp').value = 'emi';
  }
  upRepHint(); openMo('mo-debt');
}

export function saveDebt() {
  const nm = document.getElementById('d-nm').value.trim(), bal = parseFloat(document.getElementById('d-bal').value) || 0, rt = parseFloat(document.getElementById('d-rt').value) || 0, emi = parseFloat(document.getElementById('d-emi').value) || 0, tp = document.getElementById('d-tp').value, rp = document.getElementById('d-rp').value, tn = parseInt(document.getElementById('d-tn').value) || 0;
  if (!nm || !bal || !rt) { alert('Fill Name, Balance, Rate'); return; }
  const eid = document.getElementById('d-eid').value;
  if (eid) { const d = S.debts.find(x => x.id === eid); if (d) Object.assign(d, { name: nm, balance: bal, rate: rt, emi, type: tp, repay: rp, tenor: tn }); }
  else S.debts.push({ id: 'd' + Date.now(), name: nm, balance: bal, original: bal, rate: rt, emi, type: tp, repay: rp, tenor: tn, color: COLS[S.debts.length % COLS.length] });
  cmo(); sv(); renderExp(); renderDebts(); rcFn();
}

export function rmDebt(id) {
  if (!confirm('Remove debt?')) return;
  S.debts = S.debts.filter(d => d.id !== id); sv(); renderExp(); renderDebts(); rcFn();
}

export function setSt(s) {
  S.strat = s;
  document.getElementById('st-av').classList.toggle('on', s === 'avalanche');
  document.getElementById('st-sn').classList.toggle('on', s === 'snowball');
  sv(); renderDebts(); rcFn();
}

export function renderDebts() {
  const el = document.getElementById('dbt-list');
  if (!S.debts.length) { el.innerHTML = '<div class="empty"><span class="empty-ic">💳</span>No debts yet.</div>'; return; }
  const sorted = S.strat === 'avalanche' ? [...S.debts].sort((a, b) => b.rate - a.rate) : [...S.debts].sort((a, b) => a.balance - b.balance);
  el.innerHTML = sorted.map((d, i) => {
    const prog = d.original > 0 ? Math.min(100, (1 - d.balance / d.original) * 100) : 0;
    return `<div class="dcard"><div class="dcard-stripe" style="background:${d.color}"></div><div class="dcard-hd"><div class="dcard-ico" style="background:${d.color}18;color:${d.color}">${DICONS[d.type] || '🏦'}</div><div class="dcard-ti"><div class="dcard-nm">${d.name}${i === 0 ? '<span class="bdg bdg-p">TARGET</span>' : ''}${d.repay === 'interest' ? '<span class="bdg bdg-dan">INT-ONLY</span>' : d.repay === 'bullet' ? '<span class="bdg bdg-warn">BULLET</span>' : '<span class="bdg bdg-sky">🔗</span>'}</div><div class="dcard-mt">${d.rate}% p.a. · ${d.repay === 'interest' ? 'Interest-Only' : 'Reducing EMI'}${d.tenor ? ' · ' + d.tenor + 'mo left' : ''}</div><div class="pb mt05"><div class="pbf" style="width:${prog}%;background:${d.color}"></div></div></div><div class="dcard-rt"><div class="dcard-amt" style="color:${d.color}">${fmt(d.balance)}</div><div class="xxs c-muted">${fmt(d.emi)}/mo</div></div></div><div class="dcard-acts"><button class="btn bg bsm" onclick="openDebtModal('${d.id}')">✏️ Edit</button><button class="btn bd bsm" onclick="rmDebt('${d.id}')">✕ Remove</button></div></div>`;
  }).join('');
  const mp = S.debts.reduce((s, d) => s + d.emi, 0);
  document.getElementById('dbt-stats').innerHTML = `Total: <span style="color:var(--rose)">${fmt(S.debts.reduce((s, d) => s + d.balance, 0))}</span> · EMIs: ${fmt(mp)}/mo`;
}
