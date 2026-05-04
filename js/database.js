/* ============================================================
   Shuttlestepz — database.js  v3
   Firestore  → profiles, sessions, settings, leaderboard
   Realtime DB → presence, live XP, active sessions, fast lb
   Imported by auth.js only — never load via <script> tag
   ============================================================ */

import { auth, db, rtdb } from './firebase.js'

/* ── Firebase Auth ────────────────────────────────────────── */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'

/* ── Firestore ────────────────────────────────────────────── */
import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

/* ── Realtime Database ────────────────────────────────────── */
import {
  ref, set, get, update, push, remove,
  onValue, onDisconnect,
  serverTimestamp as rtServerTimestamp,
  query as rtQuery, orderByChild, limitToLast,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js'

console.log('[DB] ✅ database.js loaded — Firestore + Realtime DB ready')

/* ════════════════════════════════════════════════════════════
   FIRESTORE REFS
════════════════════════════════════════════════════════════ */
const uid         = ()   => auth.currentUser?.uid || null
const userRef     = (id) => doc(db,        'users',       id || uid())
const sessionsRef = (id) => collection(db, 'users',       id || uid(), 'sessions')
const settingsRef = (id) => doc(db,        'users',       id || uid(), 'meta', 'settings')
const leaderRef   = ()   => collection(db, 'leaderboard')

/* ════════════════════════════════════════════════════════════
   REALTIME DATABASE REFS
   /presence/{uid}         → online status
   /users/{uid}/xp         → live XP
   /users/{uid}/streak     → live streak
   /users/{uid}/activeSess → running session
   /leaderboard/{uid}      → fast ranked list
════════════════════════════════════════════════════════════ */
const rtUserRef     = (id) => ref(rtdb, `users/${id     || uid()}`)
const rtXpRef       = (id) => ref(rtdb, `users/${id     || uid()}/xp`)
const rtStreakRef   = (id) => ref(rtdb, `users/${id     || uid()}/streak`)
const rtPresenceRef = (id) => ref(rtdb, `presence/${id  || uid()}`)
const rtActiveRef   = (id) => ref(rtdb, `users/${id     || uid()}/activeSess`)
const rtLeaderRef   = ()   => ref(rtdb, 'leaderboard')
const rtLeaderEntry = (id) => ref(rtdb, `leaderboard/${id || uid()}`)

/* ════════════════════════════════════════════════════════════
   PRESENCE
════════════════════════════════════════════════════════════ */
async function setupPresence(displayName) {
  const id = uid(); if (!id) return
  const connRef = ref(rtdb, '.info/connected')

  onValue(connRef, async (snap) => {
    if (!snap.val()) return
    await onDisconnect(rtPresenceRef(id)).set({
      online: false, displayName, lastSeen: rtServerTimestamp(),
    })
    await set(rtPresenceRef(id), {
      online: true, displayName, lastSeen: rtServerTimestamp(),
    })
    console.log('[RTDB] 🟢 Presence set — online')
  })
}

function listenOnlineCount(cb) {
  return onValue(ref(rtdb, 'presence'), snap => {
    let count = 0
    snap.forEach(child => { if (child.val()?.online) count++ })
    cb(count)
  })
}

/* ════════════════════════════════════════════════════════════
   AUTH STATE
════════════════════════════════════════════════════════════ */
function onAuthReady(cb) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      await setupPresence(fbUser.displayName || 'Athlete')
    } else {
      const id = uid()
      if (id) {
        try {
          await set(rtPresenceRef(id), { online: false, lastSeen: rtServerTimestamp() })
        } catch {}
      }
    }
    cb(fbUser)
  })
}

/* ════════════════════════════════════════════════════════════
   REGISTER
════════════════════════════════════════════════════════════ */
async function registerUser({ email, password, displayName, role, schoolCode }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  const id = cred.user.uid

  /* Firestore profile */
  await setDoc(userRef(id), {
    profile: {
      displayName, email,
      role      : role       || 'student',
      plan      : 'free',
      schoolCode: schoolCode || '',
      createdAt : serverTimestamp(),
    },
    xp: 100, level: 1, streak: 0, bestStreak: 0,
    totalSessions: 0, bestScore: 0, bestAccuracy: 0,
    sessionsToday: 0, lastSessionDay: '',
  })

  /* Firestore leaderboard */
  await setDoc(doc(db, 'leaderboard', id), {
    uid: id, displayName, xp: 100, level: 1,
    role: role || 'student', updatedAt: serverTimestamp(),
  })

  /* RTDB live data */
  await set(rtUserRef(id), {
    displayName, xp: 100, level: 1, streak: 0,
    role: role || 'student', plan: 'free',
  })

  /* RTDB leaderboard */
  await set(rtLeaderEntry(id), {
    displayName, xp: 100, level: 1,
    role: role || 'student', updatedAt: Date.now(),
  })

  console.log('[DB] ✅ User registered:', id)
  return cred
}

