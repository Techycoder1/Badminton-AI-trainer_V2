import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"

const firebaseConfig = {
  apiKey: "AIzaSyCUsONfFExc-w1mxKgUUDStT4Ov-E2L8s",
  authDomain: "shuttlestepz-63c4f.firebaseapp.com",
  projectId: "shuttlestepz-63c4f",
  storageBucket: "shuttlestepz-63c4f.appspot.com",
  messagingSenderId: "726664546612",
  appId: "1:726664546612:web:650bc87a1a0cb30e8c3d61",
  measurementId: "G-RH82CWC28S"
}

const app = initializeApp(firebaseConfig)

window.fbAuth = getAuth(app)
window.fbDb   = getFirestore(app)
