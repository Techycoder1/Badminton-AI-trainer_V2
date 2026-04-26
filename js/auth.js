/* ============================================================
   Shuttlestepz — auth.js  (V2)
   Firebase Auth + Firestore
   Requires firebase.js to be loaded first
   ============================================================ */

const AUTH = (() => {

  const FB_VER  = '10.12.0'
  const FB_CDN  = `https://www.gstatic.com/firebasejs/${FB_VER}`
  const SESSION = 'ssz_session'

  // ── Firebase SDK lazy loaders ─────────────────────────────
  async function sdkAuth() {
    return await import(`${FB_CDN}/firebase-auth.js`)
  }
  async function sdkDb() {
    return await import(`${FB_CDN}/firebase-firestore.js`)
  }
  function getAuth() {
    if (!window.fbAuth) throw new Error('firebase.js not loaded')
    return window.fbAuth
  }
  function getDb() {
    if (!window.fbDb) throw new Error('firebase.js not loaded')
    return window.fbDb
  }

  // ── Session cache ─────────────────────────────────────────
  function getCache()       { try { return JSON.parse(sessionStorage.getItem(SESSION)) } catch { return null } }
  function setCache(u)      { sessionStorage.setItem(SESSION, JSON.stringify(u)) }
  function clearCache()     { sessionStorage.removeItem(SESSION) }

  // ── XP / Level system ─────────────────────────────────────
  const LEVELS = [
    { level:1, xp:0,     title:'Rookie'       },
    { level:2, xp:200,   title:'Beginner'     },
    { level:3, xp:500,   title:'Intermediate' },
    { level:4, xp:1000,  title:'Advanced'     },
    { level:5, xp:2000,  title:'Expert'       },
    { level:6, xp:4000,  title:'Elite'        },
    { level:7, xp:8000,  title:'Champion'     },
    { level:8, xp:15000, title:'Legend'       },
  ]

  function calcLevel(xp) {
    let cur = LEVELS[0]
    for (const l of LEVELS) { if (xp >= l.xp) cur = l; else break }
    const nxt  = LEVELS.find(l => l.xp > xp) || null
    const prog = nxt ? Math.round(((xp - cur.xp) / (nxt.xp - cur.xp)) * 100) : 100
    return { ...cur, next: nxt, progress: prog, xp }
  }

  function calcXP(data, isFirst = false) {
    let xp = 50                                           // session complete
    xp += (data.hits || 0) * 2                           // per hit
    const acc = data.totalRounds > 0
      ? (data.hits / data.totalRounds) * 100 : 0
    if (acc >= 90) xp += 30                              // perfect bonus
    xp += 10 * (data.streakDays || 1)                   // streak bonus
    if (isFirst) xp += 100                              // first session ever
    return Math.round(xp)
  }

  function calcStreak(lastDate, current) {
    if (!lastDate) return 1
    const diff = Math.floor((Date.now() - new Date(lastDate)) / 86400000)
    if (diff === 0) return current
    if (diff === 1) return current + 1
    return 1
  }

  const FREE_LIMIT = 5

  // ── Firebase error messages ───────────────────────────────
  function fbMsg(err) {
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

  // ── SIGN UP ───────────────────────────────────────────────
  async function signup(username, email, password, role = 'student', schoolId = null) {
    if (!username || username.trim().length < 3)
      return { ok:false, msg:'Username must be at least 3 characters.' }
    if (!email || !email.includes('@'))
      return { ok:false, msg:'Enter a valid email address.' }
    if (!password || password.length < 6)
      return { ok:false, msg:'Password must be at least 6 characters.' }

    try {
      const auth = getAuth(), db = getDb()
      const { createUserWithEmailAndPassword, updateProfile } = await sdkAuth()
      const { doc, setDoc, serverTimestamp } = await sdkDb()

      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: username.trim() })

      const uid  = cred.user.uid
      const now  = Date.now()

      const profile = {
        uid, role, plan: 'free', schoolId: schoolId || null,
        username: username.trim(),
        email: email.toLowerCase(),
        xp: 0, level: 1,
        streak: 0, bestStreak: 0,
        totalSessions: 0,
        lastSessionDate: null, lastSessionDay: null,
        sessionsToday: 0,
        bestScore: 0, bestAccuracy: 0,
        createdAt: now, updatedAt: now,
      }

      await setDoc(doc(db, 'users', uid), {
        ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      })

      setCache(profile)
      return { ok:true, user:profile }

    } catch(err) {
      return { ok:false, msg: fbMsg(err) }
    }
  }

  // ── LOG IN ────────────────────────────────────────────────
  async function login(email, password) {
    if (!email || !password)
      return { ok:false, msg:'Please fill in all fields.' }

    try {
      const auth = getAuth(), db = getDb()
      const { signInWithEmailAndPassword } = await sdkAuth()
      const { doc, getDoc } = await sdkDb()

      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))

      if (!snap.exists()) return { ok:false, msg:'User profile not found.' }

      const profile = { uid: cred.user.uid, ...snap.data() }
      setCache(profile)
      return { ok:true, user:profile }

    } catch(err) {
      return { ok:false, msg: fbMsg(err) }
    }
  }

  // ── LOG OUT ───────────────────────────────────────────────
  async function logout() {
    try {
      const { signOut } = await sdkAuth()
      await signOut(getAuth())
    } catch(e) {}
    clearCache()
    window.location.href = 'index.html'
  }

  // ── SEND PASSWORD RESET ───────────────────────────────────
  async function sendPasswordReset(email) {
    try {
      const { sendPasswordResetEmail } = await sdkAuth()
      await sendPasswordResetEmail(getAuth(), email)
      return { ok:true }
    } catch(err) {
      return { ok:false, msg: fbMsg(err) }
    }
  }

  // ── AUTH STATE LISTENER ───────────────────────────────────
  async function onAuthChange(cb) {
    const { onAuthStateChanged } = await sdkAuth()
    onAuthStateChanged(getAuth(), async (fbUser) => {
      if (!fbUser) { cb(null); return }
      const cached = getCache()
      if (cached && cached.uid === fbUser.uid) { cb(cached); return }
      try {
        const { doc, getDoc } = await sdkDb()
        const snap = await getDoc(doc(getDb(), 'users', fbUser.uid))
        if (snap.exists()) {
          const p = { uid: fbUser.uid, ...snap.data() }
          setCache(p); cb(p)
        } else { cb(null) }
      } catch { cb(null) }
    })
  }

  // ── GUARDS ───────────────────────────────────────────────
  function currentUser()  { return getCache() }

  function requireAuth(redirect = 'login.html') {
    const u = getCache()
    if (!u) { window.location.href = redirect; return null }
    return u
  }

  function requireGuest(redirect = 'dashboard.html') {
    const u = getCache()
    if (u) { window.location.href = redirect; return null }
  }

  function requireRole(role, redirect = 'dashboard.html') {
    const u = getCache()
    if (!u || u.role !== role) { window.location.href = redirect; return null }
    return u
  }

  // ── PLAN HELPERS ─────────────────────────────────────────
  function isPremium() {
    const u = getCache()
    return u && (u.plan === 'premium' || u.plan === 'school')
  }

  async function upgradePlan(uid, plan = 'premium') {
    try {
      const { doc, updateDoc, serverTimestamp } = await sdkDb()
      await updateDoc(doc(getDb(), 'users', uid), { plan, updatedAt: serverTimestamp() })
      const c = getCache()
      if (c && c.uid === uid) { c.plan = plan; setCache(c) }
      return true
    } catch { return false }
  }

  // ── SESSION LIMITS ────────────────────────────────────────
  function canStartSession() {
    const u = getCache(); if (!u) return false
    if (isPremium()) return true
    const today = new Date().toDateString()
    if (u.lastSessionDay !== today) return true
    return (u.sessionsToday || 0) < FREE_LIMIT
  }

  function sessionsRemaining() {
    const u = getCache(); if (!u) return 0
    if (isPremium()) return Infinity
    const today = new Date().toDateString()
    if (u.lastSessionDay !== today) return FREE_LIMIT
    return Math.max(0, FREE_LIMIT - (u.sessionsToday || 0))
  }

  async function incrementSession() {
    const u = getCache(); if (!u || isPremium()) return
    const today = new Date().toDateString()
    const count = u.lastSessionDay === today ? (u.sessionsToday || 0) + 1 : 1
    u.sessionsToday = count; u.lastSessionDay = today; setCache(u)
    try {
      const { doc, updateDoc } = await sdkDb()
      await updateDoc(doc(getDb(), 'users', u.uid), { sessionsToday: count, lastSessionDay: today })
    } catch(e) {}
  }

  // ── RECORD SESSION ────────────────────────────────────────
  async function recordSession(data) {
    const u = getCache(); if (!u) return null
    try {
      const db = getDb()
      const { doc, getDoc, setDoc, updateDoc,
              collection, addDoc, serverTimestamp, increment } = await sdkDb()

      const snap    = await getDoc(doc(db, 'users', u.uid))
      const stored  = snap.exists() ? snap.data() : u
      const streak  = calcStreak(stored.lastSessionDate, stored.streak || 0)
      const isFirst = (stored.totalSessions || 0) === 0
      const xpEarned= calcXP({ ...data, streakDays: streak }, isFirst)
      const newXP   = (stored.xp || 0) + xpEarned
      const lvl     = calcLevel(newXP)
      const acc     = data.totalRounds > 0 ? Math.round((data.hits / data.totalRounds) * 100) : 0
      const avgMs   = data.roundTimings?.length
        ? Math.round(data.roundTimings.reduce((a,b)=>a+b,0) / data.roundTimings.length) : null
      const today   = new Date().toDateString()

      // Update user document
      const upd = {
        xp: newXP, level: lvl.level,
        streak, bestStreak: Math.max(streak, stored.bestStreak || 0),
        totalSessions: increment(1),
        lastSessionDate: today, lastSessionDay: today,
        updatedAt: serverTimestamp(),
      }
      if ((data.score || 0) > (stored.bestScore || 0))   upd.bestScore    = data.score
      if (acc             > (stored.bestAccuracy || 0)) upd.bestAccuracy = acc
      await updateDoc(doc(db, 'users', u.uid), upd)

      // Save session doc
      await addDoc(collection(db, 'sessions'), {
        userId: u.uid, username: stored.username,
        date: serverTimestamp(), mode: data.mode || 'footwork',
        score: data.score || 0, accuracy: acc, avgReaction: avgMs,
        bestStreak: data.bestStreak || 0,
        totalRounds: data.totalRounds || 0, hits: data.hits || 0,
        dirStats: data.dirStats || {}, xpEarned, streak,
        feedback: data.feedback || [],
      })

      // Update leaderboard
      const lbRef  = doc(db, 'leaderboard', u.uid)
      const lbSnap = await getDoc(lbRef)
      const lbOld  = lbSnap.exists() ? lbSnap.data() : {}
      await setDoc(lbRef, {
        username: stored.username, plan: stored.plan || 'free',
        level: lvl.level, levelTitle: lvl.title,
        bestScore: Math.max(data.score || 0, lbOld.bestScore || 0),
        totalSessions: (lbOld.totalSessions || 0) + 1,
        updatedAt: serverTimestamp(),
      })

      // Update cache
      const updated = { ...u, xp: newXP, level: lvl.level, streak,
        bestStreak: Math.max(streak, u.bestStreak || 0),
        lastSessionDate: today, lastSessionDay: today }
      setCache(updated)

      return { xpEarned, newXP, levelInfo: lvl, streak,
               levelUp: lvl.level > (u.level || 1) }

    } catch(err) {
      console.error('[AUTH] recordSession:', err)
      return null
    }
  }

  // ── STATS ─────────────────────────────────────────────────
  async function currentStats() {
    const u = getCache(); if (!u) return null
    try {
      const db = getDb()
      const { doc, getDoc, collection, query,
              where, orderBy, limit, getDocs } = await sdkDb()

      const snap = await getDoc(doc(db, 'users', u.uid))
      const ud   = snap.exists() ? snap.data() : {}

      const q    = query(collection(db, 'sessions'),
        where('userId', '==', u.uid), orderBy('date', 'desc'), limit(20))
      const snaps = await getDocs(q)

      const history = [], dirStats = {}
      let totalHits = 0, totalRounds = 0

      snaps.forEach(s => {
        const d = s.data()
        history.push({
          id: s.id,
          date: d.date?.toMillis?.() || Date.now(),
          score: d.score, accuracy: d.accuracy,
          rounds: d.totalRounds, reaction: d.avgReaction,
          mode: d.mode, xpEarned: d.xpEarned,
        })
        totalHits   += d.hits || 0
        totalRounds += d.totalRounds || 0
        if (d.dirStats) {
          for (const [dir, ds] of Object.entries(d.dirStats)) {
            if (!dirStats[dir]) dirStats[dir] = { total:0, hit:0 }
            dirStats[dir].total += ds.total || 0
            dirStats[dir].hit   += ds.hit   || 0
          }
        }
      })

      const lvl = calcLevel(ud.xp || 0)
      return {
        username: ud.username, plan: ud.plan, role: ud.role,
        xp: ud.xp || 0, level: lvl.level, levelTitle: lvl.title,
        levelProgress: lvl.progress, nextLevel: lvl.next,
        streak: ud.streak || 0, bestStreak: ud.bestStreak || 0,
        totalSessions: ud.totalSessions || 0, totalRounds, totalHits,
        bestScore: ud.bestScore || 0, bestAccuracy: ud.bestAccuracy || 0,
        history, dirStats,
      }
    } catch(err) {
      console.error('[AUTH] currentStats:', err)
      return null
    }
  }

  // ── LEADERBOARD ───────────────────────────────────────────
  async function getLeaderboard(n = 20) {
    try {
      const { collection, query, orderBy, limit, getDocs } = await sdkDb()
      const q    = query(collection(getDb(), 'leaderboard'), orderBy('bestScore','desc'), limit(n))
      const snaps = await getDocs(q)
      const board = []
      snaps.forEach(s => board.push({ id:s.id, ...s.data() }))
      return board
    } catch { return [] }
  }

  // ── SCHOOL ────────────────────────────────────────────────
  async function getClassStats(schoolId) {
    try {
      const { collection, query, where, getDocs } = await sdkDb()
      const q = query(collection(getDb(),'users'), where('schoolId','==',schoolId))
      const snaps = await getDocs(q)
      const students = []
      snaps.forEach(s => {
        const d = s.data()
        students.push({ uid:s.id, username:d.username, level:d.level||1,
          xp:d.xp||0, streak:d.streak||0,
          totalSessions:d.totalSessions||0, bestScore:d.bestScore||0 })
      })
      return students.sort((a,b) => b.xp - a.xp)
    } catch { return [] }
  }

  // ── UPDATE PROFILE ────────────────────────────────────────
  async function updateProfile(updates) {
    const u = getCache(); if (!u) return { ok:false, msg:'Not logged in.' }
    try {
      const { doc, updateDoc, serverTimestamp } = await sdkDb()
      await updateDoc(doc(getDb(),'users',u.uid), { ...updates, updatedAt:serverTimestamp() })
      setCache({ ...u, ...updates })
      return { ok:true }
    } catch(err) { return { ok:false, msg:err.message } }
  }

  // ── PUBLIC API ────────────────────────────────────────────
  return {
    signup, login, logout, onAuthChange,
    sendPasswordReset, updateProfile,
    currentUser, requireAuth, requireGuest, requireRole,
    isPremium, upgradePlan,
    canStartSession, sessionsRemaining, incrementSession,
    recordSession, currentStats, getLeaderboard, getClassStats,
    calcLevel, LEVELS,
  }

})()

window.AUTH = AUTH
