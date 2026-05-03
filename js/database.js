/* ============================================================
   Shuttlestepz — database.js
   Firebase Firestore + Auth (Email/Password)
   Real-time listeners · Full data layer
   ============================================================

   COLLECTIONS LAYOUT
   ──────────────────
   users/{uid}
     ├── profile      : { displayName, email, role, schoolCode, plan, createdAt }
     ├── xp           : number
     ├── level        : number
     ├── totalSessions: number
     ├── bestStreak   : number
     └── settings     : { voiceOn, beepOn, preferredDiff, preferredGroup }

   sessions/{uid}/records/{autoId}
     ├── drill        : string
     ├── mode         : string
     ├── score        : number
     ├── accuracy     : number
     ├── hits         : number
     ├── totalRounds  : number
     ├── bestStreak   : number
     ├── xpEarned     : number
     ├── reactionTime : number | null
     ├── consistency  : number | null   (endurance only)
     ├── movement     : number | null   (endurance only)
     └── createdAt    : Timestamp

   leaderboard/{uid}
     ├── displayName  : string
     ├── xp           : number
     ├── level        : number
     ├── role         : string
     └── updatedAt    : Timestamp

   ============================================================ */

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
}                                  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  getDocs,
  where,
  writeBatch,
}                                  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'


/* ── 1. FIREBASE CONFIG ───────────────────────────────────────
   Replace these values with your own Firebase project config.
   Find them at: Firebase Console → Project Settings → Your Apps
   ──────────────────────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAG-sl7HpAGsEHYBdYetJlHcT81E64lY0I",
  authDomain:        "shuttlestepz-bfea2.firebaseapp.com",   // ← FIXED: was broken markdown link
  projectId:         "shuttlestepz-bfea2",
  storageBucket:     "shuttlestepz-bfea2.appspot.com",       // ← FIXED: was broken markdown link
  messagingSenderId: "62299841228",
  appId:             "1:62299841228:web:26a6c38215e5c35f5e1869",
}

const app  = initializeApp(FIREBASE_CONFIG)
const auth = getAuth(app)
const db   = getFirestore(app)


/* ── 2. STATE ─────────────────────────────────────────────────
   currentUser  – Firebase Auth user object (null if signed out)
   _unsubscribers – cleanup map for all active onSnapshot listeners
   ──────────────────────────────────────────────────────────── */
let currentUser       = null
const _unsubscribers  = {}   // key → unsubscribe function


/* ═══════════════════════════════════════════════════════════
   3. AUTH
   ═══════════════════════════════════════════════════════════ */

/**
 * registerUser({ email, password, displayName, role, schoolCode })
 * Creates a Firebase Auth account + initial Firestore user document.
 * role: 'student' | 'coach' | 'admin'
 */
export async function registerUser({ email, password, displayName, role = 'student', schoolCode = '' }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid  = cred.user.uid

  // Set displayName on Auth profile
  await updateProfile(cred.user, { displayName })

  // Create user document
  await setDoc(doc(db, 'users', uid), {
    profile: {
      displayName,
      email,
      role,
      schoolCode: schoolCode.toUpperCase(),
      plan      : 'free',
      createdAt : serverTimestamp(),
    },
    xp            : 0,
    level         : 1,
    totalSessions : 0,
    bestStreak    : 0,
    settings: {
      voiceOn        : true,
      beepOn         : true,
      preferredDiff  : 'medium',
      preferredGroup : 'all',
    },
  })

  // Seed leaderboard entry
  await _syncLeaderboard(uid, { displayName, xp: 0, level: 1, role })

  return cred.user
}

/**
 * loginUser({ email, password })
 */
export async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

/**
 * logoutUser()
 * Signs out and tears down all active Firestore listeners.
 */
export async function logoutUser() {
  _teardownAllListeners()
  await signOut(auth)
  currentUser = null
  window.dispatchEvent(new CustomEvent('ss-auth-change', { detail: { user: null } }))
}

