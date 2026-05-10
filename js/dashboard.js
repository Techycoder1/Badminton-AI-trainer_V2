/* ============================================================
   Shuttlestepz — dashboard.js  (FIXED)
   Fix: duplicate `const roleBadge` declaration crashed ALL
        click handlers (JS syntax error halts execution)
   Fix: AUTH.requireAuth must be awaited
   Fix: loadLeaderboard uses correct .lb-item CSS classes
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
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  const panel = document.getElementById(`tab-${name}`)
  if (panel) panel.classList.add('active')

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === name)
  })

  const ttEl = document.getElementById('topbar-title')
  if (ttEl) ttEl.textContent = TAB_TITLES[name] || name

  if (name === 'leaderboard') loadLeaderboard()
  if (name === 'manage')      loadManage()

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
  const CIRC = 2 * Math.PI * 34
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

// ── Format dates ──────────────────────────────────────────────
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}
function fmtDateFull(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

// ── Drill launcher ────────────────────────────────────────────
function startDrill(mode) {
  if (!window.AUTH) return
  if (typeof AUTH.canStartSession === 'function' && !AUTH.canStartSession()) {
    showNotice('You have reached your 5 daily sessions. Upgrade to Premium to train more today.', true)
    return
  }
  sessionStorage.setItem('ssz_drill_mode', mode)
  window.location.href = 'trainer.html'
}

// ── Notice banner ─────────────────────────────────────────────
function showNotice(msg, isWarning = false) {
  const el    = document.getElementById('notice-banner')
  const msgEl = document.getElementById('notice-msg')
  if (!el || !msgEl) return
  msgEl.textContent = msg
  el.style.display  = 'flex'
  if (isWarning) el.style.borderColor = 'rgba(240,144,64,0.4)'
}

// ── Upgrade handler ───────────────────────────────────────────
async function upgradeToPremium() {
  window.location.href = 'upgrade.html'
}

// ── Draw performance chart ────────────────────────────────────
function drawChart(canvas, data) {
  if (!canvas || !data.length) return
  canvas.width  = (canvas.parentElement?.clientWidth || 600) - 48
  canvas.height = 100
  const c   = canvas.getContext('2d')
  const w   = canvas.width, h = canvas.height
  const max = Math.max(...data) * 1.15 || 1
  const pad = 20

  c.clearRect(0, 0, w, h)

  c.strokeStyle = 'rgba(56,210,90,0.06)'
  c.lineWidth   = 1
  for (let i = 0; i <= 3; i++) {
    const y = pad + (i / 3) * (h - pad * 2)
    c.beginPath(); c.moveTo(pad, y); c.lineTo(w - pad, y); c.stroke()
  }

  if (data.length === 1) {
    const cx = w / 2, cy = h / 2
    c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2)
    c.fillStyle = '#38d25a'; c.fill()
    c.fillStyle = 'rgba(56,210,90,0.55)'
    c.font = "10px monospace"; c.textAlign = 'center'
    c.fillText('Complete more sessions to see your trend', cx, h - 6)
    return
  }

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - (v / max) * (h - pad * 2),
  }))

  const grad = c.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(56,210,90,0.18)')
  grad.addColorStop(1, 'rgba(56,210,90,0)')
  c.beginPath(); c.moveTo(pts[0].x, h)
  pts.forEach(p => c.lineTo(p.x, p.y))
  c.lineTo(pts[pts.length-1].x, h); c.closePath()
  c.fillStyle = grad; c.fill()

  c.beginPath(); c.strokeStyle = 'rgba(56,210,90,0.85)'; c.lineWidth = 2
  pts.forEach((p, i) => i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y))
  c.stroke()

  pts.forEach((p, i) => {
    const isLast = i === pts.length - 1
    c.beginPath(); c.arc(p.x, p.y, isLast ? 5 : 3, 0, Math.PI * 2)
    c.fillStyle = isLast ? '#38d25a' : 'rgba(56,210,90,0.5)'; c.fill()
    c.fillStyle = 'rgba(56,210,90,0.55)'
    c.font = "9px monospace"; c.textAlign = 'center'
    c.fillText(data[i], p.x, p.y - 9)
  })
}

// ── Load leaderboard ──────────────────────────────────────────
async function loadLeaderboard() {
  if (!window.AUTH) return
  const lbList = document.getElementById('lb-list')
  if (!lbList || lbList.dataset.loaded) return

  lbList.innerHTML = '<div class="lb-loading">Loading…</div>'

  try {
    const board = await AUTH.getLeaderboard(20)
    const user  = AUTH.currentUser ? AUTH.currentUser() : null

    if (!board || !board.length) {
      lbList.innerHTML = '<div class="lb-loading">No entries yet. Complete a session to appear here!</div>'
      return
    }

    const myIdx  = board.findIndex(e => e.id === user?.uid)
    const medals = ['🥇','🥈','🥉']

    if (myIdx !== -1) {
      const el = document.getElementById('lb-rank-num')
      if (el) el.textContent = `#${myIdx + 1}`
      const xpEl = document.getElementById('lb-rank-xp')
      if (xpEl) xpEl.textContent = `${board[myIdx].xp || 0} XP`
    }

    lbList.innerHTML = board.map((e, i) => {
      const isMe     = e.id === user?.uid
      const posStr   = i < 3 ? medals[i] : `${i + 1}`
      const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
      return `<div class="lb-item ${isMe ? 'lb-item--me' : ''}">
        <div class="lb-pos ${posClass}">${posStr}</div>
        <div class="lb-avatar">${(e.username||'?')[0].toUpperCase()}</div>
        <div class="lb-name-col">
          <div class="lb-lb-name">
            ${e.username || 'Player'}
            ${e.plan === 'premium' ? ' ⭐' : ''}
            ${isMe ? ' <span style="font-size:10px;color:var(--text-3)">(you)</span>' : ''}
          </div>
          <div class="lb-lb-role">Lv.${e.level || 1} · ${e.role || 'student'}</div>
        </div>
        <div class="lb-xp-val">${e.xp || 0} XP</div>
      </div>`
    }).join('')

    lbList.dataset.loaded = '1'
  } catch(e) {
    console.error('[Dashboard] leaderboard error', e)
    lbList.innerHTML = '<div class="lb-loading">Could not load leaderboard.</div>'
  }
}

// ── Load manage (teacher/coach) ───────────────────────────────
async function loadManage() {
  if (!window.AUTH) return
  const user = AUTH.currentUser ? AUTH.currentUser() : null
  if (!user?.schoolId) return
  const list = document.getElementById('manage-list')
  if (!list || list.dataset.loaded) return

  list.innerHTML = '<div class="lb-loading">Loading students…</div>'

  try {
    const students = await AUTH.getClassStats(user.schoolId)
    if (!students || !students.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <div>No students linked yet. Share your school code to get started.</div>
      </div>`
      return
    }
    list.innerHTML = students.map(s => `
      <div class="lb-item">
        <div class="lb-avatar">${(s.username||'?')[0].toUpperCase()}</div>
        <div class="lb-name-col">
          <div class="lb-lb-name">${s.username}</div>
          <div class="lb-lb-role">Lv.${s.level} · ${s.xp} XP</div>
        </div>
      </div>`).join('')
    list.dataset.loaded = '1'
  } catch(e) {
    console.error('[Dashboard] manage error', e)
    list.innerHTML = '<div class="lb-loading">Could not load students.</div>'
  }
}

// ── Main init ─────────────────────────────────────────────────
window.addEventListener('load', async () => {

  // Wait for AUTH to be ready
  await new Promise(resolve => {
    if (window.AUTH) { resolve(); return }
    const timeout = setTimeout(resolve, 6000)
    window.addEventListener('ssz-user-ready', () => {
      clearTimeout(timeout); resolve()
    }, { once: true })
  })

  if (!window.AUTH) { console.error('[Dashboard] AUTH not loaded'); return }

  // ── FIX: requireAuth must be awaited ──────────────────────
  const user = await AUTH.requireAuth('login.html')
  if (!user) return

  // ── Show/hide manage nav ──────────────────────────────────
  const navManage = document.getElementById('nav-manage')
  if (navManage) {
    const isStaff = user.role === 'teacher' || user.role === 'coach'
    navManage.style.display = isStaff ? 'flex' : 'none'
    const lbl = document.getElementById('nav-manage-label')
    if (lbl) lbl.textContent = user.role === 'coach' ? 'My Players' : 'Students'
  }

  if (user.role === 'coach') {
    const mt = document.getElementById('manage-title')
    const ms = document.getElementById('manage-sub')
    if (mt) mt.textContent = 'Manage Players'
    if (ms) ms.textContent = 'Players linked to your club code.'
  }

  const codeEl = document.getElementById('manage-code')
  if (codeEl) codeEl.textContent = user.schoolId || '—'

  // ── FIX: single roleBadge declaration ─────────────────────
  // (was declared twice — `const` inside same scope = SyntaxError = all clicks dead)
  const roleBadge = document.getElementById('role-badge')
  if (roleBadge) {
    // Use PREMIUM badge if available, otherwise plain text
    if (window.PREMIUM) {
      roleBadge.innerHTML   = PREMIUM.badgeHTML(user.plan || 'free')
      roleBadge.style.border     = 'none'
      roleBadge.style.background = 'transparent'
    } else {
      const roleCap = (user.role || 'student').charAt(0).toUpperCase() + (user.role || 'student').slice(1)
      roleBadge.textContent = roleCap
    }
  }

  if (user.role) document.body.classList.add(`role-${user.role}`)

  // ── Greeting ──────────────────────────────────────────────
  const grEl = document.getElementById('greeting-time')
  const gnEl = document.getElementById('greeting-name')
  if (grEl) grEl.textContent = getGreeting()
  if (gnEl) gnEl.textContent = user.username || 'Athlete'

  // ── Sidebar XP (from auth cache) ─────────────────────────
  const lvlInfo = typeof AUTH.calcLevel === 'function'
    ? AUTH.calcLevel(user.xp || 0)
    : { level: 1, progress: 0 }
  const sbXP  = document.getElementById('sb-xp-label')
  const sbLv  = document.getElementById('sb-level-label')
  const sbFil = document.getElementById('sb-xp-fill')
  const tbXP  = document.getElementById('topbar-xp')
  if (sbXP)  sbXP.textContent  = `${user.xp || 0} XP`
  if (sbLv)  sbLv.textContent  = `Lv.${lvlInfo.level}`
  if (sbFil) sbFil.style.width = `${lvlInfo.progress}%`
  if (tbXP)  tbXP.textContent  = `${user.xp || 0} XP`

  // ── Profile tab (from auth cache) ────────────────────────
  const displayName = user.username || user.displayName || '—'
  const roleCapFull = (user.role||'student').charAt(0).toUpperCase()+(user.role||'student').slice(1)

  const profAvatar = document.getElementById('profile-avatar')
  const profName   = document.getElementById('profile-name')
  const profEmail  = document.getElementById('profile-email')
  const profRole   = document.getElementById('profile-role-pill')
  const setUser    = document.getElementById('settings-username')
  const setEmail   = document.getElementById('settings-email')
  const setPlan    = document.getElementById('settings-plan')
  const btnUpgrade = document.getElementById('btn-upgrade')

  if (profAvatar) profAvatar.textContent = (displayName[0]||'?').toUpperCase()
  if (profName)   profName.textContent   = displayName
  if (profEmail)  profEmail.textContent  = user.email || '—'
  if (profRole)   profRole.textContent   = roleCapFull
  if (setUser)    setUser.textContent    = displayName
  if (setEmail)   setEmail.textContent   = user.email || '—'

  if (setPlan) {
    if (user.plan === 'premium' || user.plan === 'school') {
      setPlan.innerHTML = `⭐ <span style="color:var(--accent)">${roleCapFull} Premium</span>`
      if (btnUpgrade) btnUpgrade.style.display = 'none'
    } else {
      setPlan.textContent = 'Free — 5 sessions/day'
    }
  }

  // Wire upgrade button → upgrade page
  if (btnUpgrade) btnUpgrade.onclick = () => window.location.href = 'upgrade.html'

  // ── Session limit bar (free users) ───────────────────────
  const isPremium = user.plan === 'premium' || user.plan === 'school'
  if (!isPremium && typeof AUTH.sessionsRemaining === 'function') {
    const remaining = AUTH.sessionsRemaining()
    const sbCount   = document.querySelector('.sb-count')
    const sbProg    = document.getElementById('sessions-progress')
    if (sbCount) {
      sbCount.textContent = remaining === 0
        ? 'No sessions left today'
        : `${remaining} of 5 remaining`
      sbCount.className = 'sb-count' + (remaining === 0 ? ' empty' : remaining <= 2 ? ' warning' : '')
    }
    if (sbProg) {
      sbProg.style.width      = `${(remaining / 5) * 100}%`
      sbProg.style.background = remaining === 0 ? 'var(--danger)' : remaining <= 2 ? 'var(--warn)' : 'var(--accent)'
    }
  }

  // ── Fetch Firestore stats ─────────────────────────────────
  let stats = null
  try {
    if (typeof AUTH.currentStats === 'function') {
      stats = await AUTH.currentStats()
    }
  } catch(e) {
    console.warn('[Dashboard] stats fetch failed:', e)
  }

  if (!stats) return

  // ── Update with real Firestore data ───────────────────────
  const fsName = stats.username || user.username || '—'
  if (profAvatar) profAvatar.textContent = (fsName[0]||'?').toUpperCase()
  if (profName)   profName.textContent   = fsName
  if (setUser)    setUser.textContent    = fsName
  if (gnEl)       gnEl.textContent       = fsName.split(' ')[0]

  // ── XP card ───────────────────────────────────────────────
  const lvl = typeof AUTH.calcLevel === 'function'
    ? AUTH.calcLevel(stats.xp || 0)
    : { level:1, progress:0, next:null, xp:0 }
  setXPRing(lvl.progress)

  const ringLv   = document.getElementById('ring-lv')
  const xpTotal  = document.getElementById('xp-total')
  const xpNext   = document.getElementById('xp-next')
  const xpFillLg = document.getElementById('xp-fill-lg')
  const statSess = document.getElementById('stat-sessions')
  const statStrk = document.getElementById('stat-streak')
  const statRank = document.getElementById('stat-rank')

  if (ringLv)   ringLv.textContent   = lvl.level
  if (xpTotal)  xpTotal.textContent  = `${stats.xp || 0} XP`
  if (xpNext)   xpNext.textContent   = lvl.next
    ? `${(stats.xp||0) - lvl.xp} / ${lvl.next.xp - lvl.xp} to Level ${lvl.next.level}`
    : 'MAX LEVEL'
  if (xpFillLg) xpFillLg.style.width = `${lvl.progress}%`
  if (statSess) statSess.textContent = stats.totalSessions || 0
  if (statStrk) statStrk.textContent = `${stats.streak || 0}🔥`

  // Rank tier via PREMIUM module
  if (statRank && window.PREMIUM) {
    const tier = PREMIUM.getRankTier(stats.xp || 0)
    statRank.textContent = `${tier.icon} ${tier.name}`
  }

  // Update sidebar + topbar with real XP
  if (sbXP)  sbXP.textContent  = `${stats.xp || 0} XP`
  if (sbLv)  sbLv.textContent  = `Lv.${lvl.level}`
  if (sbFil) sbFil.style.width = `${lvl.progress}%`
  if (tbXP)  tbXP.textContent  = `${stats.xp || 0} XP`

  // ── History tab stats ─────────────────────────────────────
  const history = stats.history || []
  const hSess   = document.getElementById('h-total-sessions')
  const hXP     = document.getElementById('h-total-xp')
  const hStrk   = document.getElementById('h-best-streak')
  const hAvg    = document.getElementById('h-avg-score')

  if (hSess) hSess.textContent = stats.totalSessions || 0
  if (hXP)   hXP.textContent  = stats.xp || 0
  if (hStrk) hStrk.textContent = `${stats.bestStreak || 0}🔥`
  if (hAvg && history.length) {
    const avg = Math.round(history.reduce((a, s) => a + (s.score || 0), 0) / history.length)
    hAvg.textContent = avg
  }

  // ── Overview recent sessions ──────────────────────────────
  const DRILL_ICONS = { footwork:'🦶', shadow:'👤', reflex:'⚡', endurance:'🏃' }
  const ovSessions  = document.getElementById('overview-sessions')
  const sessEmpty   = document.getElementById('sessions-empty')

  if (history.length > 0 && ovSessions) {
    if (sessEmpty) sessEmpty.style.display = 'none'
    history.slice(0, 5).forEach(s => {
      const item = document.createElement('div')
      item.className = 'session-item'
      item.innerHTML = `
        <div class="session-icon">${DRILL_ICONS[s.mode] || '🏸'}</div>
        <div class="session-info">
          <div class="session-name">${(s.mode||'footwork').charAt(0).toUpperCase()+(s.mode||'footwork').slice(1)} Drill</div>
          <div class="session-meta">${fmtDate(s.date)} · ${s.accuracy||0}% acc · ${s.rounds||0} rounds</div>
        </div>
        <div class="session-score">${s.score||0}</div>
        <div class="session-xp">+${s.xpEarned||0} XP</div>`
      ovSessions.appendChild(item)
    })
  }

  // ── History tab full list ─────────────────────────────────
  const histSessions = document.getElementById('history-sessions')
  if (history.length > 0 && histSessions) {
    histSessions.innerHTML = history.map(s => `
      <div class="session-item">
        <div class="session-icon">${DRILL_ICONS[s.mode] || '🏸'}</div>
        <div class="session-info">
          <div class="session-name">${(s.mode||'footwork').charAt(0).toUpperCase()+(s.mode||'footwork').slice(1)} Drill</div>
          <div class="session-meta">${fmtDateFull(s.date)} · ${s.accuracy||0}% · ${s.rounds||0} rounds${s.reaction ? ` · ${(s.reaction/1000).toFixed(2)}s` : ''}</div>
        </div>
        <div class="session-score">${s.score||0}</div>
        <div class="session-xp">+${s.xpEarned||0} XP</div>
      </div>`).join('')
  }

  // ── Performance chart ─────────────────────────────────────
  const chartCanvas = document.getElementById('perf-chart') || document.getElementById('history-chart')
  const chartEmpty  = document.getElementById('chart-empty') || document.getElementById('history-chart-empty')
  if (history.length >= 1 && chartCanvas) {
    chartCanvas.style.display = 'block'
    if (chartEmpty) chartEmpty.style.display = 'none'
    drawChart(chartCanvas, history.map(s => s.score).reverse())
  } else if (chartCanvas) {
    chartCanvas.style.display = 'none'
    if (chartEmpty) chartEmpty.style.display = 'block'
  }

  // ── AI tips — personalised ────────────────────────────────
  const dirStats = stats.dirStats || {}
  const dirs     = Object.entries(dirStats).filter(([,s]) => s.total > 0)
  if (dirs.length > 0) {
    const worst    = dirs.sort((a,b) => (a[1].hit/a[1].total) - (b[1].hit/b[1].total))[0]
    const tips     = document.getElementById('tips-grid')
    if (tips && worst) {
      const worstPct = Math.round((worst[1].hit / worst[1].total) * 100)
      const newTip   = document.createElement('div')
      newTip.className = 'tip-card'
      newTip.innerHTML = `
        <div class="tip-icon">🎯</div>
        <div class="tip-text">Your <strong style="color:var(--accent)">${worst[0]}</strong> accuracy is ${worstPct}%.
        Focus your next session here to improve your weakest zone.</div>`
      tips.prepend(newTip)
    }
  }

  // ── Streak alert via PREMIUM ──────────────────────────────
  if ((stats.streak || 0) > 1 && window.PREMIUM) {
    setTimeout(() => PREMIUM.showStreakAlert(stats.streak), 2000)
  }

  // ── Lock premium drills for free users ────────────────────
  if (!isPremium && window.PREMIUM) {
    const lockTargets = [
      { id: 'drill-reflex',    name: 'Reflex Challenge' },
      { id: 'drill-endurance', name: 'Endurance Run'    },
    ]
    lockTargets.forEach(({ id, name }) => {
      const el = document.getElementById(id)
      if (el) PREMIUM.lockElement(el, name)
    })
  }

})

// ── Globals needed by HTML onclick attrs ─────────────────────
window.switchTab        = switchTab
window.toggleSidebar    = toggleSidebar
window.startDrill       = startDrill
window.upgradeToPremium = upgradeToPremium
