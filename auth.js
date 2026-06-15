import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBit-EicoYOmKIlTjY5jvgov-RbHw_9t2o",
    authDomain: "bboulder-bd2a7.firebaseapp.com",
    projectId: "bboulder-bd2a7",
    storageBucket: "bboulder-bd2a7.firebasestorage.app",
    messagingSenderId: "67306427535",
    appId: "1:67306427535:web:e19b983e3bfe4feb624cfa"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function isAuthenticated() {
    return sessionStorage.getItem("event_auth") === "true";
}

export async function validatePassword(inputPassword) {
    const configDoc = await getDoc(doc(db, "config", "event"));
    if (!configDoc.exists()) throw new Error("Config introuvable");
    const { password } = configDoc.data();
    return inputPassword.trim() === password;
}

export function saveSession() {
    sessionStorage.setItem("event_auth", "true");
}

export function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = "index.html";
    }
}