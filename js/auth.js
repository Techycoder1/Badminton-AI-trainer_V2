/* ============================================================
   Shuttlestepz — auth.js  (V2)
   Firebase Auth + Firestore
   ============================================================

   SETUP — paste your Firebase config into firebase.js:

   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
   import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
   import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"

   const app = initializeApp({ YOUR CONFIG HERE })
   window.fbAuth = getAuth(app)
   window.fbDb   = getFirestore(app)

   ============================================================ */

const AUTH = (() => {

  // ── Firebase module imports (ESM via CDN) ─────────────────────
  const FB_VER = '10.12.0'
  const FB_CDN = `https://www.gstatic.com/firebasejs/${FB_VER}`

  // Lazy-loaded Firebase references
  let _auth = null
  let _db   = null

  async function getAuth() {
    if (_auth) return _auth
    _auth = window.fbAuth
    if (!_auth) throw new Error('Firebase Auth not initialised. Check firebase.js is loaded first.')
    return _auth
  }

  async function getDb() {
    if (_db) return _db
    _db = window.fbDb
    if (!_db) throw new Error('Firestore not initialised. Check firebase.js is loaded first.')
    return _db
  }

  // ── Firebase SDK helpers (dynamic import) ─────────────────────
  async function fbAuth() {
    const { createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
            signOut,
            onAuthStateChanged,
            updateProfile } = await import(`${FB_CDN}/firebase-auth.js`)
    return { createUserWithEmailAndPassword, signInWithEmailAndPassword,
             signOut, onAuthStateChanged, updateProfile }
  }

  async function fbDb() {
    const { doc, getDoc, setDoc, updateDoc,
            collection, addDoc, query, where,
            orderBy, limit, getDocs, serverTimestamp,
            increment } = await import(`${FB_CDN}/firebase-firestore.js`)
    return { doc, getDoc, setDoc, updateDoc,
             collection, addDoc, query, where,
             orderBy, limit, getDocs, serverTimestamp, increment }
  }

  // ── XP / Level config ─────────────────────────────────────────
  const LEVELS = [
    { level: 1, xpRequired: 0,     title: 'Rookie'       },
    { level: 2, xpRequired: 200,   title: 'Beginner'     },
    { level: 3, xpRequired: 500,   title: 'Intermediate' },
    { level: 4, xpRequired: 1000,  title: 'Advanced'     },
    { level: 5, xpRequired: 2000,  title: 'Expert'       },
    { level: 6, xpRequired: 4000,  title: 'Elite'        },
    { level: 7, xpRequired: 8000,  title: 'Champion'     },
    { level: 8, xpRequired: 15000, title: 'Legend'       },
  ]

  const XP = {
    SESSION_COMPLETE : 50,
    HIT_ZONE         : 2,
    PERFECT_ACCURACY : 30,   // bonus if acc >= 90%
    DAILY_STREAK     : 10,   // × streak days
    FIRST_SESSION    : 100,  // one-time
  }

  const FREE_DAILY_LIMIT = 5

  // ── Local session cache (reduces Firestore reads) ─────────────
  const SESSION_KEY = 'ssz_v2_session'

  function getCachedUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
  }

  function setCachedUser(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  }

  function clearCache() {
    sessionStorage.removeItem(SESSION_KEY)
  }

  // ── Level calculator ──────────────────────────────────────────
  function calcLevel(xp) {
    let current = LEVELS[0]
    for (const lvl of LEVELS) {
      if (xp >= lvl.xpRequired) current = lvl
      else break
    }
    const next = LEVELS.find(l => l.xpRequired > xp) || null
    const progress = next
      ? Math.round(((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100)
      : 100
    return { ...current, next, progress, xp }
  }

  // ── XP calculator for a session ───────────────────────────────
  function calcSessionXP(sessionData, isFirstSession = false) {
    let xp = XP.SESSION_COMPLETE

    // Hit bonus
    xp += (sessionData.hits || 0) * XP.HIT_ZONE

    // Perfect accuracy bonus
    const acc = sessionData.totalRounds > 0
      ? (sessionData.hits / sessionData.totalRounds) * 100 : 0
    if (acc >= 90) xp += XP.PERFECT_ACCURACY

    // Streak bonus
    const streak = sessionData.streakDays || 1
    xp += XP.DAILY_STREAK * streak

    // First session ever
    if (isFirstSession) xp += XP.FIRST_SESSION

    return Math.round(xp)
  }

  // ── Streak calculator ─────────────────────────────────────────
  function calcStreak(lastSessionDate, currentStreak) {
    if (!lastSessionDate) return 1
    const last    = new Date(lastSessionDate)
    const today   = new Date()
    const daysDiff = Math.floor((today - last) / (1000 * 60 * 60 * 24))
    if (daysDiff === 0) return currentStreak       // same day
    if (daysDiff === 1) return currentStreak + 1   // consecutive
    return 1                                        // streak broken
  }

  // ── Signup ────────────────────────────────────────────────────
  async function signup(username, email, password, role = 'student', schoolId = null) {
    // Validation
    if (!username || username.trim().length < 3)
      return { ok: false, msg: 'Username must be at least 3 characters.' }
    if (!email || !email.includes('@'))
      return { ok: false, msg: 'Enter a valid email address.' }
    if (!password || password.length < 6)
      return { ok: false, msg: 'Password must be at least 6 characters.' }

    try {
      const auth = await getAuth()
      const db   = await getDb()
      const sdk  = await fbAuth()
      const dbs  = await fbDb()

      // Create Firebase Auth user
      const cred = await sdk.createUserWithEmailAndPassword(auth, email, password)
      await sdk.updateProfile(cred.user, { displayName: username.trim() })

      const uid  = cred.user.uid
      const now  = Date.now()

      // Build user profile
      const profile = {
        uid,
        username    : username.trim(),
        email       : email.toLowerCase(),
        role,                              // 'student' | 'teacher' | 'admin'
        plan        : 'free',             // 'free' | 'premium' | 'school'
        schoolId    : schoolId || null,
        xp          : 0,
        level       : 1,
        streak      : 0,
        bestStreak  : 0,
        totalSessions: 0,
        lastSessionDate: null,
        sessionsToday  : 0,
        lastSessionDay : null,
        createdAt   : now,
        updatedAt   : now,
      }

      // Save to Firestore
      const { doc, setDoc, serverTimestamp } = dbs
      await setDoc(doc(db, 'users', uid), {
        ...profile,
        createdAt : serverTimestamp(),
        updatedAt : serverTimestamp(),
      })

      // Cache locally
      setCachedUser(profile)

      return { ok: true, user: profile }

    } catch (err) {
      return { ok: false, msg: _firebaseErrMsg(err) }
    }
  }

  // ── Login ─────────────────────────────────────────────────────
  async function login(email, password) {
    if (!email || !password)
      return { ok: false, msg: 'Please fill in all fields.' }

    try {
      const auth = await getAuth()
      const db   = await getDb()
      const sdk  = await fbAuth()
      const dbs  = await fbDb()

      const cred = await sdk.signInWithEmailAndPassword(auth, email, password)
      const uid  = cred.user.uid

      // Fetch user profile from Firestore
      const { doc, getDoc } = dbs
      const snap = await getDoc(doc(db, 'users', uid))

      if (!snap.exists()) {
        return { ok: false, msg: 'User profile not found. Please contact support.' }
      }

      const profile = { uid, ...snap.data() }
      setCachedUser(profile)

      return { ok: true, user: profile }

    } catch (err) {
      return { ok: false, msg: _firebaseErrMsg(err) }
    }
  }

  // ── Logout ────────────────────────────────────────────────────
  async function logout() {
    try {
      const auth = await getAuth()
      const sdk  = await fbAuth()
      await sdk.signOut(auth)
    } catch(e) {}
    clearCache()
    window.location.href = 'index.html'
  }

  // ── Auth state listener ───────────────────────────────────────
  async function onAuthChange(callback) {
    const auth = await getAuth()
    const sdk  = await fbAuth()
    sdk.onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { callback(null); return }

      // Try cache first
      const cached = getCachedUser()
      if (cached && cached.uid === firebaseUser.uid) {
        callback(cached); return
      }

      // Fetch from Firestore
      try {
        const db  = await getDb()
        const dbs = await fbDb()
        const { doc, getDoc } = dbs
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          const profile = { uid: firebaseUser.uid, ...snap.data() }
          setCachedUser(profile)
          callback(profile)
        } else {
          callback(null)
        }
      } catch(e) {
        callback(null)
      }
    })
  }

  // ── Current user (sync, from cache) ───────────────────────────
  function currentUser() {
    return getCachedUser()
  }

  // ── Route guards ──────────────────────────────────────────────
  function requireAuth(redirectTo = 'login.html') {
    const user = getCachedUser()
    if (!user) {
      window.location.href = redirectTo
      return null
    }
    return user
  }

  function requireGuest(redirectTo = 'dashboard.html') {
    const user = getCachedUser()
    if (user) {
      window.location.href = redirectTo
      return null
    }
  }

  function requireRole(role, redirectTo = 'dashboard.html') {
    const user = getCachedUser()
    if (!user || user.role !== role) {
      window.location.href = redirectTo
      return null
    }
    return user
  }

  // ── Plan helpers ──────────────────────────────────────────────
  function isPremium() {
    const user = getCachedUser()
    return user && (user.plan === 'premium' || user.plan === 'school')
  }

  async function upgradePlan(uid, plan = 'premium') {
    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { doc, updateDoc, serverTimestamp } = dbs
      await updateDoc(doc(db, 'users', uid), {
        plan,
        updatedAt: serverTimestamp()
      })
      // Update cache
      const cached = getCachedUser()
      if (cached && cached.uid === uid) {
        cached.plan = plan
        setCachedUser(cached)
      }
      return true
    } catch(e) {
      return false
    }
  }

  // ── Session limiter ───────────────────────────────────────────
  function canStartSession() {
    const user = getCachedUser()
    if (!user) return false
    if (isPremium()) return true

    const today = new Date().toDateString()
    if (user.lastSessionDay !== today) return true
    return (user.sessionsToday || 0) < FREE_DAILY_LIMIT
  }

  function sessionsRemaining() {
    const user = getCachedUser()
    if (!user) return 0
    if (isPremium()) return Infinity
    const today = new Date().toDateString()
    if (user.lastSessionDay !== today) return FREE_DAILY_LIMIT
    return Math.max(0, FREE_DAILY_LIMIT - (user.sessionsToday || 0))
  }

  async function incrementSession() {
    const user = getCachedUser()
    if (!user || isPremium()) return

    const today = new Date().toDateString()
    const sessionsToday = user.lastSessionDay === today
      ? (user.sessionsToday || 0) + 1 : 1

    // Update cache
    user.sessionsToday   = sessionsToday
    user.lastSessionDay  = today
    setCachedUser(user)

    // Persist to Firestore
    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { doc, updateDoc } = dbs
      await updateDoc(doc(db, 'users', user.uid), {
        sessionsToday,
        lastSessionDay: today,
      })
    } catch(e) {}
  }

  // ── Record session + award XP ──────────────────────────────────
  async function recordSession(sessionData) {
    const user = getCachedUser()
    if (!user) return null

    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { doc, getDoc, setDoc, updateDoc, collection,
              addDoc, serverTimestamp, increment } = dbs

      const uid = user.uid

      // Fetch latest user doc for accurate XP/streak
      const userSnap = await getDoc(doc(db, 'users', uid))
      const userData  = userSnap.exists() ? userSnap.data() : user

      // ── Streak ──────────────────────────────────────────────
      const newStreak = calcStreak(userData.lastSessionDate, userData.streak || 0)

      // ── XP ──────────────────────────────────────────────────
      const isFirst   = (userData.totalSessions || 0) === 0
      const earnedXP  = calcSessionXP({ ...sessionData, streakDays: newStreak }, isFirst)
      const newXP     = (userData.xp || 0) + earnedXP
      const levelInfo = calcLevel(newXP)

      // ── Accuracy ────────────────────────────────────────────
      const acc = sessionData.totalRounds > 0
        ? Math.round((sessionData.hits / sessionData.totalRounds) * 100) : 0

      const avgReaction = sessionData.roundTimings && sessionData.roundTimings.length
        ? Math.round(sessionData.roundTimings.reduce((a,b) => a+b, 0) / sessionData.roundTimings.length)
        : null

      const today = new Date().toDateString()

      // ── Update user doc ──────────────────────────────────────
      const userUpdate = {
        xp              : newXP,
        level           : levelInfo.level,
        streak          : newStreak,
        bestStreak      : Math.max(newStreak, userData.bestStreak || 0),
        totalSessions   : increment(1),
        lastSessionDate : today,
        lastSessionDay  : today,
        updatedAt       : serverTimestamp(),
      }

      if ((sessionData.score || 0) > (userData.bestScore || 0))
        userUpdate.bestScore = sessionData.score
      if (acc > (userData.bestAccuracy || 0))
        userUpdate.bestAccuracy = acc

      await updateDoc(doc(db, 'users', uid), userUpdate)

      // ── Save session document ────────────────────────────────
      const sessionDoc = {
        userId      : uid,
        username    : userData.username,
        date        : serverTimestamp(),
        mode        : sessionData.mode || 'footwork',
        score       : sessionData.score || 0,
        accuracy    : acc,
        avgReaction : avgReaction,
        bestStreak  : sessionData.bestStreak || 0,
        totalRounds : sessionData.totalRounds || 0,
        hits        : sessionData.hits || 0,
        dirStats    : sessionData.dirStats || {},
        earnedXP,
        streakDay   : newStreak,
        feedback    : sessionData.feedback || [],
      }
      await addDoc(collection(db, 'sessions'), sessionDoc)

      // ── Update leaderboard ───────────────────────────────────
      const lbRef  = doc(db, 'leaderboard', uid)
      const lbSnap = await getDoc(lbRef)
      const lbData = lbSnap.exists() ? lbSnap.data() : {}

      await setDoc(lbRef, {
        username  : userData.username,
        plan      : userData.plan || 'free',
        level     : levelInfo.level,
        levelTitle: levelInfo.title,
        bestScore : Math.max(sessionData.score || 0, lbData.bestScore || 0),
        totalSessions: (lbData.totalSessions || 0) + 1,
        updatedAt : serverTimestamp(),
      })

      // ── Update local cache ───────────────────────────────────
      const updatedUser = {
        ...user,
        xp          : newXP,
        level       : levelInfo.level,
        streak      : newStreak,
        bestStreak  : Math.max(newStreak, user.bestStreak || 0),
        lastSessionDate: today,
        lastSessionDay : today,
      }
      setCachedUser(updatedUser)

      return {
        earnedXP,
        newXP,
        levelInfo,
        newStreak,
        levelUp: levelInfo.level > (user.level || 1),
      }

    } catch(err) {
      console.error('[AUTH] recordSession error:', err)
      return null
    }
  }

  // ── Fetch user stats ──────────────────────────────────────────
  async function currentStats() {
    const user = getCachedUser()
    if (!user) return null

    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { doc, getDoc, collection, query, where,
              orderBy, limit, getDocs } = dbs

      // User profile
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const userData  = userSnap.exists() ? userSnap.data() : {}

      // Last 20 sessions
      const q = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(20)
      )
      const sessionSnaps = await getDocs(q)
      const history = []
      let totalHits = 0, totalRounds = 0
      const dirStats = {}

      sessionSnaps.forEach(s => {
        const d = s.data()
        history.push({
          id        : s.id,
          date      : d.date?.toMillis?.() || Date.now(),
          score     : d.score,
          accuracy  : d.accuracy,
          rounds    : d.totalRounds,
          reaction  : d.avgReaction,
          mode      : d.mode,
          earnedXP  : d.earnedXP,
          streak    : d.streakDay,
        })
        totalHits   += d.hits || 0
        totalRounds += d.totalRounds || 0
        // Merge direction stats
        if (d.dirStats) {
          for (const [dir, ds] of Object.entries(d.dirStats)) {
            if (!dirStats[dir]) dirStats[dir] = { total: 0, hit: 0 }
            dirStats[dir].total += ds.total || 0
            dirStats[dir].hit   += ds.hit   || 0
          }
        }
      })

      const levelInfo = calcLevel(userData.xp || 0)

      return {
        // Profile
        username     : userData.username,
        plan         : userData.plan,
        role         : userData.role,
        // XP / Level
        xp           : userData.xp || 0,
        level        : levelInfo.level,
        levelTitle   : levelInfo.title,
        levelProgress: levelInfo.progress,
        nextLevel    : levelInfo.next,
        // Streaks
        streak       : userData.streak || 0,
        bestStreak   : userData.bestStreak || 0,
        // Totals
        totalSessions: userData.totalSessions || 0,
        totalRounds,
        totalHits,
        // Bests
        bestScore    : userData.bestScore || 0,
        bestAccuracy : userData.bestAccuracy || 0,
        // History + breakdown
        history,
        dirStats,
      }

    } catch(err) {
      console.error('[AUTH] currentStats error:', err)
      return null
    }
  }

  // ── Leaderboard ───────────────────────────────────────────────
  async function getLeaderboard(limitN = 20) {
    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { collection, query, orderBy, limit, getDocs } = dbs

      const q    = query(
        collection(db, 'leaderboard'),
        orderBy('bestScore', 'desc'),
        limit(limitN)
      )
      const snaps = await getDocs(q)
      const board = []
      snaps.forEach(s => board.push({ id: s.id, ...s.data() }))
      return board

    } catch(err) {
      console.error('[AUTH] getLeaderboard error:', err)
      return []
    }
  }

  // ── School helpers ────────────────────────────────────────────
  async function getClassStats(schoolId) {
    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { collection, query, where, getDocs, orderBy } = dbs

      // Get all students in school
      const studQ  = query(collection(db, 'users'), where('schoolId', '==', schoolId))
      const studSnaps = await getDocs(studQ)
      const students  = []

      for (const s of studSnaps.docs) {
        const d = s.data()
        students.push({
          uid      : s.id,
          username : d.username,
          level    : d.level || 1,
          xp       : d.xp || 0,
          streak   : d.streak || 0,
          totalSessions: d.totalSessions || 0,
          bestScore: d.bestScore || 0,
          plan     : d.plan,
        })
      }

      return students.sort((a, b) => b.xp - a.xp)

    } catch(err) {
      console.error('[AUTH] getClassStats error:', err)
      return []
    }
  }

  // ── Password reset ────────────────────────────────────────────
  async function sendPasswordReset(email) {
    try {
      const auth = await getAuth()
      const { sendPasswordResetEmail } = await import(`${FB_CDN}/firebase-auth.js`)
      await sendPasswordResetEmail(auth, email)
      return { ok: true }
    } catch(err) {
      return { ok: false, msg: _firebaseErrMsg(err) }
    }
  }

  // ── Update profile ────────────────────────────────────────────
  async function updateProfile(updates) {
    const user = getCachedUser()
    if (!user) return { ok: false, msg: 'Not logged in.' }
    try {
      const db  = await getDb()
      const dbs = await fbDb()
      const { doc, updateDoc, serverTimestamp } = dbs
      await updateDoc(doc(db, 'users', user.uid), {
        ...updates,
        updatedAt: serverTimestamp()
      })
      const updated = { ...user, ...updates }
      setCachedUser(updated)
      return { ok: true, user: updated }
    } catch(err) {
      return { ok: false, msg: err.message }
    }
  }

  // ── Firebase error messages ───────────────────────────────────
  function _firebaseErrMsg(err) {
    const map = {
      'auth/email-already-in-use'   : 'An account with this email already exists.',
      'auth/invalid-email'          : 'Invalid email address.',
      'auth/weak-password'          : 'Password must be at least 6 characters.',
      'auth/user-not-found'         : 'No account found with this email.',
      'auth/wrong-password'         : 'Incorrect password.',
      'auth/too-many-requests'      : 'Too many attempts. Try again later.',
      'auth/network-request-failed' : 'Network error. Check your connection.',
      'auth/invalid-credential'     : 'Incorrect email or password.',
    }
    return map[err.code] || err.message || 'Something went wrong.'
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    // Auth
    signup,
    login,
    logout,
    onAuthChange,
    currentUser,
    sendPasswordReset,
    updateProfile,

    // Guards
    requireAuth,
    requireGuest,
    requireRole,

    // Plan
    isPremium,
    upgradePlan,

    // Session control
    canStartSession,
    sessionsRemaining,
    incrementSession,

    // Data
    recordSession,
    currentStats,
    getLeaderboard,

    // School
    getClassStats,

    // Utils
    calcLevel,
    calcSessionXP,
    LEVELS,
    XP,
  }

})()
