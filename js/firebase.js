// js/firebase.js
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAG-sl7HpAGsEHYBdYetJlHcT81E64lY0I",
  authDomain:        "shuttlestepz-bfea2.firebaseapp.com",
  databaseURL:       "https://shuttlestepz-bfea2-default-rtdb.asia-south1.firebasedatabase.app",
  projectId:         "shuttlestepz-bfea2",
  storageBucket:     "shuttlestepz-bfea2.firebasestorage.app",
  messagingSenderId: "62299841228",
  appId:             "1:62299841228:web:26a6c38215e5c35f5e1869",
  measurementId:     "G-RE1J84HDM5"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };

console.log("🔥 Firebase initialised | project:", firebaseConfig.projectId);
