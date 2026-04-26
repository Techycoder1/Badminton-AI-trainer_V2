import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your config (keep same)
const firebaseConfig = {
  apiKey: "AIzaSyAG-sl7HpAGsEHYBdYetJlHcT81E64lY0I",
  authDomain: "shuttlestepz-bfea2.firebaseapp.com",
  projectId: "shuttlestepz-bfea2",
  storageBucket: "shuttlestepz-bfea2.appspot.com",
  messagingSenderId: "62299841228",
  appId: "1:62299841228:web:26a6c38215e5c35f5e1869",
};

// Init
const app = initializeApp(firebaseConfig);

// 🔥 CRITICAL (your auth.js depends on this)
window.fbAuth = getAuth(app);
window.fbDb   = getFirestore(app);

console.log("🔥 Firebase Connected");