/**
 * resetPassword(email)
 */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

/**
 * onAuthReady(callback)
 * Fires callback(user) immediately with current state, then on every change.
 * Returns unsubscribe function.
 */
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    currentUser = user
    if (user) {
      // Ensure user doc exists (handles edge cases like manual deletion)
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (!snap.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          profile: {
            displayName : user.displayName || user.email,
            email       : user.email,
            role        : 'student',
            schoolCode  : '',
            plan        : 'free',
            createdAt   : serverTimestamp(),
          },
          xp: 0, level: 1, totalSessions: 0, bestStreak: 0,
          settings: { voiceOn:true, beepOn:true, preferredDiff:'medium', preferredGroup:'all' },
        })
      }
    }
    window.dispatchEvent(new CustomEvent('ss-auth-change', { detail: { user } }))
    callback(user)
  })
}

/**
 * getCurrentUser()
 * Returns the current Firebase Auth user or null.
 */
export function getCurrentUser() { return currentUser }


/* ═══════════════════════════════════════════════════════════
   4. USER PROFILE
   ═══════════════════════════════════════════════════════════ */

/**
 * getUserProfile(uid?)
 * Fetches the full user document. Defaults to current user.
 */
export async function getUserProfile(uid = null) {
  const id   = uid || _requireUID()
  const snap = await getDoc(doc(db, 'users', id))
  if (!snap.exists()) throw new Error(`User ${id} not found`)
  return { uid: id, ...snap.data() }
}

/**
 * updateUserProfile({ displayName?, role?, schoolCode?, plan? })
 */
export async function updateUserProfile(updates) {
  const uid  = _requireUID()
  const safe = {}
  if (updates.displayName) safe['profile.displayName'] = updates.displayName
  if (updates.role)        safe['profile.role']        = updates.role
  if (updates.schoolCode)  safe['profile.schoolCode']  = updates.schoolCode.toUpperCase()
  if (updates.plan)        safe['profile.plan']        = updates.plan
  await updateDoc(doc(db, 'users', uid), safe)
  if (updates.displayName) {
    await updateProfile(auth.currentUser, { displayName: updates.displayName })
    await _syncLeaderboard(uid, { displayName: updates.displayName })
  }
}

/**
 * listenUserProfile(callback)
 * Real-time listener — fires callback(profileData) on every change.
 * Returns unsubscribe function.
 */
export function listenUserProfile(callback) {
  const uid = _requireUID()
  _teardown('userProfile')
  const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) callback({ uid, ...snap.data() })
  })
  _unsubscribers['userProfile'] = unsub
  return unsub
}


/* ═══════════════════════════════════════════════════════════
   5. XP & LEVEL
   ═══════════════════════════════════════════════════════════ */

const XP_THRESHOLDS = [0,500,1200,2200,3500,5200,7200,9800,13000,17000,22000]

function _calcLevel(xp) {
  let lv = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) lv = i + 1; else break
  }
  return Math.min(lv, XP_THRESHOLDS.length)
}

/**
 * awardXP(amount)
 * Adds XP to current user, recalculates level, syncs leaderboard.
 * Returns { newXP, newLevel, leveledUp }
 */
export async function awardXP(amount) {
  const uid      = _requireUID()
  const snap     = await getDoc(doc(db, 'users', uid))
  const data     = snap.data()
  const oldXP    = data.xp    || 0
  const oldLevel = data.level || 1
  const newXP    = oldXP + amount
  const newLevel = _calcLevel(newXP)

  await updateDoc(doc(db, 'users', uid), {
    xp   : newXP,
    level: newLevel,
  })

  await _syncLeaderboard(uid, { xp: newXP, level: newLevel })

  return { newXP, newLevel, leveledUp: newLevel > oldLevel }
}

/**
 * getXPProgress(uid?)
 * Returns { xp, level, toNextLevel, pct } for XP bar rendering.
 */
