/* ============================================================
   Shuttlestepz — auth.js  v3
   Thin wrapper around database.js
   Sets window.AUTH so every page works with one import.

   Usage on every page (ONE tag only):
     <script type="module" src="/Badminton-AI-trainer_V2/js/auth.js"></script>
   ============================================================ */

import DB from './database.js'

/* ── Session cache (survives page navigations) ───────────────── */
const CACHE_KEY = 'ssz_v3_user'
function getCache()   { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY)) } catch { return null } }
function setCache(u)  { sessionStorage.setItem(CACHE_KEY, JSON.stringify(u)) }
function clearCache() { sessionStorage.removeItem(CACHE_KEY) }

/* ── XP / Level helpers ──────────────────────────────────────── */
const XP_THRESH = [0, 500, 1200, 2200, 3500, 5200, 7200, 9800, 13000, 17000, 22000]
const LV_TITLES = ['','Rookie','Beginner','Intermediate','Advanced','Expert',
                   'Elite','Champion','Legend','Master','Grandmaster']

function calcLevelInfo(xp = 0) {
  let level = 1
  for (let i = 1; i < XP_THRESH.length; i++) {
    if (xp >= XP_THRESH[i]) level = i + 1; else break
  }
  level = Math.min(level, XP_THRESH.length)
  const cur  = XP_THRESH[level - 1] || 0
  const nxt  = XP_THRESH[level]     || XP_THRESH[XP_THRESH.length - 1]
  const prog = level >= XP_THRESH.length
    ? 100
    : Math.round(Math.min(Math.max((xp - cur) / (nxt - cur), 0), 1) * 100)
  return { level, title: LV_TITLES[level] || 'Legend', progress: prog, xp, nextXP: nxt }
}

const FREE_LIMIT = 5

/* ── Firebase auth state → populate cache ────────────────────── */
DB.onAuthReady(async (fbUser) => {
  if (!fbUser) {
    clearCache()
    window.dispatchEvent(new CustomEvent('ssz-user-ready', { detail: null }))
    return
  }

  try {
    const p   = await DB.getUserProfile(fbUser.uid)
    const lvl = calcLevelInfo(p.xp || 0)

    const userData = {
      uid           : fbUser.uid,
      username      : p.profile?.displayName || fbUser.displayName || 'Athlete',
      email         : p.profile?.email       || fbUser.email,
      role          : p.profile?.role        || 'student',
      plan          : p.profile?.plan        || 'free',
      schoolId      : p.profile?.schoolCode  || null,
      xp            : p.xp            || 0,
      level         : lvl.level,
      levelTitle    : lvl.title,
      levelProgress : lvl.progress,
      nextXP        : lvl.nextXP,
      streak        : p.streak        || 0,
      bestStreak    : p.bestStreak    || 0,
      totalSessions : p.totalSessions || 0,
      bestScore     : p.bestScore     || 0,
      bestAccuracy  : p.bestAccuracy  || 0,
      sessionsToday : p.sessionsToday  || 0,
      lastSessionDay: p.lastSessionDay || null,
      createdAt     : p.profile?.createdAt?.seconds
        ? p.profile.createdAt.seconds * 1000 : Date.now(),
    }

    setCache(userData)
    window.dispatchEvent(new CustomEvent('ssz-user-ready', { detail: userData }))
    console.log('[AUTH] ✅ User ready:', userData.username, '| XP:', userData.xp, '| Level:', userData.level)

  } catch(e) {
    console.error('[AUTH] Profile load failed:', e.message)
    /* Still dispatch so pages don't hang */
    window.dispatchEvent(new CustomEvent('ssz-user-ready', { detail: null }))
  }
})

