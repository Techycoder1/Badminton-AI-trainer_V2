/* ============================================================
   Shuttlestepz — dashboard.js
   Wires up the sidebar dashboard: tabs, XP ring,
   leaderboard, session history, manage tab, profile
   ============================================================ */

// ── Tab switching ─────────────────────────────────────────────
const TAB_TITLES = {
  overview   : 'Overview',
  train      : 'Train',
  history    : 'History',
  leaderboard: 'Leaderboard',
  manage     : 'Students',
  profile    : 'Profile',
}

function switchTab(name) {
  // Panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  const panel = document.getElementById(`tab-${name}`)
  if (panel) panel.classList.add('active')

  // Nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === name)
  })

  // Mobile topbar title
  const ttEl = document.getElementById('topbar-title')
  if (ttEl) ttEl.textContent = TAB_TITLES[name] || name

  // Lazy load leaderboard when opened
  if (name === 'leaderboard') loadLeaderboard()
  if (name === 'manage')      loadManage()

  // Close sidebar on mobile
  closeSidebar()
}

// ── Sidebar toggle (mobile) ───────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open')
  document.getElementById('sidebar-overlay').classList.toggle('open')
  document.body.style.overflow =
    document.getElementById('sidebar').classList.contains('open') ? 'hidden' : ''
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebar-overlay').classList.remove('open')
  document.body.style.overflow = ''
}

// ── XP Ring ───────────────────────────────────────────────────
function setXPRing(progress) {
  const CIRC = 2 * Math.PI * 34  // r=34 → 213.6
  const arc  = document.getElementById('ring-arc')
  if (!arc) return
  const offset = CIRC * (1 - Math.max(0, Math.min(1, progress / 100)))
  arc.style.strokeDashoffset = offset
}

// ── Greeting ──────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// ── Format date ───────────────────────────────────────────────
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}
function fmtDateFull(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

// ── Drill launcher ────────────────────────────────────────────
function startDrill(mode) {
  if (!window.AUTH) return
  if (!AUTH.canStartSession()) {
    showNotice('You have reached your 5 daily sessions. Upgrade to Premium to continue training today.', true)
    return
  }
  // Store selected mode for trainer page
  sessionStorage.setItem('ssz_drill_mode', mode)
  window.location.href = 'trainer.html'
}

// ── Notice banner ─────────────────────────────────────────────
function showNotice(msg, isWarning = false) {
  const el = document.getElementById('notice-banner')
  const msgEl = document.getElementById('notice-msg')
  if (!el || !msgEl) return
  msgEl.textContent = msg
  el.style.display = 'flex'
  if (isWarning) el.style.borderColor = 'rgba(240,144,64,0.4)'
}

// ── Upgrade handler ───────────────────────────────────────────
async function upgradeToPremium() {
  if (!window.AUTH) return
  const user = AUTH.currentUser()
  if (!user) return
  if (confirm('Simulate upgrade to Premium?\n(Demo — no payment required)')) {
    await AUTH.upgradePlan(user.uid, 'premium')
    window.location.reload()
  }
}

// ── Draw performance chart ────────────────────────────────────
function drawChart(canvas, data) {
  if (!canvas) return
  canvas.width  = (canvas.parentElement?.clientWidth || 600) - 48
  canvas.height = 100
  const c   = canvas.getContext('2d')
  const w   = canvas.width, h = canvas.height
  const max = Math.max(...data) * 1.15 || 1
  const pad = 20

  c.clearRect(0, 0, w, h)

  // Grid lines
  c.strokeStyle = 'rgba(56,210,90,0.06)'
  c.lineWidth = 1
  for (let i = 0; i <= 3; i++) {
    const y = pad + (i / 3) * (h - pad * 2)
    c.beginPath(); c.moveTo(pad, y); c.lineTo(w - pad, y); c.stroke()
  }

  if (data.length === 1) {
    // Single point
    const cx = w / 2, cy = h / 2
    c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2)
    c.fillStyle = '#38d25a'; c.fill()
    c.fillStyle = 'rgba(56,210,90,0.6)'
    c.font = "9px 'DM Mono', monospace"; c.textAlign = 'center'
    c.fillText(data[0], cx, cy - 14)
    c.fillStyle = 'rgba(56,210,90,0.3)'; c.font = "10px 'DM Mono', monospace"
    c.fillText('Complete more sessions to see your trend', cx, h - 6)
    return
  }

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - (v / max) * (h - pad * 2),
  }))

  // Area fill
  const grad = c.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(56,210,90,0.18)')
  grad.addColorStop(1, 'rgba(56,210,90,0)')
  c.beginPath(); c.moveTo(pts[0].x, h)
  pts.forEach(p => c.lineTo(p.x, p.y))
  c.lineTo(pts[pts.length-1].x, h); c.closePath()
  c.fillStyle = grad; c.fill()

  // Line
  c.beginPath(); c.strokeStyle = 'rgba(56,210,90,0.85)'; c.lineWidth = 2
  pts.forEach((p, i) => i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y))
  c.stroke()

  // Dots + labels
  pts.forEach((p, i) => {
    const isLast = i === pts.length - 1
    c.beginPath(); c.arc(p.x, p.y, isLast ? 5 : 3, 0, Math.PI * 2)
    c.fillStyle = isLast ? '#38d25a' : 'rgba(56,210,90,0.5)'; c.fill()
    c.fillStyle = 'rgba(56,210,90,0.55)'
    c.font = "9px 'DM Mono', monospace"; c.textAlign = 'center'
    c.fillText(data[i], p.x, p.y - 9)
  })
}

