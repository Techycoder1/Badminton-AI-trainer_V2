/* ══════════════════════════════════════════════
   SHUTTLESTEPZ — dashboard.js
   Handles: tabs, XP/level, sessions, leaderboard,
            role views, streaks, profile, manage tab
══════════════════════════════════════════════ */

import { AUTH } from './auth.js';

/* ════════════════════════════════
   CONSTANTS & CONFIG
════════════════════════════════ */
const XP_PER_LEVEL = [0, 500, 1200, 2200, 3500, 5200, 7200, 9800, 13000, 17000, 22000];
const DRILL_META = {
  footwork:  { name: 'Footwork Drill',    icon: '🦶', xp: 20 },
  shadow:    { name: 'Shadow Badminton',  icon: '👤', xp: 30 },
  reflex:    { name: 'Reflex Challenge',  icon: '⚡', xp: 50 },
  endurance: { name: 'Endurance Run',     icon: '🏃', xp: 60 },
};
const STORAGE_KEY = 'stz_user_data';

/* ════════════════════════════════
   STORAGE HELPERS
════════════════════════════════ */
function loadUserData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultUserData();
  } catch { return defaultUserData(); }
}

function saveUserData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function defaultUserData() {
  return {
    xp: 0,
    sessions: [],
    lastSessionDate: null,
    streak: 0,
    bestStreak: 0,
  };
}

/* ════════════════════════════════
   XP / LEVEL HELPERS
════════════════════════════════ */
function getLevel(xp) {
  let lv = 1;
  for (let i = 1; i < XP_PER_LEVEL.length; i++) {
    if (xp >= XP_PER_LEVEL[i]) lv = i + 1;
    else break;
  }
  return Math.min(lv, XP_PER_LEVEL.length);
}

function getLevelProgress(xp) {
  const lv = getLevel(xp);
  const current = XP_PER_LEVEL[lv - 1] || 0;
  const next    = XP_PER_LEVEL[lv]     || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
  const pct = lv >= XP_PER_LEVEL.length ? 1 : (xp - current) / (next - current);
  return { lv, current, next, pct: Math.min(Math.max(pct, 0), 1) };
}

/* ════════════════════════════════
   STREAK HELPER
════════════════════════════════ */
function updateStreak(data) {
  const today = new Date().toDateString();
  const last  = data.lastSessionDate;
  if (last === today) return; // already trained today — no double-count
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (last === yesterday) {
    data.streak += 1;
  } else {
    data.streak = 1;
  }
  data.bestStreak = Math.max(data.streak, data.bestStreak || 0);
  data.lastSessionDate = today;
}

/* ════════════════════════════════
   TAB SWITCHING
════════════════════════════════ */
window.switchTab = function(tab) {
  // panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');

  // nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === tab);
  });

  // topbar title
  const titles = {
    overview:    'Overview',
    train:       'Train',
    history:     'History',
    leaderboard: 'Leaderboard',
    manage:      'Manage',
    profile:     'Profile',
  };
  const tt = document.getElementById('topbar-title');
  if (tt) tt.textContent = titles[tab] || tab;

  // close sidebar on mobile
  closeSidebar();

  // lazy-load leaderboard
  if (tab === 'leaderboard') renderLeaderboard();
};

/* ════════════════════════════════
   SIDEBAR TOGGLE (mobile)
════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

/* ════════════════════════════════
   GREETING
════════════════════════════════ */
function setGreeting(name) {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const el = document.getElementById('greeting-time');
  const nel = document.getElementById('greeting-name');
  if (el)  el.textContent  = time;
  if (nel) nel.textContent = name || 'Athlete';
}