/* ══════════════════════════════════════════════════════════════
   window.AUTH  — public API used by all pages
══════════════════════════════════════════════════════════════ */
const AUTH = {

  /* ── Sign up ──────────────────────────────────────────────── */
  async signup(username, email, password, role = 'student', schoolId = null) {
    if (!username || username.trim().length < 3)
      return { ok: false, msg: 'Username must be at least 3 characters.' }
    if (!email || !email.includes('@'))
      return { ok: false, msg: 'Enter a valid email address.' }
    if (!password || password.length < 6)
      return { ok: false, msg: 'Password must be at least 6 characters.' }
    try {
      await DB.registerUser({
        email,
        password,
        displayName: username.trim(),
        role,
        schoolCode : schoolId || '',
      })
      /* Wait for onAuthReady to populate cache */
      await new Promise(r => setTimeout(r, 900))
      return { ok: true, user: getCache() }
    } catch(err) {
      return { ok: false, msg: _fbMsg(err) }
    }
  },

  /* ── Log in ───────────────────────────────────────────────── */
  async login(email, password) {
    if (!email || !password)
      return { ok: false, msg: 'Please fill in all fields.' }
    try {
      await DB.loginUser({ email, password })
      await new Promise(r => setTimeout(r, 900))
      return { ok: true, user: getCache() }
    } catch(err) {
      return { ok: false, msg: _fbMsg(err) }
    }
  },

  /* ── Log out ──────────────────────────────────────────────── */
  async logout() {
    clearCache()
    await DB.logoutUser()
    window.location.href = 'index.html'
  },

  /* ── Password reset ───────────────────────────────────────── */
  async sendPasswordReset(email) {
    try {
      await DB.resetPassword(email)
      return { ok: true }
    } catch(err) {
      return { ok: false, msg: _fbMsg(err) }
    }
  },

  /* ── Getters ──────────────────────────────────────────────── */
  currentUser() { return getCache() },

  /* ── Route guards ─────────────────────────────────────────── */
  requireAuth(redirect = 'login.html') {
    const u = getCache()
    if (!u) { window.location.href = redirect; return null }
    return u
  },
  requireGuest(redirect = 'dashboard.html') {
    if (getCache()) window.location.href = redirect
  },
  requireRole(role, redirect = 'dashboard.html') {
    const u = getCache()
    if (!u || u.role !== role) { window.location.href = redirect; return null }
    return u
  },

  /* ── Plan helpers ─────────────────────────────────────────── */
  isPremium() {
    const u = getCache()
    return u && (u.plan === 'premium' || u.plan === 'school')
  },
  async upgradePlan(uid, plan = 'premium') {
    try {
      await DB.updateUserProfile({ plan })
      const c = getCache()
      if (c) { c.plan = plan; setCache(c) }
      return { ok: true }
    } catch(err) {
      return { ok: false, msg: err.message }
    }
  },

  /* ── Session limits (Free plan: 5/day) ────────────────────── */
  canStartSession() {
    const u = getCache(); if (!u) return false
    if (this.isPremium()) return true
    const today = new Date().toDateString()
    if (u.lastSessionDay !== today) return true
    return (u.sessionsToday || 0) < FREE_LIMIT
  },
  sessionsRemaining() {
    const u = getCache(); if (!u) return 0
    if (this.isPremium()) return Infinity
    const today = new Date().toDateString()
    if (u.lastSessionDay !== today) return FREE_LIMIT
    return Math.max(0, FREE_LIMIT - (u.sessionsToday || 0))
  },
  async incrementSession() {
    const u = getCache(); if (!u || this.isPremium()) return
    const today = new Date().toDateString()
    const count = u.lastSessionDay === today ? (u.sessionsToday || 0) + 1 : 1
    u.sessionsToday   = count
    u.lastSessionDay  = today
    setCache(u)
  },

  /* ── Active session (Realtime DB) ─────────────────────────── */
  async startActiveSession(drillName) {
    await DB.startActiveSession(drillName)
  },
  async updateActiveSession(updates) {
    await DB.updateActiveSession(updates)
  },
  async endActiveSession() {
    await DB.endActiveSession()
  },
  listenActiveSession(userId, cb) {
    return DB.listenActiveSession(userId, cb)
  },

  /* ── Record completed session ─────────────────────────────── */
  async recordSession(data) {
    const u = getCache(); if (!u) return null
    try {
      const acc      = data.totalRounds > 0
        ? Math.round((data.hits / data.totalRounds) * 100) : 0
      let xpEarned   = 50 + (data.hits || 0) * 2
      if (acc >= 90) xpEarned += 30
      xpEarned = Math.round(xpEarned)

      await DB.saveSession({
        drill       : data.mode        || 'footwork',
        mode        : data.mode        || 'footwork',
        score       : data.score       || 0,
        accuracy    : acc,
        hits        : data.hits        || 0,
        totalRounds : data.totalRounds || 0,
        bestStreak  : data.bestStreak  || 0,
        xpEarned,
        reactionTime: data.roundTimings?.length
          ? Math.round(data.roundTimings.reduce((a, b) => a + b, 0) / data.roundTimings.length)
          : null,
        dirStats: data.dirStats || {},
      })

      const result = await DB.awardXP(xpEarned)

      /* Update cache with new XP + level */
      const c = getCache()
      if (c) {
        c.xp    = result.newXP
        c.level = result.newLevel
        const lvl = calcLevelInfo(result.newXP)
        c.levelTitle    = lvl.title
        c.levelProgress = lvl.progress
        c.nextXP        = lvl.nextXP
        setCache(c)
      }

      /* End active session in RTDB */
      await DB.endActiveSession()

      return { xpEarned, ...result }
    } catch(err) {
      console.error('[AUTH] recordSession error:', err)
      return null
    }
  },

  /* ── Stats (full dashboard data) ─────────────────────────── */
  async currentStats() {
    const u = getCache(); if (!u) return null
    try {
      const p        = await DB.getUserProfile()
      const sessions = await DB.getSessions({ limitN: 20 })
      const lvl      = calcLevelInfo(p.xp || 0)

      const history = sessions.map(s => ({
        id      : s.id,
        date    : s.createdAt?.toMillis?.() || Date.now(),
        score   : s.score,
        accuracy: s.accuracy,
        rounds  : s.totalRounds,
        reaction: s.reactionTime,
        mode    : s.mode,
        xpEarned: s.xpEarned,
        streak  : s.bestStreak,
      }))

      const dirStats = {}
      sessions.forEach(s => {
        if (s.dirStats) {
          for (const [dir, ds] of Object.entries(s.dirStats)) {
            if (!dirStats[dir]) dirStats[dir] = { total: 0, hit: 0 }
            dirStats[dir].total += ds.total || 0
            dirStats[dir].hit   += ds.hit   || 0
          }
        }
      })

      return {
        username     : p.profile?.displayName,
        plan         : p.profile?.plan        || 'free',
        role         : p.profile?.role        || 'student',
        xp           : p.xp           || 0,
        level        : lvl.level,
        levelTitle   : lvl.title,
        levelProgress: lvl.progress,
        nextXP       : lvl.nextXP,
        streak       : p.streak       || 0,
        bestStreak   : p.bestStreak   || 0,
        totalSessions: p.totalSessions || 0,
        bestScore    : p.bestScore    || 0,
        bestAccuracy : p.bestAccuracy || 0,
        history,
        dirStats,
      }
    } catch(err) {
      console.error('[AUTH] currentStats error:', err)
      return null
    }
  },

  /* ── Leaderboard ──────────────────────────────────────────── */
  async getLeaderboard(n = 20) {
    /* Try fast Realtime DB first */
    return new Promise(resolve => {
      const unsub = DB.listenRTLeaderboard(entries => {
        unsub()
        resolve(entries.slice(0, n))
      }, n)
    })
  },
  listenLeaderboard(cb, n = 20) {
    return DB.listenRTLeaderboard(cb, n)
  },

  /* ── Online presence ──────────────────────────────────────── */
  listenOnlineCount(cb) {
    return DB.listenOnlineCount(cb)
  },

  /* ── Live XP (Realtime DB) ────────────────────────────────── */
  listenLiveXP(cb) {
    return DB.listenLiveXP(cb)
  },

  /* ── School / class ───────────────────────────────────────── */
  async getClassStats(schoolCode) {
    try { return await DB.getStudentsBySchoolCode(schoolCode) }
    catch { return [] }
  },

  /* ── Settings ─────────────────────────────────────────────── */
  async getSettings()   { return DB.getSettings() },
  async saveSettings(s) { return DB.saveSettings(s) },
  listenSettings(cb)    { return DB.listenSettings(cb) },

  /* ── Real-time listeners ──────────────────────────────────── */
  listenProfile(cb)        { return DB.listenUserProfile(cb) },
  listenSessions(cb, n=20) { return DB.listenSessions(cb, n) },
  unsubscribeAll()         { DB.unsubscribeAll() },

  /* ── Utils ────────────────────────────────────────────────── */
  calcLevel: calcLevelInfo,
}

/* ── Firebase error → human readable message ─────────────────── */
function _fbMsg(err) {
  const map = {
    'auth/email-already-in-use'   : 'An account with this email already exists.',
    'auth/invalid-email'          : 'Invalid email address.',
    'auth/weak-password'          : 'Password must be at least 6 characters.',
    'auth/user-not-found'         : 'No account found with this email.',
    'auth/wrong-password'         : 'Incorrect password.',
    'auth/invalid-credential'     : 'Incorrect email or password.',
    'auth/too-many-requests'      : 'Too many attempts. Try again later.',
    'auth/network-request-failed' : 'Network error. Check your connection.',
    'auth/user-disabled'          : 'This account has been disabled.',
    'auth/operation-not-allowed'  : 'Email/password login is not enabled. Check Firebase Console.',
  }
  return map[err?.code] || err?.message || 'Something went wrong. Please try again.'
}

/* ── Expose globally ─────────────────────────────────────────── */
window.AUTH = AUTH
window.DB   = DB

export default AUTH