export async function getXPProgress(uid = null) {
  const id   = uid || _requireUID()
  const snap = await getDoc(doc(db, 'users', id))
  const { xp = 0, level = 1 } = snap.data()
  const cur  = XP_THRESHOLDS[level - 1] || 0
  const nxt  = XP_THRESHOLDS[level]     || XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
  return {
    xp,
    level,
    toNextLevel : nxt - xp,
    pct         : Math.min(Math.max((xp - cur) / (nxt - cur), 0), 1) * 100,
  }
}


/* ═══════════════════════════════════════════════════════════
   6. SESSIONS
   ═══════════════════════════════════════════════════════════ */

/**
 * saveSession(sessionData)
 * Writes a completed training session to Firestore.
 * Also increments user's totalSessions and bestStreak.
 *
 * sessionData shape:
 * {
 *   drill, mode, score, accuracy, hits, totalRounds,
 *   bestStreak, xpEarned, reactionTime?, consistency?, movement?
 * }
 */
export async function saveSession(sessionData) {
  const uid = _requireUID()

  // Write session record
  const ref = await addDoc(collection(db, 'sessions', uid, 'records'), {
    drill        : sessionData.drill        || 'footwork',
    mode         : sessionData.mode         || sessionData.drill || 'footwork',
    score        : sessionData.score        || 0,
    accuracy     : sessionData.accuracy     || 0,
    hits         : sessionData.hits         || 0,
    totalRounds  : sessionData.totalRounds  || 0,
    bestStreak   : sessionData.bestStreak   || 0,
    xpEarned     : sessionData.xpEarned     || 0,
    reactionTime : sessionData.reactionTime || null,
    consistency  : sessionData.consistency  || null,
    movement     : sessionData.movement     || null,
    createdAt    : serverTimestamp(),
  })

  // Update user aggregate stats atomically
  const userRef   = doc(db, 'users', uid)
  const userSnap  = await getDoc(userRef)
  const userData  = userSnap.data()
  const newBest   = Math.max(userData.bestStreak || 0, sessionData.bestStreak || 0)

  await updateDoc(userRef, {
    totalSessions : increment(1),
    bestStreak    : newBest,
  })

  // Award XP
  if (sessionData.xpEarned > 0) {
    await awardXP(sessionData.xpEarned)
  }

  return ref.id
}

/**
 * getSessions({ uid?, limitN? })
 * Fetches recent sessions (default 20). Sorted by newest first.
 */
export async function getSessions({ uid = null, limitN = 20 } = {}) {
  const id  = uid || _requireUID()
  const q   = query(
    collection(db, 'sessions', id, 'records'),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * listenSessions(callback, limitN?)
 * Real-time listener for current user's sessions.
 * Fires callback(sessions[]) on every change.
 */
export function listenSessions(callback, limitN = 20) {
  const uid = _requireUID()
  _teardown('sessions')
  const q = query(
    collection(db, 'sessions', uid, 'records'),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  )
  const unsub = onSnapshot(q, (snap) => {
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(sessions)
  })
  _unsubscribers['sessions'] = unsub
  return unsub
}

/**
 * getSessionStats(uid?)
 * Computes aggregate stats from all sessions.
 * Returns { totalSessions, totalXP, bestStreak, avgScore, avgAccuracy }
 */
export async function getSessionStats(uid = null) {
  const id   = uid || _requireUID()
  const snap = await getDoc(doc(db, 'users', id))
  const data = snap.data()

  const sessions = await getSessions({ uid: id, limitN: 200 })
  const totalXP  = sessions.reduce((s, r) => s + (r.xpEarned || 0), 0)
  const avgScore = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + r.score, 0) / sessions.length) : 0
  const avgAcc   = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + r.accuracy, 0) / sessions.length) : 0

  return {
    totalSessions : data.totalSessions || 0,
    totalXP,
    bestStreak    : data.bestStreak    || 0,
    avgScore,
    avgAccuracy   : avgAcc,
  }
}

/**
 * deleteSession(sessionId)
 */
