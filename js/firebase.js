/* ============================================================
   Shuttlestepz — firebase.js  v4
   Exports: app, auth, db, rtdb
   firebase 10.12.2 CDN — all packages consistent
   ============================================================ */

import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'

import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'

import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

import { getDatabase }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js'

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDAznGVHeLIAR6pPSVewiw3hUpSPYtXgO4",
  authDomain: "shuttlestepz-bac23.firebaseapp.com",
  databaseURL: "https://shuttlestepz-bac23-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "shuttlestepz-bac23",
  storageBucket: "shuttlestepz-bac23.firebasestorage.app",
  messagingSenderId: "167174250097",
  appId: "1:167174250097:web:d2b2cd1afa8818005fc5d0",
  measurementId: "G-Y0CJ1JVD45"
};

/* Guard against double-init on hot reload / multiple imports */
const app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db   = getFirestore(app)
const rtdb = getDatabase(app)

console.log('[Firebase] ✅ Initialised — project:', firebaseConfig.projectId)

export { app, auth, db, rtdb }
