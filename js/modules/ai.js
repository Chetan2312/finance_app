// ══════════════════════════════════════
// AI.JS — AI chat module (Phase 6)
// API key input, sessionStorage, Claude API,
// local fallback when no key provided.
// ══════════════════════════════════════
import { N } from '../utils.js';
import { S, sv, getTotalExp } from '../state.js';

// ── API key helpers ──
// Key stored in sessionStorage only — never persisted to localStorage
const KEY_NS = 'ff7_ak';

export function getApiKey() {
  return sessionStorage.getItem(KEY_NS) || '';
}

export function saveApiKey(key) {
  const k = key.trim();
  if (k) {
    sessionStorage.setItem(KEY_NS, k);
  } else {
    sessionStorage.removeItem(KEY_NS);
  }
}

export function clearApiKey() {
  sessionStorage.removeItem(KEY_NS);
}

// ── UI helpers ──
function appMsg(txt, role) {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (role === 'a') div.innerHTML = '<span class="aitg">// FINANCE AI · v7</span>' + escHtml(txt);
  else div.textContent = txt;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function appTyping() {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'msg a';
  div.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

// ── Context builder ──
function buildCtx() {
  const inc = N('s-inc') + N('s-xi'), sav = N('s-sav'), xp = N('s-xp');
  const { total: exp, bd } = getTotalExp();
  const surp = inc - exp - xp;
  const ioD = S.debts.filter(d => d.repay === 'interest' || d.repay === 'bullet');
  const sipV = S.sips.reduce((s, x) => s + (x.curval || 0), 0);
  const sipM = S.sips.reduce((s, x) => s + x.amt, 0);
  const moStr = new Date().toISOString().slice(0, 7);
  const dexMo = S.dailyExps.filter(e => e.date.startsWith(moStr)).reduce((s, e) => s + e.amt, 0);
  const expD = Object.values(bd).filter(b => b.val > 0).map(b => `${b.label}: ₹${Math.round(b.val).toLocaleString('en-IN')}`).join(', ');
  const dD = S.debts.map(d => `${d.name} ₹${Math.round(d.balance).toLocaleString('en-IN')} @${d.rate}% (${d.repay || 'emi'})`).join(' | ');
  const sD = S.sips.map(x => `${x.name} ₹${x.amt}/mo val ₹${Math.round(x.curval || 0).toLocaleString('en-IN')}`).join(' | ');
  return {
    inc, sav, xp, exp, surp, ioD, sipV, sipM, dexMo, expD, dD, sD,
    ctx: `India ₹ | Income ₹${inc}/mo | Exp ₹${exp}/mo | Surplus ₹${surp}/mo | Savings ₹${sav} | Extra debt pay ₹${xp}/mo | Debts: ${dD || 'none'} | IO: ${ioD.map(d => d.name + ' ₹' + d.balance).join(',') || 'none'} | SIPs: ${sD || 'none'} (₹${sipV} val,₹${sipM}/mo) | Daily spend this month ₹${dexMo} | Expenses: ${expD || 'none'} | Strategy: ${S.strat}`
  };
}

// ── Local fallback analysis ──
function localAnalysis(msg) {
  const m = msg.toLowerCase();
  const { inc, sav, xp, exp, surp, ioD, sipV, sipM, dexMo, expD } = buildCtx();

  if (m.includes('debt') || m.includes('loan') || m.includes('emi')) {
    const ioNames = ioD.map(d => d.name).join(', ');
    const totalDebt = S.debts.reduce((s, d) => s + d.balance, 0);
    if (!S.debts.length) return 'You have no debts recorded. Add debts in the Debts tab to get personalised payoff advice.';
    let reply = `Total outstanding debt: ₹${Math.round(totalDebt).toLocaleString('en-IN')}. `;
    if (ioD.length) reply += `Interest-only loans (${ioNames}) are burning cash without reducing principal — prioritise converting these to EMI or clearing them first. `;
    if (xp > 0) reply += `Your ₹${xp.toLocaleString('en-IN')}/mo extra payment is accelerating payoff. `;
    reply += `Using ${S.strat === 'avalanche' ? 'avalanche (highest rate first)' : 'snowball (smallest balance first)'} strategy. Add your Anthropic API key above for a detailed multi-debt payoff timeline.`;
    return reply;
  }

  if (m.includes('sip') || m.includes('invest') || m.includes('mutual fund')) {
    if (!S.sips.length) return 'No SIPs recorded yet. Add them in the SIPs tab to get investment analysis.';
    const gain = sipV - S.sips.reduce((s, x) => s + (x.invested || 0), 0);
    return `You invest ₹${sipM.toLocaleString('en-IN')}/mo across ${S.sips.length} SIP(s). Current portfolio value: ₹${Math.round(sipV).toLocaleString('en-IN')}${gain > 0 ? ` (gain: ₹${Math.round(gain).toLocaleString('en-IN')})` : ''}. For underperformance analysis and rebalancing advice, add your Anthropic API key above.`;
  }

  if (m.includes('daily') || m.includes('spend') || m.includes('pattern')) {
    if (!dexMo) return 'No daily expenses recorded this month. Log some in the Daily tab for spending analysis.';
    const dailyAvg = Math.round(dexMo / new Date().getDate());
    const projected = dailyAvg * 30;
    return `Daily spend this month: ₹${Math.round(dexMo).toLocaleString('en-IN')} (avg ₹${dailyAvg}/day, projected ₹${projected.toLocaleString('en-IN')}/month). ${projected > surp * 0.5 ? 'Daily spending is consuming over 50% of surplus — review discretionary categories.' : 'Daily spending appears controlled.'} Add your API key above for pattern analysis.`;
  }

  if (m.includes('surplus') || m.includes('save') || m.includes('saving')) {
    if (surp <= 0) return `Warning: Your surplus is ₹${Math.round(surp).toLocaleString('en-IN')}. Expenses (₹${Math.round(exp).toLocaleString('en-IN')}) exceed take-home (₹${Math.round(inc).toLocaleString('en-IN')}). Review the Expenses tab to identify cuts.`;
    const sipPct = inc > 0 ? Math.round(sipM / inc * 100) : 0;
    return `Monthly surplus: ₹${Math.round(surp).toLocaleString('en-IN')} (${inc > 0 ? Math.round(surp / inc * 100) : 0}% of income). You invest ₹${sipM.toLocaleString('en-IN')}/mo (${sipPct}% of income). Savings corpus: ₹${Math.round(sav).toLocaleString('en-IN')}. Add your API key above for a full savings optimisation plan.`;
  }

  if (m.includes('plan') || m.includes('12') || m.includes('action')) {
    return `Quick 12-month priorities: 1) Emergency fund target ₹${Math.round(inc * 3).toLocaleString('en-IN')} (3 months income). 2) Clear interest-only loans${ioD.length ? ` (${ioD.map(d => d.name).join(', ')})` : ' — none detected, good'}. 3) Increase SIP by ₹${Math.round(surp * 0.3).toLocaleString('en-IN')}/mo from surplus. 4) Review fixed expenses (₹${Math.round(exp).toLocaleString('en-IN')}/mo) — target 10% cut. Add your API key for a personalised monthly breakdown.`;
  }

  // Generic response
  const savingsRate = inc > 0 ? Math.round((surp / inc) * 100) : 0;
  return `Your finances: Income ₹${Math.round(inc).toLocaleString('en-IN')}/mo | Expenses ₹${Math.round(exp).toLocaleString('en-IN')}/mo | Surplus ₹${Math.round(surp).toLocaleString('en-IN')}/mo (${savingsRate}% savings rate). ${savingsRate < 20 ? 'Savings rate below 20% — look for cuts in: ' + (expD || 'your expense categories') + '.' : 'Good savings rate!'} To unlock full AI-powered advice, add your Anthropic API key in the settings panel above.`;
}

// ── Claude API call ──
async function callClaude(msg, apiKey) {
  const { ctx } = buildCtx();
  S.chatHist.push({ role: 'user', content: msg });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Sharp Indian personal finance advisor. Data: ${ctx}. Concise (4-6 sentences), specific ₹ numbers, encouraging but honest. Minimal emojis. Plain text only, no markdown formatting.`,
      messages: S.chatHist,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }
  const d = await res.json();
  const txt = d.content?.[0]?.text || 'Sorry, no response received.';
  S.chatHist.push({ role: 'assistant', content: txt });
  sv();
  return txt;
}

// ── Main reply handler ──
async function aiReply(msg) {
  const ty = appTyping();
  const apiKey = getApiKey();
  try {
    let txt;
    if (apiKey) {
      txt = await callClaude(msg, apiKey);
    } else {
      // Simulate slight delay for local fallback
      await new Promise(r => setTimeout(r, 300));
      txt = localAnalysis(msg);
    }
    ty.remove();
    appMsg(txt, 'a');
  } catch (e) {
    ty.remove();
    const errMsg = e.message || 'Connection error.';
    if (errMsg.includes('401') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('invalid')) {
      appMsg('Invalid API key. Please check your key in the settings panel above and try again.', 'a');
    } else if (errMsg.includes('429')) {
      appMsg('Rate limit reached. Please wait a moment before sending another message.', 'a');
    } else {
      appMsg(`Error: ${errMsg} Falling back to local analysis.`, 'a');
      const fallback = localAnalysis(msg);
      appMsg(fallback, 'a');
    }
  }
}

// ── Public API ──
export function sq(msg) {
  document.getElementById('chat-in').value = msg;
  sendMsg();
}

export function sendMsg() {
  const inp = document.getElementById('chat-in');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  appMsg(msg, 'u');
  aiReply(msg);
}

// ── API key UI handlers ──
export function toggleApiKeyPanel() {
  const panel = document.getElementById('ai-key-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const inp = document.getElementById('ai-key-inp');
    const key = getApiKey();
    inp.value = key ? '•'.repeat(20) : '';
    inp.placeholder = key ? 'Key saved (session only)' : 'sk-ant-...';
    document.getElementById('ai-key-status').textContent = key ? 'API key active' : 'No key set — using local analysis';
    document.getElementById('ai-key-status').className = 'ai-key-status ' + (key ? 'ok' : 'off');
  }
}

export function applyApiKey() {
  const inp = document.getElementById('ai-key-inp');
  const val = inp.value.trim();
  // If user typed dots (masked), don't overwrite with dots
  if (val && val.replace(/•/g, '').length > 0) {
    if (!val.startsWith('sk-ant-') && !val.startsWith('sk-')) {
      document.getElementById('ai-key-status').textContent = 'Key should start with sk-ant-';
      document.getElementById('ai-key-status').className = 'ai-key-status err';
      return;
    }
    saveApiKey(val);
    inp.value = '•'.repeat(20);
    inp.placeholder = 'Key saved (session only)';
    document.getElementById('ai-key-status').textContent = 'API key saved for this session';
    document.getElementById('ai-key-status').className = 'ai-key-status ok';
  } else if (!val) {
    clearApiKey();
    inp.placeholder = 'sk-ant-...';
    document.getElementById('ai-key-status').textContent = 'API key cleared — using local analysis';
    document.getElementById('ai-key-status').className = 'ai-key-status off';
  }
}

export function clearApiKeyUI() {
  clearApiKey();
  document.getElementById('ai-key-inp').value = '';
  document.getElementById('ai-key-inp').placeholder = 'sk-ant-...';
  document.getElementById('ai-key-status').textContent = 'API key cleared — using local analysis';
  document.getElementById('ai-key-status').className = 'ai-key-status off';
}
