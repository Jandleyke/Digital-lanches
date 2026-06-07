import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAaxvIhS4MGLC-zB_YpCwkJBVxPQTFw7S4",
  authDomain: "senac-lanches.firebaseapp.com",
  projectId: "senac-lanches",
  storageBucket: "senac-lanches.firebasestorage.app",
  messagingSenderId: "821370652054",
  appId: "1:821370652054:web:7034d5d7c4c63d17d949b7",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
