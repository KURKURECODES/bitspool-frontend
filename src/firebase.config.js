// firebase.config.js
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';

// Replace this with YOUR Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCp9ghDfps9mZb1OVV221SOVvOn_wgj16I",
  authDomain: "bitspool-fee9e.firebaseapp.com",
  projectId: "bitspool-fee9e",
  storageBucket: "bitspool-fee9e.firebasestorage.app",
  messagingSenderId: "835160365667",
  appId: "1:835160365667:web:32c3fe75fe2e6d6e79f656",
  measurementId: "G-28PCF1YSMJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to LOCAL to keep user logged in on mobile
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});