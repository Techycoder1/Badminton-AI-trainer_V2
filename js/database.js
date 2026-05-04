/* ============================================================
   Shuttlestepz — database.js
   All Firebase Auth + Firestore operations in one place.
   Imported by auth.js — never load directly in HTML.
   ============================================================ */

import { auth, db, rtdb } from './firebase.js'

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'

import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'

/* ── Internal helpers ─────────────────────────────────────── */
function uid() { return auth.currentUser?.uid || null }

function userRef(id)      { return doc(db, 'users', id || uid()) }
function sessionsRef(id)  { return collection(db, 'users', id || uid(), 'sessions') }
function settingsRef(id)  { return doc(db, 'users', id || uid(), 'meta', 'settings') }
function leaderRef()      { return collection(db, 'leaderboard') }

/* ── Auth state ───────────────────────────────────────────── */
function onAuthReady(cb) {
  onAuthStateChanged(auth, cb)
}

/* ── Register ─────────────────────────────────────────────── */
async function registerUser({ email, password, displayName, role, schoolCode }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })

  const profile = {
    displayName,
    email,
    role        : role       || 'student',
    plan        : 'free',
    schoolCode  : schoolCode || '',
    createdAt   : serverTimestamp(),
  }

  await setDoc(userRef(cred.user.uid), {
    profile,
    xp           : 100,   // signup bonus
    level        : 1,
    streak       : 0,
    bestStreak   : 0,
    totalSessions: 0,
    bestScore    : 0,
    bestAccuracy : 0,
    sessionsToday: 0,
    lastSessionDay: '',
  })

  /* Leaderboard entry */
  await setDoc(doc(db, 'leaderboard', cred.user.uid), {
    uid        : cred.user.uid,
    displayName,
    xp         : 100,
    level      : 1,
    role       : role || 'student',
    updatedAt  : serverTimestamp(),
  })

  console.log('[DB] ✅ User registered:', cred.user.uid)
  return cred
}

/* ── Login ────────────────────────────────────────────────── */
async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  console.log('[DB] ✅ Logged in:', cred.user.uid)
  return cred
}

/* ── Logout ───────────────────────────────────────────────── */
async function logoutUser() {
  await signOut(auth)
  console.log('[DB] 👋 Logged out')
}

/* ── Password reset ───────────────────────────────────────── */
async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

/* ── Get user profile ─────────────────────────────────────── */
async function getUserProfile(id) {
  const snap = await getDoc(userRef(id))
  if (!snap.exists()) throw new Error('Profile not found')
  return snap.data()
}

/* ── Update user profile fields ───────────────────────────── */
async function updateUserProfile(fields) {
  const ref  = userRef()
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('No user document')

  /* Separate top-level fields from profile sub-fields */
  const topLevel = {}
  const profLevel = {}
  const TOP_KEYS = ['xp','level','streak','bestStreak','totalSessions','bestScore',
                    'bestAccuracy','sessionsToday','lastSessionDay']

  for (const [k, v] of Object.entries(fields)) {
    if (TOP_KEYS.includes(k)) topLevel[k] = v
    else profLevel[`profile.${k}`] = v
  }

  const merged = { ...topLevel, ...profLevel }
  if (Object.keys(merged).length) await updateDoc(ref, merged)
}

/* ── Save session ─────────────────────────────────────────── */
async function saveSession(data) {
  const id = uid(); if (!id) throw new Error('Not authenticated')

  await addDoc(sessionsRef(id), {
    ...data,
    createdAt: serverTimestamp(),
  })

  /* Update user aggregate stats */
  const ref  = userRef(id)
  const snap = await getDoc(ref)
  const d    = snap.data() || {}

  const today          = new Date().toDateString()
  const lastDay        = d.lastSessionDay || ''
  const sessionsToday  = lastDay === today ? (d.sessionsToday || 0) + 1 : 1
  const newStreak      = lastDay === new Date(Date.now() - 86400000).toDateString()
                         ? (d.streak || 0) + 1 : 1
  const bestStreak     = Math.max(d.bestStreak || 0, newStreak)

  await updateDoc(ref, {
    totalSessions : increment(1),
    sessionsToday,
    lastSessionDay: today,
    streak        : newStreak,
    bestStreak,
    bestScore     : Math.max(d.bestScore    || 0, data.score    || 0),
    bestAccuracy  : Math.max(d.bestAccuracy || 0, data.accuracy || 0),
  })
}

/* ── Award XP ─────────────────────────────────────────────── */
const XP_THRESH = [0,500,1200,2200,3500,5200,7200,9800,13000,17000,22000]

async function awardXP(amount) {
  const id = uid(); if (!id) throw new Error('Not authenticated')
  const ref  = userRef(id)
  const snap = await getDoc(ref)
  const d    = snap.data() || {}

  const newXP    = (d.xp || 0) + amount
  let newLevel   = 1
  for (let i = 1; i < XP_THRESH.length; i++) {
    if (newXP >= XP_THRESH[i]) newLevel = i + 1; else break
  }
  newLevel = Math.min(newLevel, XP_THRESH.length)

  await updateDoc(ref, { xp: newXP, level: newLevel })

  /* Sync leaderboard */
  try {
    await setDoc(doc(db, 'leaderboard', id), {
      xp       : newXP,
      level    : newLevel,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  } catch(e) { console.warn('[DB] Leaderboard sync failed:', e.message) }

  return { newXP, newLevel, xpAdded: amount }
}

/* ── Get sessions ─────────────────────────────────────────── */
async function getSessions({ limitN = 20 } = {}) {
  const id = uid(); if (!id) return []
  const q  = query(sessionsRef(id), orderBy('createdAt', 'desc'), limit(limitN))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/* ── Listen sessions (real-time) ─────────────────────────── */
const _unsubs = []
function listenSessions(cb, limitN = 20) {
  const id = uid(); if (!id) return () => {}
  const q  = query(sessionsRef(id), orderBy('createdAt','desc'), limit(limitN))
  const unsub = onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
  _unsubs.push(unsub)
  return unsub
}

/* ── Listen leaderboard (real-time) ──────────────────────── */
function listenLeaderboard(cb, limitN = 20) {
  const q = query(leaderRef(), orderBy('xp','desc'), limit(limitN))
  const unsub = onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
  _unsubs.push(unsub)
  return unsub
}

/* ── Listen profile (real-time) ──────────────────────────── */
function listenUserProfile(cb) {
  const id = uid(); if (!id) return () => {}
  const unsub = onSnapshot(userRef(id), snap => {
    if (snap.exists()) cb(snap.data())
  })
  _unsubs.push(unsub)
  return unsub
}

/* ── Settings ─────────────────────────────────────────────── */
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

/* ── Students by school code ─────────────────────────────── */
async function getStudentsBySchoolCode(code) {
  try {
    const q    = query(collection(db, 'users'))
    const snap = await getDocs(q)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.profile?.schoolCode === code)
  } catch { return [] }
}

/* ── Unsubscribe all listeners ───────────────────────────── */
function unsubscribeAll() {
  _unsubs.forEach(fn => { try { fn() } catch {} })
  _unsubs.length = 0
}

/* ── Default export ─────────────────────────────────────────── */
const DB = {
  onAuthReady,
  registerUser,
  loginUser,
  logoutUser,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  saveSession,
  awardXP,
  getSessions,
  listenSessions,
  listenLeaderboard,
  listenUserProfile,
  getSettings,
  saveSettings,
  listenSettings,
  getStudentsBySchoolCode,
  unsubscribeAll,
  /* expose raw firebase objects for advanced use */
  auth, db, rtdb,
}

export default DB
