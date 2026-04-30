// js/firebase.js — Firebase v10 modular SDK
// FIX 1: authDomain must be a plain string, NOT a markdown hyperlink
// FIX 2: Export named constants instead of relying on window.* globals

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAG-sl7HpAGsEHYBdYetJlHcT81E64lY0I",
  authDomain:        "shuttlestepz-bfea2.firebaseapp.com",
  projectId:         "shuttlestepz-bfea2",
  storageBucket:     "shuttlestepz-bfea2.appspot.com",
  messagingSenderId: "62299841228",
  appId:             "1:62299841228:web:26a6c38215e5c35f5e1869",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// FIX 2: Export properly so auth.js can import — do NOT rely on window.*
export { auth, db };

console.log("🔥 Firebase initialised | project:", firebaseConfig.projectId);
