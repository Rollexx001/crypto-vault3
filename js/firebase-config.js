// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  increment,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBtM_t1l2wd_BHwbtUWa37HogdDgQew9I",
  authDomain: "mine-project-daea5.firebaseapp.com",
  projectId: "mine-project-daea5",
  storageBucket: "mine-project-daea5.firebasestorage.app",
  messagingSenderId: "677923336045",
  appId: "1:677923336045:web:bfdab8d21f00f569ff7464",
  measurementId: "G-5WCEHSZEV5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export everything needed
export { 
  app, 
  auth, 
  db,
  // Auth functions
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  // Firestore functions
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  increment,
  arrayUnion
};