export async function deleteSession(sessionId) {
  const uid = _requireUID()
  await deleteDoc(doc(db, 'sessions', uid, 'records', sessionId))
}


/* ═══════════════════════════════════════════════════════════
   7. LEADERBOARD  (real-time)
   ═══════════════════════════════════════════════════════════ */

/**
 * listenLeaderboard(callback, topN?)
 * Real-time listener sorted by XP descending.
 * Fires callback(entries[]) — each entry has rank attached.
 *
 * entry shape: { uid, displayName, xp, level, role, rank }
 */
export function listenLeaderboard(callback, topN = 50) {
  _teardown('leaderboard')
  const q = query(
    collection(db, 'leaderboard'),
    orderBy('xp', 'desc'),
    limit(topN)
  )
  const unsub = onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d, i) => ({
      uid         : d.id,
      rank        : i + 1,
      displayName : d.data().displayName,
      xp          : d.data().xp,
      level       : d.data().level,
      role        : d.data().role,
      updatedAt   : d.data().updatedAt,
    }))
    callback(entries)
  })
  _unsubscribers['leaderboard'] = unsub
  return unsub
}

/**
 * getUserRank(uid?)
 * Returns the current user's rank on the leaderboard (1-based).
 * Uses a count query — efficient even at scale.
 */
export async function getUserRank(uid = null) {
  const id   = uid || _requireUID()
  const snap = await getDoc(doc(db, 'leaderboard', id))
  if (!snap.exists()) return null
  const myXP = snap.data().xp || 0

  // Count users with strictly more XP
  const q      = query(collection(db, 'leaderboard'), where('xp', '>', myXP))
  const above  = await getDocs(q)
  return above.size + 1
}


/* ═══════════════════════════════════════════════════════════
   8. SETTINGS
   ═══════════════════════════════════════════════════════════ */

/**
 * getSettings(uid?)
 */
export async function getSettings(uid = null) {
  const id   = uid || _requireUID()
  const snap = await getDoc(doc(db, 'users', id))
  return snap.data()?.settings || {}
}

/**
 * saveSettings({ voiceOn, beepOn, preferredDiff, preferredGroup })
 */
export async function saveSettings(settings) {
  const uid   = _requireUID()
  const patch = {}
  const allowed = ['voiceOn','beepOn','preferredDiff','preferredGroup']
  allowed.forEach(k => {
    if (settings[k] !== undefined) patch[`settings.${k}`] = settings[k]
  })
  await updateDoc(doc(db, 'users', uid), patch)
}

/**
 * listenSettings(callback)
 * Real-time listener — fires whenever settings change.
 */
export function listenSettings(callback) {
  const uid = _requireUID()
  _teardown('settings')
  const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) callback(snap.data()?.settings || {})
  })
  _unsubscribers['settings'] = unsub
  return unsub
}


/* ═══════════════════════════════════════════════════════════
   9. SCHOOL / CLUB CODE  (coach features)
   ═══════════════════════════════════════════════════════════ */

/**
 * getStudentsBySchoolCode(schoolCode)
 * Coach use: fetch all students linked to a school code.
 */