/* ════════════════════════════════════════════════════════════
   LOGIN / LOGOUT / RESET
════════════════════════════════════════════════════════════ */
async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  console.log('[DB] ✅ Logged in:', cred.user.uid)
  return cred
}

async function logoutUser() {
  const id = uid()
  if (id) {
    try { await set(rtPresenceRef(id), { online: false, lastSeen: rtServerTimestamp() }) } catch {}
  }
  await signOut(auth)
  console.log('[DB] 👋 Logged out')
}

async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

/* ════════════════════════════════════════════════════════════
   FIRESTORE PROFILE
════════════════════════════════════════════════════════════ */
async function getUserProfile(id) {
  const snap = await getDoc(userRef(id))
  if (!snap.exists()) throw new Error('Profile not found')
  return snap.data()
}

async function updateUserProfile(fields) {
  const r    = userRef()
  const snap = await getDoc(r)
  if (!snap.exists()) throw new Error('No user document')

  const topLevel  = {}
  const profLevel = {}
  const TOP_KEYS  = ['xp','level','streak','bestStreak','totalSessions',
                     'bestScore','bestAccuracy','sessionsToday','lastSessionDay']

  for (const [k, v] of Object.entries(fields)) {
    if (TOP_KEYS.includes(k)) topLevel[k] = v
    else profLevel[`profile.${k}`] = v
  }

  const merged = { ...topLevel, ...profLevel }
  if (Object.keys(merged).length) await updateDoc(r, merged)

  /* Mirror plan/role to RTDB */
  const rtUpdates = {}
  if (fields.plan) rtUpdates.plan = fields.plan
  if (fields.role) rtUpdates.role = fields.role
  if (Object.keys(rtUpdates).length) {
    try { await update(rtUserRef(), rtUpdates) } catch {}
  }
}

/* ════════════════════════════════════════════════════════════
   SAVE SESSION
════════════════════════════════════════════════════════════ */
async function saveSession(data) {
  const id = uid(); if (!id) throw new Error('Not authenticated')

  await addDoc(sessionsRef(id), { ...data, createdAt: serverTimestamp() })

  const snap    = await getDoc(userRef(id))
  const d       = snap.data() || {}
  const today   = new Date().toDateString()
  const lastDay = d.lastSessionDay || ''
  const sessCnt = lastDay === today ? (d.sessionsToday || 0) + 1 : 1
  const newStrk = lastDay === new Date(Date.now() - 86400000).toDateString()
                  ? (d.streak || 0) + 1 : 1
  const bestStrk = Math.max(d.bestStreak || 0, newStrk)

  await updateDoc(userRef(id), {
    totalSessions : increment(1),
    sessionsToday : sessCnt,
    lastSessionDay: today,
    streak        : newStrk,
    bestStreak    : bestStrk,
    bestScore     : Math.max(d.bestScore    || 0, data.score    || 0),
    bestAccuracy  : Math.max(d.bestAccuracy || 0, data.accuracy || 0),
  })

  /* Sync streak to RTDB */
  try { await update(rtUserRef(id), { streak: newStrk }) } catch {}
}

/* ════════════════════════════════════════════════════════════
   ACTIVE SESSION (RTDB — live drill broadcast)
════════════════════════════════════════════════════════════ */
async function startActiveSession(drillName) {
  const id = uid(); if (!id) return
  await set(rtActiveRef(id), {
    drill: drillName, startedAt: Date.now(),
    hits: 0, score: 0, active: true,
  })
  onDisconnect(rtActiveRef(id)).remove()
  console.log('[RTDB] 🏸 Active session started:', drillName)
}

async function updateActiveSession(updates) {
  const id = uid(); if (!id) return
  try { await update(rtActiveRef(id), updates) } catch {}
}

async function endActiveSession() {
  const id = uid(); if (!id) return
  try { await remove(rtActiveRef(id)) } catch {}
  console.log('[RTDB] 🏁 Active session ended')
}

function listenActiveSession(userId, cb) {
  return onValue(rtActiveRef(userId), snap => {
    cb(snap.exists() ? snap.val() : null)
  })
}

/* ════════════════════════════════════════════════════════════
   AWARD XP — writes Firestore + RTDB + both leaderboards
════════════════════════════════════════════════════════════ */
const XP_THRESH = [0, 500, 1200, 2200, 3500, 5200, 7200, 9800, 13000, 17000, 22000]

