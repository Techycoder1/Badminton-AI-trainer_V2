/* ============================================================
   Shuttlestepz — auth.js  (V2)
   Thin wrapper around database.js
   Keeps window.AUTH API so all pages work without changes.
   ============================================================ */

import DB from './database.js'
import PREMIUM from './premium.js'

/* ── Creator emails ──────────────────────────────────────────── */
const CREATOR_EMAILS = [
  'techycoder1@gmail.com',
]

/* ── Session cache ───────────────────────────────────────────── */
const CACHE_KEY = 'ssz_v2_user'
function getCache()   { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY)) } catch { return null } }
function setCache(u)  { sessionStorage.setItem(CACHE_KEY, JSON.stringify(u)) }
function clearCache() { sessionStorage.removeItem(CACHE_KEY) }

/* ── XP / Level ──────────────────────────────────────────────── */
const XP_THRESH = [0, 500, 1200, 2200, 3500, 5200, 7200, 9800, 13000, 17000, 22000]
const LV_TITLES = ['','Rookie','Beginner','Intermediate','Advanced','Expert','Elite','Champion','Legend','Master','Grandmaster']

function calcLevelInfo(xp) {
  let level = 1
  for (let i = 1; i < XP_THRESH.length; i++) {
    if (xp >= XP_THRESH[i]) level = i + 1; else break
  }
  level = Math.min(level, XP_THRESH.length)
  const cur  = XP_THRESH[level - 1] || 0
  const nxt  = XP_THRESH[level]     || XP_THRESH[XP_THRESH.length - 1]
  const prog = Math.min(Math.max((xp - cur) / (nxt - cur), 0), 1) * 100
  return { level, title: LV_TITLES[level] || 'Legend', progress: Math.round(prog), xp, nextXP: nxt }
}

const FREE_LIMIT = 5

/* ── Firebase auth state → populate cache ────────────────────── */
DB.onAuthReady(async (fbUser) => {
  if (!fbUser) { clearCache(); return }
  try {
    const p   = await DB.getUserProfile(fbUser.uid)
    const lvl = calcLevelInfo(p.xp || 0)
    setCache({
      uid           : fbUser.uid,
      username      : p.profile?.displayName || fbUser.displayName || 'Athlete',
      email         : p.profile?.email       || fbUser.email,
      role          : p.profile?.role        || 'student',
      plan          : p.profile?.plan        || 'free',
      schoolId      : p.profile?.schoolCode  || null,
      xp            : p.xp          || 0,
      level         : lvl.level,
      levelTitle    : lvl.title,
      streak        : p.streak      || 0,
      bestStreak    : p.bestStreak  || 0,
      totalSessions : p.totalSessions || 0,
      lastSessionDay: p.lastSessionDay || null,
      sessionsToday : p.sessionsToday  || 0,
      createdAt     : p.profile?.createdAt?.seconds
        ? p.profile.createdAt.seconds * 1000 : Date.now(),
    })
    window.dispatchEvent(new CustomEvent('ssz-user-ready', { detail: getCache() }))
  } catch(e) {
    console.error('[AUTH] profile load failed', e)
  }
})

