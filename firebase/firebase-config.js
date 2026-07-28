import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyBe8It3Ju00jQIzkjlBKSs456xrU8S566A",

  authDomain: "efd24-df1d4.firebaseapp.com",

  projectId: "efd24-df1d4",

  storageBucket: "efd24-df1d4.firebasestorage.app",

  messagingSenderId: "1042309003290",

  appId: "1:1042309003290:web:e295e9c8383b91eff139a3"

};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);