/* ════════════════════════════════
   XP UI
════════════════════════════════ */
function renderXP(xp) {
  const { lv, next, pct } = getLevelProgress(xp);
  const xpInLevel = xp - (XP_PER_LEVEL[lv - 1] || 0);
  const xpNeeded  = next - (XP_PER_LEVEL[lv - 1] || 0);

  // Sidebar mini bar
  setText('sb-xp-label',    xp + ' XP');
  setText('sb-level-label', 'Lv.' + lv);
  setWidth('sb-xp-fill',    pct * 100);

  // Topbar
  setText('topbar-xp', xp + ' XP');

  // XP card ring
  const circumference = 213.6;
  const arc = document.getElementById('ring-arc');
  if (arc) arc.style.strokeDashoffset = circumference - pct * circumference;
  setText('ring-lv', lv);

  // XP card text
  setText('xp-total', xp.toLocaleString() + ' XP');
  setText('xp-next',
    lv >= XP_PER_LEVEL.length
      ? 'Max Level!'
      : xpInLevel.toLocaleString() + ' / ' + xpNeeded.toLocaleString() + ' to Level ' + (lv + 1)
  );
  setWidth('xp-fill-lg', pct * 100);
}

/* ════════════════════════════════
   STATS UI
════════════════════════════════ */
function renderStats(data, globalRank) {
  const sessions    = data.sessions || [];
  const totalSess   = sessions.length;
  const totalXP     = data.xp || 0;
  const streak      = data.streak || 0;
  const bestStreak  = data.bestStreak || 0;

  // Overview badges
  setText('stat-sessions', totalSess);
  setText('stat-streak',   streak + '🔥');
  setText('stat-rank',     globalRank ? '#' + globalRank : '#—');

  // History stats
  setText('h-total-sessions', totalSess);
  setText('h-total-xp',       totalXP.toLocaleString());
  setText('h-best-streak',    bestStreak + '🔥');

  // Avg score
  const scored = sessions.filter(s => s.score != null);
  const avg = scored.length
    ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length)
    : null;
  setText('h-avg-score', avg != null ? avg + '%' : '—');
}

