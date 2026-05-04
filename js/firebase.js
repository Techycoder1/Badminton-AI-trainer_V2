/* ============================================================
   Shuttlestepz — firebase.js
   Single init. Exports: app, auth, db, rtdb
   Imported by database.js — never load via <script> tag.
   ============================================================ */

import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'

import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'

import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'

import { getDatabase }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'

const firebaseConfig = {
  apiKey           : 'AIzaSyCRwKnXko_ttD4v9WU3cWxCa8VKIzhGH5Y',
  authDomain       : 'shuttlestepz-46f88.firebaseapp.com',
  databaseURL      : 'https://shuttlestepz-46f88-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId        : 'shuttlestepz-46f88',
  storageBucket    : 'shuttlestepz-46f88.firebasestorage.app',
  messagingSenderId: '856356391368',
  appId            : '1:856356391368:web:2712727d3ab91e60fe58fd',
  measurementId    : 'G-SDLZ6BL4CY',
}

/* Guard against double-init on hot reload / multiple imports */
const app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db   = getFirestore(app)
const rtdb = getDatabase(app)

console.log('[Firebase] ✅ Initialised — project:', firebaseConfig.projectId)

/* Named exports — database.js imports { app, auth, db, rtdb } */
export { app, auth, db, rtdb }

/* Also default export for convenience */
export default { app, auth, db, rtdb }