// ── Direction accuracy rows ───────────────────────────────────
function renderDirAccuracy(dirStats) {
  const container = document.querySelector('#tab-overview #dir-accuracy-widget')
  if (!container) return
  const entries = Object.entries(dirStats || {}).filter(([,s]) => s.total > 0)
  if (!entries.length) return
  container.innerHTML = entries
    .sort((a,b) => (b[1].hit/b[1].total) - (a[1].hit/a[1].total))
    .map(([dir, s]) => {
      const pct = Math.round((s.hit / s.total) * 100)
      const col = pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text2);min-width:88px">${dir}</div>
        <div style="flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:${col};min-width:34px;text-align:right">${pct}%</div>
      </div>`
    }).join('')
}

// ── Load leaderboard ──────────────────────────────────────────
async function loadLeaderboard() {
  if (!window.AUTH) return
  const lbList = document.getElementById('lb-list')
  if (!lbList || lbList.dataset.loaded) return

  lbList.innerHTML = '<div class="lb-loading">Loading…</div>'
  const board = await AUTH.getLeaderboard(20)
  const user  = AUTH.currentUser()

  if (!board.length) {
    lbList.innerHTML = '<div class="lb-loading">No entries yet. Complete a session to appear here!</div>'
    return
  }

  // Find user rank
  const myRank = board.findIndex(e => e.id === user?.uid)
  if (myRank !== -1) {
    document.getElementById('lb-rank-num').textContent  = `#${myRank + 1}`
    document.getElementById('lb-rank-name').textContent = user.username || 'You'
    document.getElementById('lb-rank-xp').textContent   = `${board[myRank].bestScore || 0} pts`
  }

  lbList.innerHTML = board.map((e, i) => {
    const rankStr = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`
    const isMe    = e.id === user?.uid
    return `<div class="lb-entry">
      <div class="lb-entry-rank">${rankStr}</div>
      <div class="lb-entry-name ${isMe ? 'is-me' : ''}">
        ${e.username || 'Player'}
        ${e.plan === 'premium' ? '<span style="color:var(--gold);font-size:10px;margin-left:4px">⭐</span>' : ''}
        ${isMe ? '<span style="font-size:9px;color:var(--text3)"> (you)</span>' : ''}
      </div>
      <div class="lb-entry-level">Lv.${e.level || 1}</div>
      <div class="lb-entry-score">${e.bestScore || 0}</div>
    </div>`
  }).join('')

  lbList.dataset.loaded = '1'
}

// ── Load manage (teacher/coach) ───────────────────────────────
async function loadManage() {
  if (!window.AUTH) return
  const user = AUTH.currentUser()
  if (!user?.schoolId) return
  const list = document.getElementById('manage-list')
  if (!list || list.dataset.loaded) return

  list.innerHTML = '<div class="lb-loading">Loading students…</div>'
  const students = await AUTH.getClassStats(user.schoolId)

  if (!students.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👥</div>
      <div>No students linked yet. Share your school code to get started.</div>
    </div>`
    return
  }

  list.innerHTML = students.map(s => `
    <div class="student-row">
      <div class="student-avatar">${(s.username||'?')[0].toUpperCase()}</div>
      <div class="student-name">${s.username}</div>
      <div class="student-level">Lv.${s.level}</div>
      <div class="student-xp">${s.xp} XP</div>
    </div>`).join('')

  list.dataset.loaded = '1'
}

// ── Main init ─────────────────────────────────────────────────
window.addEventListener('load', async () => {

  // Wait for Firebase modules
  await new Promise(r => setTimeout(r, 450))

  if (!window.AUTH) {
    console.error('[Dashboard] AUTH not loaded')
    return
  }

  // Require auth
  const user = AUTH.requireAuth('login.html')
  if (!user) return

  // Apply role class to body for CSS visibility rules
  if (user.role) document.body.classList.add(`role-${user.role}`)

  // Show/hide manage nav item
  const navManage = document.getElementById('nav-manage')
  if (navManage) {
    navManage.style.display = (user.role === 'teacher' || user.role === 'coach') ? 'flex' : 'none'
    const lbl = document.getElementById('nav-manage-label')
    if (lbl) lbl.textContent = user.role === 'coach' ? 'My Players' : 'Students'
  }

  // Set manage tab title
  if (user.role === 'coach') {
    const mt = document.getElementById('manage-title')
    const ms = document.getElementById('manage-sub')
    if (mt) mt.textContent = 'Manage Players'
    if (ms) ms.textContent = 'Players linked to your club code.'
  }

  // School code
  const codeEl = document.getElementById('manage-code')
  if (codeEl) codeEl.textContent = user.schoolId || '—'

  // Role badge
  const roleBadge = document.getElementById('role-badge')
  if (roleBadge) roleBadge.textContent = (user.role || 'student').charAt(0).toUpperCase() + user.role?.slice(1)

  // Greeting
  const grEl = document.getElementById('greeting-time')
  const gnEl = document.getElementById('greeting-name')
  if (grEl) grEl.textContent = getGreeting()
  if (gnEl) gnEl.textContent = user.username || 'Athlete'

  // Sidebar XP (initial)
  const lvlInfo = AUTH.calcLevel(user.xp || 0)
  const sbXP  = document.getElementById('sb-xp-label')
  const sbLv  = document.getElementById('sb-level-label')
  const sbFil = document.getElementById('sb-xp-fill')
  if (sbXP)  sbXP.textContent  = `${user.xp || 0} XP`
  if (sbLv)  sbLv.textContent  = `Lv.${lvlInfo.level}`
  if (sbFil) sbFil.style.width = `${lvlInfo.progress}%`

  // Topbar XP
  const tbXP = document.getElementById('topbar-xp')
  if (tbXP) tbXP.textContent = `${user.xp || 0} XP`

  // ── Profile tab — use stats (Firestore) as source of truth ──────
  const profAvatar  = document.getElementById('profile-avatar')
  const profName    = document.getElementById('profile-name')
  const profEmail   = document.getElementById('profile-email')
  const profRole    = document.getElementById('profile-role-pill')
  const setUser     = document.getElementById('settings-username')
  const setEmail    = document.getElementById('settings-email')
  const setPlan     = document.getElementById('settings-plan')
  const btnUpgrade  = document.getElementById('btn-upgrade')

  // Use firebase displayName → cache username → fallback
  const displayName = user.username || user.displayName || '—'
  const roleCap     = (user.role || 'student').charAt(0).toUpperCase() + (user.role || 'student').slice(1)

  if (profAvatar) profAvatar.textContent = displayName[0]?.toUpperCase() || '?'
  if (profName)   profName.textContent   = displayName
  if (profEmail)  profEmail.textContent  = user.email || '—'
  if (profRole)   profRole.textContent   = roleCap
  if (setUser)    setUser.textContent    = displayName
  if (setEmail)   setEmail.textContent   = user.email || '—'
  if (setPlan) {
    if (user.plan === 'premium') {
      setPlan.innerHTML = '⭐ <span style="color:var(--gold)">Premium</span>'
      if (btnUpgrade) btnUpgrade.style.display = 'none'
    } else {
      setPlan.textContent = 'Free — 5 sessions/day'
    }
  }

  // ── Fetch real stats from Firestore ──────────────────────────
  let stats = null
  try {
    stats = await AUTH.currentStats()
  } catch(e) {
    console.error('[Dashboard] stats error', e)
  }

  if (!stats) {
    return
  }

  // ── Update profile with real Firestore data ───────────────────
  const fsName = stats.username || user.username || '—'
  if (profAvatar) profAvatar.textContent = fsName[0]?.toUpperCase() || '?'
  if (profName)   profName.textContent   = fsName
  if (setUser)    setUser.textContent    = fsName
  if (grEl)       gnEl.textContent       = fsName.split(' ')[0]

  // ── XP card ───────────────────────────────────────────────────
  const lvl = AUTH.calcLevel(stats.xp || 0)
  setXPRing(lvl.progress)

  const ringLv    = document.getElementById('ring-lv')
  const xpTotal   = document.getElementById('xp-total')
  const xpNext    = document.getElementById('xp-next')
  const xpFillLg  = document.getElementById('xp-fill-lg')
  const statSess  = document.getElementById('stat-sessions')
  const statStrk  = document.getElementById('stat-streak')
  const statRank  = document.getElementById('stat-rank')

  if (ringLv)   ringLv.textContent   = lvl.level
  if (xpTotal)  xpTotal.textContent  = `${stats.xp} XP`
  if (xpNext)   xpNext.textContent   = lvl.next
    ? `${stats.xp - lvl.xp} / ${lvl.next.xp - lvl.xp} to Level ${lvl.next.level}`
    : 'MAX LEVEL'
  if (xpFillLg) xpFillLg.style.width = `${lvl.progress}%`
  if (statSess) statSess.textContent = stats.totalSessions || 0
  if (statStrk) statStrk.textContent = `${stats.streak || 0}🔥`

  // Update sidebar too
  if (sbXP)  sbXP.textContent  = `${stats.xp} XP`
  if (sbLv)  sbLv.textContent  = `Lv.${lvl.level}`
  if (sbFil) sbFil.style.width = `${lvl.progress}%`
  if (tbXP)  tbXP.textContent  = `${stats.xp} XP`

  // ── History tab stats ─────────────────────────────────────────
  const hSess  = document.getElementById('h-total-sessions')
  const hXP    = document.getElementById('h-total-xp')
  const hStrk  = document.getElementById('h-best-streak')
  const hAvg   = document.getElementById('h-avg-score')

  if (hSess) hSess.textContent = stats.totalSessions || 0
  if (hXP)   hXP.textContent  = stats.xp || 0
  if (hStrk) hStrk.textContent = `${stats.bestStreak || 0}🔥`
  if (hAvg && stats.history?.length) {
    const avg = Math.round(stats.history.reduce((a,s) => a + s.score, 0) / stats.history.length)
    hAvg.textContent = avg
  }

  // ── Session limiter ───────────────────────────────────────────
  if (user.plan !== 'premium') {
    const remaining = AUTH.sessionsRemaining()
    const sbCount   = document.querySelector('.sb-count')
    const sbProg    = document.getElementById('sessions-progress')
    if (sbCount) {
      sbCount.textContent = remaining === 0
        ? 'No sessions left today'
        : `${remaining} of 5 remaining`
      sbCount.className   = 'sb-count' + (remaining === 0 ? ' empty' : remaining <= 2 ? ' warning' : '')
    }
    if (sbProg) {
      sbProg.style.width      = `${(remaining / 5) * 100}%`
      sbProg.style.background = remaining === 0 ? 'var(--red)' : remaining <= 2 ? 'var(--amber)' : 'var(--accent)'
    }
  } else {
    const sessionBar = document.querySelector('.session-bar')
    const upgBanner  = document.getElementById('upgrade-banner') || document.querySelector('.upgrade-banner')
    if (sessionBar) sessionBar.style.display = 'none'
    if (upgBanner)  upgBanner.style.display  = 'none'
  }

  // ── Overview recent sessions ──────────────────────────────────
  const ovSessions = document.getElementById('overview-sessions')
  const sessEmpty  = document.getElementById('sessions-empty')
  const history    = stats.history || []

  if (history.length > 0 && ovSessions) {
    if (sessEmpty) sessEmpty.style.display = 'none'
    history.slice(0, 5).forEach(s => {
      const row = document.createElement('div')
      row.className = 'session-row'
      row.innerHTML = `
        <div class="session-date">${fmtDate(s.date)}</div>
        <div class="session-mode">${s.mode || 'footwork'}</div>
        <div class="session-score">${s.score}</div>
        <div class="session-acc">${s.accuracy}% acc · ${s.rounds} rounds</div>
        <div class="session-xp">+${s.xpEarned || 0} XP</div>`
      ovSessions.appendChild(row)
    })
  }

  // ── History tab — progress chart ─────────────────────────────
  const histChart      = document.getElementById('history-chart')
  const histChartEmpty = document.getElementById('history-chart-empty')
  if (history.length >= 1 && histChart) {
    histChart.style.display = 'block'
    if (histChartEmpty) histChartEmpty.style.display = 'none'
    drawChart(histChart, history.map(s => s.score).reverse())
  } else if (histChart) {
    histChart.style.display = 'none'
    if (histChartEmpty) histChartEmpty.style.display = 'block'
  }

  // ── History sessions (full list) ──────────────────────────────
  const histSessions = document.getElementById('history-sessions')
  if (history.length > 0 && histSessions) {
    histSessions.innerHTML = history.map(s => `
      <div class="session-row">
        <div class="session-date">${fmtDateFull(s.date)}</div>
        <div class="session-mode">${s.mode || 'footwork'}</div>
        <div class="session-score">${s.score}</div>
        <div class="session-acc">${s.accuracy}% · ${s.rounds} rounds${s.reaction ? ` · ${(s.reaction/1000).toFixed(2)}s` : ''}</div>
        <div class="session-xp">+${s.xpEarned || 0} XP</div>
      </div>`).join('')
  }

  // ── Performance chart ─────────────────────────────────────────
  const chartCanvas = document.getElementById('perf-chart')
  const chartEmpty  = document.getElementById('chart-empty')
  if (history.length >= 1 && chartCanvas) {
    chartCanvas.style.display = 'block'
    if (chartEmpty) chartEmpty.style.display = 'none'
    drawChart(chartCanvas, history.map(s => s.score).reverse())
  } else if (chartCanvas) {
    chartCanvas.style.display = 'none'
    if (chartEmpty) chartEmpty.style.display = 'block'
  }

  // ── AI tips (personalised based on weak zones) ────────────────
  const dirStats = stats.dirStats || {}
  const dirs = Object.entries(dirStats).filter(([,s]) => s.total > 0)
  if (dirs.length > 0) {
    const worst = dirs.sort((a,b) => (a[1].hit/a[1].total) - (b[1].hit/b[1].total))[0]
    const tips  = document.getElementById('tips-grid')
    if (tips && worst) {
      const worstPct = Math.round((worst[1].hit / worst[1].total) * 100)
      const newTip   = document.createElement('div')
      newTip.className = 'tip-card'
      newTip.innerHTML = `
        <div class="tip-icon">🎯</div>
        <div class="tip-text">Your <strong style="color:var(--accent)">${worst[0]}</strong> accuracy is ${worstPct}%.
        Focus your next session on this zone to improve your weakest area.</div>`
      tips.prepend(newTip)
    }
  }

})

// Expose globals needed by HTML onclick
window.switchTab    = switchTab
window.toggleSidebar = toggleSidebar
window.startDrill   = startDrill
window.upgradeToPremium = upgradeToPremium