/* ════════════════════════════════
   SESSIONS UI
════════════════════════════════ */
function renderSessions(sessions) {
  const sorted = [...(sessions || [])].sort((a, b) => b.ts - a.ts);

  // Overview — last 3
  const oEl = document.getElementById('overview-sessions');
  const oEmpty = document.getElementById('sessions-empty');
  if (oEl) {
    if (sorted.length === 0) {
      if (oEmpty) oEmpty.style.display = '';
    } else {
      if (oEmpty) oEmpty.style.display = 'none';
      const slice = sorted.slice(0, 3);
      const existing = oEl.querySelectorAll('.session-item');
      existing.forEach(e => e.remove());
      slice.forEach(s => oEl.appendChild(makeSessionEl(s)));
    }
  }

  // History — all
  const hEl = document.getElementById('history-sessions');
  if (hEl) {
    hEl.innerHTML = '';
    if (sorted.length === 0) {
      hEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>No sessions recorded yet. Complete a drill to see your history here.</div></div>`;
    } else {
      sorted.forEach(s => hEl.appendChild(makeSessionEl(s)));
    }
  }
}

function makeSessionEl(s) {
  const meta = DRILL_META[s.drill] || { name: s.drill, icon: '🏸', xp: 0 };
  const date = new Date(s.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const el = document.createElement('div');
  el.className = 'session-item';
  el.innerHTML = `
    <div class="session-icon">${meta.icon}</div>
    <div class="session-info">
      <div class="session-name">${meta.name}</div>
      <div class="session-meta">${date}${s.duration ? ' · ' + Math.round(s.duration / 60) + ' min' : ''}</div>
    </div>
    ${s.score != null ? `<div class="session-score">${s.score}%</div>` : ''}
    <div class="session-xp">+${s.xpEarned || meta.xp} XP</div>
  `;
  return el;
}

/* ════════════════════════════════
   LEADERBOARD
════════════════════════════════ */
async function renderLeaderboard() {
  const lbEl = document.getElementById('lb-list');
  if (!lbEl) return;

  // Try to pull from your backend / Firebase
  // For now we build a demo list with the current user at the right XP
  const user     = AUTH.currentUser?.();
  const userData = loadUserData();
  const myXP     = userData.xp || 0;
  const myName   = user?.displayName || user?.email?.split('@')[0] || 'You';

  // Simulated global board — replace with real Firestore fetch
  const board = await fetchLeaderboard(myName, myXP);

  // Sort
  board.sort((a, b) => b.xp - a.xp);
  const myIdx = board.findIndex(e => e.isMe);

  // Your rank card
  setText('lb-rank-num',  myIdx >= 0 ? '#' + (myIdx + 1) : '#—');
  setText('lb-rank-name', myName);
  setText('lb-rank-xp',   myXP.toLocaleString() + ' XP');

  // List
  lbEl.innerHTML = '';
  board.slice(0, 50).forEach((entry, i) => {
    const pos = i + 1;
    const posClass = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : '';
    const posEmoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    const el = document.createElement('div');
    el.className = 'lb-item' + (entry.isMe ? ' lb-item--me' : '');
    el.innerHTML = `
      <div class="lb-pos ${posClass}">${posEmoji}</div>
      <div class="lb-avatar">${entry.avatar}</div>
      <div class="lb-name-col">
        <div class="lb-lb-name">${entry.name}</div>
        <div class="lb-lb-role">${entry.role || 'Student'}</div>
      </div>
      <div class="lb-xp-val">${entry.xp.toLocaleString()} XP</div>
    `;
    lbEl.appendChild(el);
  });
}

/* Replace this with a real Firestore / Supabase fetch */
async function fetchLeaderboard(myName, myXP) {
  const demo = [
    { name: 'Arjun Reddy',   xp: 4820, role: 'Student',  avatar: 'A' },
    { name: 'Priya Sharma',  xp: 4200, role: 'Student',  avatar: 'P' },
    { name: 'Coach Venkat',  xp: 3900, role: 'Coach',    avatar: 'V' },
    { name: 'Kavya Nair',    xp: 3400, role: 'Student',  avatar: 'K' },
    { name: 'Rohan Mehta',   xp: 2800, role: 'Student',  avatar: 'R' },
    { name: 'Sneha Patel',   xp: 2200, role: 'Student',  avatar: 'S' },
    { name: 'Dev Iyer',      xp: 1800, role: 'Student',  avatar: 'D' },
    { name: 'Meera Singh',   xp: 1500, role: 'Student',  avatar: 'M' },
    { name: 'Tanvi Joshi',   xp:  900, role: 'Student',  avatar: 'T' },
    { name: 'Nikhil Das',    xp:  600, role: 'Student',  avatar: 'N' },
  ];
  // Insert the real user at correct XP
  const meEntry = { name: myName, xp: myXP, role: 'Student', avatar: myName[0]?.toUpperCase() || '?', isMe: true };
  return [...demo, meEntry];
}

/* ════════════════════════════════
   PROFILE TAB
════════════════════════════════ */
function renderProfile(user) {
  const name  = user?.displayName || user?.email?.split('@')[0] || '—';
  const email = user?.email || '—';
  const role  = user?.role  || 'Student';
  const plan  = user?.plan  || 'Free';
  const initials = name.slice(0, 2).toUpperCase();

  setText('profile-name',      name);
  setText('profile-email',     email);
  setText('profile-role-pill', role);
  setText('profile-avatar',    initials);
  setText('settings-username', name);
  setText('settings-email',    email);
  setText('settings-plan',     plan);

  // Hide upgrade button if already premium
  const btn = document.getElementById('btn-upgrade');
  if (btn) btn.style.display = plan === 'Free' ? '' : 'none';
}

/* ════════════════════════════════
   MANAGE TAB (Teacher / Coach)
════════════════════════════════ */
function renderManageTab(user) {
  const role = user?.role;
  const isStaff = role === 'Teacher' || role === 'Coach' || role === 'Admin';

  const navManage = document.getElementById('nav-manage');
  if (navManage) navManage.style.display = isStaff ? '' : 'none';

  if (!isStaff) return;

  // Adjust labels
  const label = role === 'Coach' ? 'Athletes' : 'Students';
  setText('nav-manage-label', label);
  setText('manage-title',     'Manage ' + label);
  setText('manage-sub',       label + ' linked to your school/club code.');

  // School code
  const code = user?.schoolCode || generateCode(user?.uid || 'DEMO');
  setText('manage-code', code);

  // Load linked students — replace with real fetch
  loadLinkedStudents(code);
}

function generateCode(uid) {
  // Deterministic 6-char code from uid
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 0;
  for (const c of uid) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  let code = '';
  for (let i = 0; i < 6; i++) { code += chars[hash % chars.length]; hash = Math.floor(hash / chars.length); }
  return code;
}

async function loadLinkedStudents(code) {
  // Replace with real Firestore query: students where schoolCode == code
  const el = document.getElementById('manage-list');
  if (!el) return;

  // Demo empty state (replace with real data)
  el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div>No students linked yet. Share code <strong>${code}</strong> to get started.</div></div>`;
}

/* ════════════════════════════════
   DRILL LAUNCHER
════════════════════════════════ */
window.startDrill = function(drillId) {
  const meta = DRILL_META[drillId];
  if (!meta) return;

  // Highlight selected card
  document.querySelectorAll('.drill-card').forEach(c => c.style.borderColor = '');
  const cards = document.querySelectorAll('.drill-card');
  cards.forEach(c => {
    if (c.getAttribute('onclick')?.includes(drillId)) {
      c.style.borderColor = 'rgba(57,224,122,.5)';
    }
  });

  // Update camera box
  const box = document.getElementById('camera-box');
  if (box) {
    box.innerHTML = `
      <div class="camera-inner">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <div class="camera-label">${meta.icon} ${meta.name} — Camera initialising…</div>
        <div class="camera-sub">Allow camera access when prompted. No video is stored.</div>
        <button onclick="simulateSessionComplete('${drillId}')" style="
          margin-top:18px; background:var(--accent); color:#0a0d0f;
          border:none; border-radius:8px; padding:10px 24px;
          font-size:13px; font-weight:700; cursor:pointer;
        ">Simulate Complete Session ▶</button>
      </div>`;
  }
};

/* ── Simulate a completed session (dev / demo) ── */
window.simulateSessionComplete = function(drillId) {
  const meta  = DRILL_META[drillId];
  const data  = loadUserData();
  const score = Math.floor(60 + Math.random() * 40);

  updateStreak(data);

  data.xp += meta.xp;
  data.sessions.push({
    drill:     drillId,
    ts:        Date.now(),
    xpEarned:  meta.xp,
    score,
    duration:  180 + Math.floor(Math.random() * 120),
  });

  saveUserData(data);
  showNotice(`+${meta.xp} XP earned! Great ${meta.name} session 🏸`);
  bootDashboard(); // re-render everything
  switchTab('overview');
};

/* ════════════════════════════════
   UPGRADE (stub)
════════════════════════════════ */
window.upgradeToPremium = function() {
  showNotice('Premium coming soon! Stay tuned 🌟');
};

/* ════════════════════════════════
   NOTICE BANNER
════════════════════════════════ */
function showNotice(msg) {
  const banner = document.getElementById('notice-banner');
  const msgEl  = document.getElementById('notice-msg');
  if (banner && msgEl) {
    msgEl.textContent = msg;
    banner.style.display = 'flex';
    clearTimeout(window._noticeTimer);
    window._noticeTimer = setTimeout(() => { banner.style.display = 'none'; }, 5000);
  }
}

/* ════════════════════════════════
   DOM HELPERS
════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct + '%';
}

/* ════════════════════════════════
   ROLE BADGE
════════════════════════════════ */
function setRoleBadge(role) {
  const el = document.getElementById('role-badge');
  if (el) el.textContent = role || 'Student';
}

/* ════════════════════════════════
   BOOT
════════════════════════════════ */
async function bootDashboard() {
  // 1. Auth guard
  const user = AUTH.currentUser?.() || {};

  // 2. Load persisted data
  const data = loadUserData();

  // 3. Greeting
  setGreeting(user?.displayName || user?.email?.split('@')[0]);

  // 4. Role
  const role = user?.role || 'Student';
  setRoleBadge(role);

  // 5. XP
  renderXP(data.xp || 0);

  // 6. Stats (rank placeholder — replace with real global fetch)
  renderStats(data, null);

  // 7. Sessions
  renderSessions(data.sessions);

  // 8. Profile
  renderProfile(user);

  // 9. Manage tab (staff only)
  renderManageTab(user);
}

/* ── Run on load ── */
document.addEventListener('DOMContentLoaded', () => {
  bootDashboard();
  switchTab('overview'); // ensure correct starting tab
});
