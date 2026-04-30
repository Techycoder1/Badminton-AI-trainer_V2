// js/auth.js — Shuttlestepz Auth module
// Fixes applied:
//   • Imports auth + db from firebase.js (no window.* globals)
//   • Full try/catch around every async operation
//   • 12-second timeout guard on Firestore write
//   • Firestore write failure is NON-fatal (auth user already exists)
//   • updateProfile awaited correctly
//   • Friendly error messages for all Firebase error codes
//   • requireGuest / requireAuth helpers
//   • upgradePlan stub included

import { auth, db } from "/Badminton-AI-trainer_V2/js/firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Wraps a promise with a hard timeout. Rejects with a clear message if exceeded. */
function withTimeout(promise, ms = 12000, label = "Operation") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

/** Maps Firebase auth error codes → human-readable strings. */
function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use":    "That email is already registered. Try logging in.",
    "auth/invalid-email":           "That email address doesn't look right.",
    "auth/weak-password":           "Password is too weak — use at least 6 characters.",
    "auth/network-request-failed":  "Network error. Check your connection and try again.",
    "auth/too-many-requests":       "Too many attempts. Please wait a moment and try again.",
    "auth/user-not-found":          "No account found with that email.",
    "auth/wrong-password":          "Incorrect password.",
    "auth/popup-closed-by-user":    "Sign-in window was closed. Please try again.",
    "auth/operation-not-allowed":   "Email/password sign-in is not enabled. Contact support.",
  };
  return map[code] || `Something went wrong (${code || "unknown"}). Please try again.`;
}

// ─────────────────────────────────────────────────────────────
// Core: signup
// ─────────────────────────────────────────────────────────────

/**
 * Creates an auth user, sets their display name, and writes a Firestore profile.
 *
 * @returns {{ ok: boolean, user?: object, msg?: string }}
 */
async function signup(username, email, password, role = "student", schoolId = null) {
  let firebaseUser = null;

  // ── Step 1: Create auth user ──────────────────────────────
  try {
    console.log("[signup] Step 1 — createUserWithEmailAndPassword");
    const cred = await withTimeout(
      createUserWithEmailAndPassword(auth, email, password),
      10000,
      "Auth user creation"
    );
    firebaseUser = cred.user;
    console.log("[signup] ✔ Auth user created:", firebaseUser.uid);
  } catch (err) {
    console.error("[signup] ✘ Auth creation failed:", err.code, err.message);
    return { ok: false, msg: friendlyAuthError(err.code) };
  }

  // ── Step 2: Set display name via updateProfile ────────────
  try {
    console.log("[signup] Step 2 — updateProfile");
    await withTimeout(
      updateProfile(firebaseUser, { displayName: username }),
      8000,
      "updateProfile"
    );
    console.log("[signup] ✔ displayName set:", username);
  } catch (err) {
    // Non-fatal: profile name cosmetic only, don't abort signup
    console.warn("[signup] ⚠ updateProfile failed (non-fatal):", err.message);
  }

  // ── Step 3: Write Firestore user document ─────────────────
  try {
    console.log("[signup] Step 3 — setDoc to users/" + firebaseUser.uid);

    const userDoc = {
      uid:       firebaseUser.uid,
      username:  username,
      email:     email,
      role:      role,
      plan:      "free",
      schoolId:  schoolId,
      xp:        100,                // sign-up bonus
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    };

    await withTimeout(
      setDoc(doc(db, "users", firebaseUser.uid), userDoc),
      12000,
      "Firestore profile write"
    );

    console.log("[signup] ✔ Firestore document written");
  } catch (err) {
    // Non-fatal: the auth account exists; Firestore can be retried on next login.
    // Still log it loudly so you see it in the console.
    console.error("[signup] ✘ Firestore write failed (non-fatal):", err.code, err.message);
    console.error(
      "[signup] ⚠ Check: Firestore rules, project ID, and Firebase console network tab"
    );
    // Return success anyway so the user isn't blocked — profile can be repaired later.
    // If Firestore is critical for your app, change this to:
    //   return { ok: false, msg: "Account created but profile save failed. Please contact support." };
  }

  console.log("[signup] ✔ Signup complete for", firebaseUser.uid);
  return { ok: true, user: firebaseUser };
}

// ─────────────────────────────────────────────────────────────
// Core: login
// ─────────────────────────────────────────────────────────────

async function login(email, password) {
  try {
    const cred = await withTimeout(
      signInWithEmailAndPassword(auth, email, password),
      10000,
      "Sign in"
    );

    // Update lastLogin timestamp (best-effort, non-blocking)
    setDoc(
      doc(db, "users", cred.user.uid),
      { lastLogin: serverTimestamp() },
      { merge: true }
    ).catch((e) => console.warn("[login] lastLogin update failed:", e.message));

    return { ok: true, user: cred.user };
  } catch (err) {
    console.error("[login] Failed:", err.code, err.message);
    return { ok: false, msg: friendlyAuthError(err.code) };
  }
}

// ─────────────────────────────────────────────────────────────
// Core: logout
// ─────────────────────────────────────────────────────────────

async function logout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("[logout] Failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Plan upgrade
// ─────────────────────────────────────────────────────────────

async function upgradePlan(uid, plan) {
  try {
    await withTimeout(
      updateDoc(doc(db, "users", uid), { plan }),
      8000,
      "Plan upgrade"
    );
    console.log("[upgradePlan] ✔ Plan set to:", plan);
    return { ok: true };
  } catch (err) {
    console.error("[upgradePlan] Failed:", err.message);
    return { ok: false, msg: "Plan upgrade failed. Your account was created — contact support." };
  }
}

// ─────────────────────────────────────────────────────────────
// Route guards
// ─────────────────────────────────────────────────────────────

/**
 * Call on protected pages. Redirects to login.html if no user.
 * Returns the current user (or null if not logged in).
 */
function requireAuth(redirectTo = "login.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.href = redirectTo;
        resolve(null);
      } else {
        resolve(user);
      }
    });
  });
}

/**
 * Call on auth pages (login, signup). Redirects to dashboard if already logged in.
 */
function requireGuest(redirectTo = "dashboard.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        window.location.href = redirectTo;
        resolve(null);
      } else {
        resolve(true);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Export as window.AUTH so inline <script> tags can use it
// (This is the ONLY place window.AUTH is set, from one module)
// ─────────────────────────────────────────────────────────────

window.AUTH = { signup, login, logout, upgradePlan, requireAuth, requireGuest };

console.log("✔ AUTH module ready");