/* ══════════════════════════════════════════════════════════════
   window.AUTH  — public API
══════════════════════════════════════════════════════════════ */
const AUTH = {

  // ── Sign up ───────────────────────────────────────────────
  async signup(username, email, password, role = 'student', schoolId = null) {
    if (!username || username.trim().length < 3) return { ok:false, msg:'Username must be at least 3 characters.' }
    if (!email || !email.includes('@'))          return { ok:false, msg:'Enter a valid email address.' }
    if (!password || password.length < 6)        return { ok:false, msg:'Password must be at least 6 characters.' }
    try {
      await DB.registerUser({ email, password, displayName: username.trim(), role, schoolCode: schoolId || '' })
      await new Promise(r => setTimeout(r, 700))
      return { ok:true, user: getCache() }
    } catch(err) { return { ok:false, msg: _fbMsg(err) } }
  },

  // ── Log in ────────────────────────────────────────────────
  async login(email, password) {
    if (!email || !password) return { ok:false, msg:'Please fill in all fields.' }
    try {
      await DB.loginUser({ email, password })
      await new Promise(r => setTimeout(r, 700))
      return { ok:true, user: getCache() }
    } catch(err) { return { ok:false, msg: _fbMsg(err) } }
  },

  // ── Log out ───────────────────────────────────────────────
  async logout() {
    clearCache()
    await DB.logoutUser()
    window.location.href = 'index.html'
  },

  // ── Password reset ────────────────────────────────────────
  async sendPasswordReset(email) {
    try { await DB.resetPassword(email); return { ok:true } }
    catch(err) { return { ok:false, msg: _fbMsg(err) } }
  },

  // ── Getters ───────────────────────────────────────────────
  currentUser() { return getCache() },

  // ── Guards ────────────────────────────────────────────────

  /*
   * FIX: requireAuth was synchronous — read cache, redirect if null.
   * Problem: on page load, DB.onAuthReady hasn't fired yet, so cache
   * is empty even for logged-in users → instant redirect to login.
   *
   * Fix: wait up to 4 seconds for either:
   *   a) cache to be populated by DB.onAuthReady  (happy path)
   *   b) Firebase to confirm no user (genuinely logged out)
   * Then decide whether to redirect or resolve with the user.
   */
  requireAuth(redirect = 'login.html') {
    return new Promise((resolve) => {
      // Already cached — resolve immediately
      const cached = getCache()
      if (cached) { resolve(cached); return }

      // Wait for ssz-user-ready or a confirmed "no user" state
      let resolved = false

      // Listen for successful auth population
      const onReady = (e) => {
        if (resolved) return
        resolved = true
        window.removeEventListener('ssz-user-ready', onReady)
        resolve(e.detail)
      }
      window.addEventListener('ssz-user-ready', onReady)

      // Also poll the cache directly every 100ms as a fallback
      // (covers cases where the event was fired before this listener attached)
      const poll = setInterval(() => {
        const u = getCache()
        if (u && !resolved) {
          resolved = true
          clearInterval(poll)
          window.removeEventListener('ssz-user-ready', onReady)
          resolve(u)
        }
      }, 100)

      // Timeout: if nothing after 4s, user is genuinely not logged in
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          clearInterval(poll)
          window.removeEventListener('ssz-user-ready', onReady)
          // Only redirect if still no cache
          if (!getCache()) {
            window.location.href = redirect
            resolve(null)
          } else {
            resolve(getCache())
          }
        }
      }, 4000)
    })
  },

  requireGuest(redirect = 'dashboard.html') {
    // Check cache immediately
    if (getCache()) { window.location.href = redirect; return }
    // Also redirect once auth fires, in case cache was empty on load
    const onReady = () => {
      window.removeEventListener('ssz-user-ready', onReady)
      window.location.href = redirect
    }
    window.addEventListener('ssz-user-ready', onReady)
    // Cancel listener after 3s if still no user (they're a genuine guest)
    setTimeout(() => window.removeEventListener('ssz-user-ready', onReady), 3000)
  },

  requireRole(role, redirect = 'dashboard.html') {
    const u = getCache()
    if (!u || u.role !== role) { window.location.href = redirect; return null }
    return u
  },

  // ── Plan ──────────────────────────────────────────────────
  isPremium() {
    const u = getCache()
    if (!u) return false
    if (CREATOR_EMAILS.includes((u.email || '').toLowerCase())) return true
    return u.plan === 'premium' || u.plan === 'school'
  },
  async upgradePlan(uid, plan = 'premium') {
    try {
      await DB.updateUserProfile({ plan })
      const c = getCache(); if (c) { c.plan = plan; setCache(c) }
      return true
    } catch { return false }
  },

  // ── Session limit ─────────────────────────────────────────
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
    u.sessionsToday = count; u.lastSessionDay = today; setCache(u)
  },

  // ── Record session ────────────────────────────────────────
  async recordSession(data) {
    const u = getCache(); if (!u) return null
    try {
      const acc      = data.totalRounds > 0 ? Math.round((data.hits / data.totalRounds) * 100) : 0
      let xpEarned   = 50 + (data.hits || 0) * 2
      if (acc >= 90)   xpEarned += 30
      xpEarned = Math.round(xpEarned)

      await DB.saveSession({
        drill       : data.mode || 'footwork',
        mode        : data.mode || 'footwork',
        score       : data.score || 0,
        accuracy    : acc,
        hits        : data.hits  || 0,
        totalRounds : data.totalRounds || 0,
        bestStreak  : data.bestStreak  || 0,
        xpEarned,
        reactionTime: data.roundTimings?.length
          ? Math.round(data.roundTimings.reduce((a,b)=>a+b,0)/data.roundTimings.length) : null,
        dirStats    : data.dirStats || {},
      })

      const result = await DB.awardXP(xpEarned)
      u.xp = result.newXP; u.level = result.newLevel; setCache(u)
      return { xpEarned, ...result }
    } catch(err) { console.error('[AUTH] recordSession:', err); return null }
  },

  // ── Stats ─────────────────────────────────────────────────
  async currentStats() {
    const u = getCache(); if (!u) return null
    try {
      const p        = await DB.getUserProfile(u.uid)
      const sessions = await DB.getSessions({ uid: u.uid, limitN: 20 })
      const lvl      = calcLevelInfo(p.xp || 0)

      const history  = sessions.map(s => ({
        id      : s.id,
        date    : s.createdAt?.toMillis?.() || Date.now(),
        score   : s.score,   accuracy: s.accuracy,
        rounds  : s.totalRounds, reaction: s.reactionTime,
        mode    : s.mode,    xpEarned: s.xpEarned,
        streak  : s.bestStreak,
      }))

      const dirStats = {}
      sessions.forEach(s => {
        if (s.dirStats) {
          for (const [dir, ds] of Object.entries(s.dirStats)) {
            if (!dirStats[dir]) dirStats[dir] = { total:0, hit:0 }
            dirStats[dir].total += ds.total || 0
            dirStats[dir].hit   += ds.hit   || 0
          }
        }
      })

      return {
        username: p.profile?.displayName, plan: p.profile?.plan || 'free',
        role    : p.profile?.role || 'student',
        xp: p.xp||0, level: lvl.level, levelTitle: lvl.title,
        levelProgress: lvl.progress, nextXP: lvl.nextXP,
        streak: p.streak||0, bestStreak: p.bestStreak||0,
        totalSessions: p.totalSessions||0,
        bestScore: p.bestScore||0, bestAccuracy: p.bestAccuracy||0,
        history, dirStats,
      }
    } catch(err) { console.error('[AUTH] currentStats:', err); return null }
  },

  // ── Leaderboard ───────────────────────────────────────────
  async getLeaderboard(n = 20) {
    return new Promise(resolve => {
      const unsub = DB.listenLeaderboard(entries => { unsub(); resolve(entries.slice(0, n)) }, n)
    })
  },

  // ── School ────────────────────────────────────────────────
  async getClassStats(schoolCode) {
    try { return await DB.getStudentsBySchoolCode(schoolCode) } catch { return [] }
  },

  // ── Settings ──────────────────────────────────────────────
  async getSettings()    { return DB.getSettings() },
  async saveSettings(s)  { return DB.saveSettings(s) },
  listenSettings(cb)     { return DB.listenSettings(cb) },

  // ── Real-time listeners ───────────────────────────────────
  listenProfile(cb)         { return DB.listenUserProfile(cb) },
  listenSessions(cb, n=20)  { return DB.listenSessions(cb, n) },
  listenLeaderboard(cb, n)  { return DB.listenLeaderboard(cb, n) },
  unsubscribeAll()          { DB.unsubscribeAll() },

  // ── Utils ─────────────────────────────────────────────────
  calcLevel: calcLevelInfo,
}

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
  }
  return map[err.code] || err.message || 'Something went wrong.'
}

window.AUTH = AUTH
window.DB   = DB
export default AUTH