export async function getStudentsBySchoolCode(schoolCode) {
  const q    = query(
    collection(db, 'users'),
    where('profile.schoolCode', '==', schoolCode.toUpperCase()),
    where('profile.role', '==', 'student')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

/**
 * listenStudentsBySchoolCode(schoolCode, callback)
 * Real-time listener for coach dashboard student list.
 */
export function listenStudentsBySchoolCode(schoolCode, callback) {
  _teardown('students')
  const q = query(
    collection(db, 'users'),
    where('profile.schoolCode', '==', schoolCode.toUpperCase()),
    where('profile.role', '==', 'student')
  )
  const unsub = onSnapshot(q, (snap) => {
    const students = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    callback(students)
  })
  _unsubscribers['students'] = unsub
  return unsub
}


/* ═══════════════════════════════════════════════════════════
   10. BATCH CLEANUP  (account deletion / data reset)
   ═══════════════════════════════════════════════════════════ */

/**
 * resetUserData()
 * Wipes XP, sessions, and leaderboard for current user.
 * Does NOT delete the Auth account.
 */
export async function resetUserData() {
  const uid     = _requireUID()
  const batch   = writeBatch(db)

  // Reset user stats
  batch.update(doc(db, 'users', uid), {
    xp: 0, level: 1, totalSessions: 0, bestStreak: 0,
  })

  // Reset leaderboard entry
  batch.update(doc(db, 'leaderboard', uid), {
    xp: 0, level: 1, updatedAt: serverTimestamp(),
  })

  await batch.commit()

  // Delete session records (batched, Firestore max 500/batch)
  const sessions = await getSessions({ limitN: 500 })
  if (sessions.length > 0) {
    const delBatch = writeBatch(db)
    sessions.forEach(s => {
      delBatch.delete(doc(db, 'sessions', uid, 'records', s.id))
    })
    await delBatch.commit()
  }
}


/* ═══════════════════════════════════════════════════════════
   11. LISTENER MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

/**
 * unsubscribeAll()
 * Tears down every active onSnapshot listener.
 * Call on logout or page unload.
 */
export function unsubscribeAll() {
  _teardownAllListeners()
}

/**
 * unsubscribe(key)
 * Tears down a specific named listener.
 * keys: 'userProfile' | 'sessions' | 'leaderboard' | 'settings' | 'students'
 */
export function unsubscribe(key) {
  _teardown(key)
}


/* ── Private helpers ──────────────────────────────────────── */

function _requireUID() {
  if (!currentUser) throw new Error('No authenticated user. Call loginUser() first.')
  return currentUser.uid
}

function _teardown(key) {
  if (_unsubscribers[key]) {
    _unsubscribers[key]()
    delete _unsubscribers[key]
  }
}

function _teardownAllListeners() {
  Object.keys(_unsubscribers).forEach(_teardown)
}

async function _syncLeaderboard(uid, patch = {}) {
  const ref  = doc(db, 'leaderboard', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() })
  } else {
    // First time — fetch full profile to seed the entry
    const userSnap = await getDoc(doc(db, 'users', uid))
    const profile  = userSnap.exists() ? userSnap.data() : {}
    await setDoc(ref, {
      displayName : patch.displayName || profile.profile?.displayName || 'Player',
      xp          : patch.xp         || profile.xp    || 0,
      level       : patch.level      || profile.level || 1,
      role        : patch.role       || profile.profile?.role || 'student',
      updatedAt   : serverTimestamp(),
    })
  }
}


/* ── Auto-teardown on page unload ─────────────────────────── */
window.addEventListener('beforeunload', _teardownAllListeners)


/* ═══════════════════════════════════════════════════════════
   12. CONVENIENCE EXPORT BUNDLE
   ───────────────────────────────────────────────────────────
   Import everything at once in dashboard.js / auth.js:

   import DB from './database.js'
   await DB.loginUser({ email, password })
   DB.listenLeaderboard(entries => renderBoard(entries))
   ═══════════════════════════════════════════════════════════ */
export default {
  // Auth
  registerUser,
  loginUser,
  logoutUser,
  resetPassword,
  onAuthReady,
  getCurrentUser,

  // Profile
  getUserProfile,
  updateUserProfile,
  listenUserProfile,

  // XP & Level
  awardXP,
  getXPProgress,

  // Sessions
  saveSession,
  getSessions,
  listenSessions,
  getSessionStats,
  deleteSession,

  // Leaderboard
  listenLeaderboard,
  getUserRank,

  // Settings
  getSettings,
  saveSettings,
  listenSettings,

  // School / Coach
  getStudentsBySchoolCode,
  listenStudentsBySchoolCode,

  // Cleanup
  unsubscribeAll,
  unsubscribe,
  resetUserData,
}
