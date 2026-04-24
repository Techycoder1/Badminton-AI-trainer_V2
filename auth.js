/* ============================================================
   Shuttlestepz — auth.js
   LocalStorage-based auth system (V1)
   ============================================================ */

const AUTH = (() => {

  const USERS_KEY   = 'ssz_users'
  const SESSION_KEY = 'ssz_session'
  const STATS_KEY   = 'ssz_stats'

  // ── Helpers ──────────────────────────────────────────────────
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {} } catch { return {} }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY)
  }

  // Simple hash (not cryptographic — V1 demo)
  function hashPassword(pw) {
    let hash = 0
    for (let i = 0; i < pw.length; i++) {
      hash = ((hash << 5) - hash) + pw.charCodeAt(i)
      hash |= 0
    }
    return hash.toString(36)
  }

  // ── Auth actions ──────────────────────────────────────────────
  function signup(username, email, password) {
    if (!username || username.length < 3) return { ok: false, msg: 'Username must be at least 3 characters.' }
    if (!email || !email.includes('@'))   return { ok: false, msg: 'Enter a valid email address.' }
    if (!password || password.length < 6) return { ok: false, msg: 'Password must be at least 6 characters.' }

    const users = getUsers()
    const key   = email.toLowerCase()

    if (users[key]) return { ok: false, msg: 'An account with this email already exists.' }

    const newUser = {
      id        : 'u_' + Date.now(),
      username  : username.trim(),
      email     : key,
      password  : hashPassword(password),
      plan      : 'free',          // 'free' | 'premium'
      createdAt : Date.now(),
      sessionsToday: 0,
      lastSessionDate: null,
    }

    users[key] = newUser
    saveUsers(users)

    // Init stats
    const stats = getStats(newUser.id)
    saveStats(newUser.id, stats)

    const sessionUser = { ...newUser }
    delete sessionUser.password
    setSession(sessionUser)

    return { ok: true, user: sessionUser }
  }

  function login(email, password) {
    if (!email || !password) return { ok: false, msg: 'Please fill in all fields.' }

    const users = getUsers()
    const key   = email.toLowerCase().trim()
    const user  = users[key]

    if (!user) return { ok: false, msg: 'No account found with this email.' }
    if (user.password !== hashPassword(password)) return { ok: false, msg: 'Incorrect password.' }

    const sessionUser = { ...user }
    delete sessionUser.password
    setSession(sessionUser)

    return { ok: true, user: sessionUser }
  }

  function logout() {
    clearSession()
    window.location.href = 'index.html'
  }

  function currentUser() {
    return getSession()
  }

  function requireAuth(redirectTo = 'login.html') {
    const user = getSession()
    if (!user) { window.location.href = redirectTo; return null }
    return user
  }

  function requireGuest(redirectTo = 'dashboard.html') {
    const user = getSession()
    if (user) { window.location.href = redirectTo; return null }
  }

  function upgradePlan(email) {
    const users = getUsers()
    const key   = email.toLowerCase()
    if (users[key]) {
      users[key].plan = 'premium'
      saveUsers(users)
      const session = getSession()
      if (session && session.email === key) {
        session.plan = 'premium'
        setSession(session)
      }
      return true
    }
    return false
  }

  function isPremium() {
    const user = getSession()
    return user && user.plan === 'premium'
  }

  // ── Session limiter for free users ────────────────────────────
  function canStartSession() {
    const user = getSession()
    if (!user) return false
    if (user.plan === 'premium') return true

    const users = getUsers()
    const stored = users[user.email]
    if (!stored) return false

    const today = new Date().toDateString()
    if (stored.lastSessionDate !== today) {
      stored.sessionsToday = 0
      stored.lastSessionDate = today
    }

    return stored.sessionsToday < 5
  }

  function incrementSession() {
    const user = getSession()
    if (!user || user.plan === 'premium') return

    const users = getUsers()
    const stored = users[user.email]
    if (!stored) return

    const today = new Date().toDateString()
    if (stored.lastSessionDate !== today) {
      stored.sessionsToday = 0
      stored.lastSessionDate = today
    }

    stored.sessionsToday++
    saveUsers(users)

    // Update session
    user.sessionsToday = stored.sessionsToday
    user.lastSessionDate = today
    setSession(user)
  }

  function sessionsRemaining() {
    const user = getSession()
    if (!user) return 0
    if (user.plan === 'premium') return Infinity

    const users = getUsers()
    const stored = users[user.email]
    if (!stored) return 0

    const today = new Date().toDateString()
    if (stored.lastSessionDate !== today) return 5
    return Math.max(0, 5 - (stored.sessionsToday || 0))
  }

  // ── Stats ─────────────────────────────────────────────────────
  function getStats(userId) {
    try {
      const raw = localStorage.getItem(`${STATS_KEY}_${userId}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return {
      totalSessions : 0,
      totalRounds   : 0,
      totalHits     : 0,
      bestScore     : 0,
      bestAccuracy  : 0,
      bestStreak    : 0,
      bestReaction  : null,   // ms — lower is better
      history       : [],     // last 20 sessions
      dirStats      : {},     // per-direction accuracy
      weeklyScores  : [],     // last 7 daily totals
    }
  }

  function saveStats(userId, stats) {
    localStorage.setItem(`${STATS_KEY}_${userId}`, JSON.stringify(stats))
  }

  function recordSession(sessionData) {
    const user = getSession()
    if (!user) return

    const stats = getStats(user.id)
    const acc   = sessionData.totalRounds > 0
      ? Math.round((sessionData.hits / sessionData.totalRounds) * 100) : 0
    const avgReaction = sessionData.roundTimings && sessionData.roundTimings.length
      ? Math.round(sessionData.roundTimings.reduce((a, b) => a + b, 0) / sessionData.roundTimings.length) : null

    stats.totalSessions++
    stats.totalRounds  += sessionData.totalRounds || 0
    stats.totalHits    += sessionData.hits || 0
    if (sessionData.score  > stats.bestScore)    stats.bestScore    = sessionData.score
    if (acc                > stats.bestAccuracy) stats.bestAccuracy = acc
    if (sessionData.bestStreak > stats.bestStreak) stats.bestStreak = sessionData.bestStreak
    if (avgReaction && (!stats.bestReaction || avgReaction < stats.bestReaction))
      stats.bestReaction = avgReaction

    // Merge direction stats
    if (sessionData.dirStats) {
      for (const [dir, ds] of Object.entries(sessionData.dirStats)) {
        if (!stats.dirStats[dir]) stats.dirStats[dir] = { total: 0, hit: 0 }
        stats.dirStats[dir].total += ds.total
        stats.dirStats[dir].hit   += ds.hit
      }
    }

    // History (last 20)
    stats.history.unshift({
      date      : Date.now(),
      score     : sessionData.score,
      accuracy  : acc,
      rounds    : sessionData.totalRounds,
      reaction  : avgReaction,
      difficulty: sessionData.difficulty || 'medium',
    })
    stats.history = stats.history.slice(0, 20)

    saveStats(user.id, stats)
    return stats
  }

  function currentStats() {
    const user = getSession()
    if (!user) return null
    return getStats(user.id)
  }

  // ── Leaderboard ───────────────────────────────────────────────
  function getLeaderboard() {
    const users  = getUsers()
    const board  = []
    for (const [, user] of Object.entries(users)) {
      const stats = getStats(user.id)
      board.push({
        username : user.username,
        plan     : user.plan,
        score    : stats.bestScore,
        accuracy : stats.bestAccuracy,
        sessions : stats.totalSessions,
      })
    }
    return board.sort((a, b) => b.score - a.score).slice(0, 20)
  }

  return {
    signup, login, logout,
    currentUser, requireAuth, requireGuest,
    isPremium, upgradePlan,
    canStartSession, incrementSession, sessionsRemaining,
    recordSession, currentStats,
    getLeaderboard,
  }
})()