async function awardXP(amount) {
  const id = uid(); if (!id) throw new Error('Not authenticated')

  const snap   = await getDoc(userRef(id))
  const d      = snap.data() || {}
  const newXP  = (d.xp || 0) + amount
  let newLevel = 1
  for (let i = 1; i < XP_THRESH.length; i++) {
    if (newXP >= XP_THRESH[i]) newLevel = i + 1; else break
  }
  newLevel = Math.min(newLevel, XP_THRESH.length)

  /* Firestore */
  await updateDoc(userRef(id), { xp: newXP, level: newLevel })

  /* RTDB live XP */
  try { await update(rtUserRef(id), { xp: newXP, level: newLevel }) } catch {}

  /* Firestore leaderboard */
  try {
    await setDoc(doc(db, 'leaderboard', id),
      { xp: newXP, level: newLevel, updatedAt: serverTimestamp() },
      { merge: true })
  } catch {}

  /* RTDB leaderboard */
  try {
    await update(rtLeaderEntry(id), { xp: newXP, level: newLevel, updatedAt: Date.now() })
  } catch {}

  console.log(`[DB] ⚡ XP +${amount} → ${newXP} (Level ${newLevel})`)
  return { newXP, newLevel, xpAdded: amount }
}

/* Live XP listener (RTDB — instant) */
function listenLiveXP(cb) {
  const id = uid(); if (!id) return () => {}
  return onValue(rtXpRef(id), snap => cb(snap.val() || 0))
}

/* ════════════════════════════════════════════════════════════
   LEADERBOARD
════════════════════════════════════════════════════════════ */

/* RTDB leaderboard — fast, real-time */
function listenRTLeaderboard(cb, limitN = 20) {
  const q = rtQuery(rtLeaderRef(), orderByChild('xp'), limitToLast(limitN))
  return onValue(q, snap => {
    const entries = []
    snap.forEach(child => entries.push({ id: child.key, ...child.val() }))
    entries.sort((a, b) => (b.xp || 0) - (a.xp || 0))
    cb(entries)
  })
}

/* Firestore leaderboard — fallback */
const _unsubs = []
function listenLeaderboard(cb, limitN = 20) {
  const q = query(leaderRef(), orderBy('xp', 'desc'), limit(limitN))
  const unsub = onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
  _unsubs.push(unsub)
  return unsub
}

/* ════════════════════════════════════════════════════════════
   SESSIONS (Firestore)
════════════════════════════════════════════════════════════ */
async function getSessions({ limitN = 20 } = {}) {
  const id = uid(); if (!id) return []
  const q  = query(sessionsRef(id), orderBy('createdAt', 'desc'), limit(limitN))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function listenSessions(cb, limitN = 20) {
  const id = uid(); if (!id) return () => {}
  const q  = query(sessionsRef(id), orderBy('createdAt', 'desc'), limit(limitN))
  const unsub = onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
  _unsubs.push(unsub)
  return unsub
}

function listenUserProfile(cb) {
  const id = uid(); if (!id) return () => {}
  const unsub = onSnapshot(userRef(id), snap => {
    if (snap.exists()) cb(snap.data())
  })
  _unsubs.push(unsub)
  return unsub
}

/* ════════════════════════════════════════════════════════════
   SETTINGS (Firestore)
════════════════════════════════════════════════════════════ */
async function getSettings() {
  try {
    const snap = await getDoc(settingsRef())
    return snap.exists() ? snap.data() : {}
  } catch { return {} }
}
async function saveSettings(s) {
  await setDoc(settingsRef(), s, { merge: true })
}
function listenSettings(cb) {
  const unsub = onSnapshot(settingsRef(), snap => {
    if (snap.exists()) cb(snap.data())
  })
  _unsubs.push(unsub)
  return unsub
}

/* ════════════════════════════════════════════════════════════
   SCHOOL / CLASS
════════════════════════════════════════════════════════════ */
async function getStudentsBySchoolCode(code) {
  try {
    const snap = await getDocs(query(collection(db, 'users')))
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.profile?.schoolCode === code)
  } catch { return [] }
}

/* ════════════════════════════════════════════════════════════
   CLEANUP
════════════════════════════════════════════════════════════ */
function unsubscribeAll() {
  _unsubs.forEach(fn => { try { fn() } catch {} })
  _unsubs.length = 0
}

/* ════════════════════════════════════════════════════════════
   EXPORT
════════════════════════════════════════════════════════════ */
const DB = {
  /* Auth */
  onAuthReady, registerUser, loginUser, logoutUser, resetPassword,
  /* Profile */
  getUserProfile, updateUserProfile,
  /* Sessions */
  saveSession, getSessions, listenSessions,
  /* XP & leaderboard */
  awardXP, listenLiveXP, listenLeaderboard, listenRTLeaderboard,
  /* Active session */
  startActiveSession, updateActiveSession, endActiveSession, listenActiveSession,
  /* Presence */
  setupPresence, listenOnlineCount,
  /* Listeners */
  listenUserProfile,
  /* Settings */
  getSettings, saveSettings, listenSettings,
  /* School */
  getStudentsBySchoolCode,
  /* Cleanup */
  unsubscribeAll,
  /* Raw objects */
  auth, db, rtdb,
}

export default DB
