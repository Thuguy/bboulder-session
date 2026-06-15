import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBit-EicoYOmKIlTjY5jvgov-RbHw_9t2o",
    authDomain: "bboulder-bd2a7.firebaseapp.com",
    projectId: "bboulder-bd2a7",
    storageBucket: "bboulder-bd2a7.firebasestorage.app",
    messagingSenderId: "67306427535",
    appId: "1:67306427535:web:e19b983e3bfe4feb624cfa"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function saveSession(user) {
    sessionStorage.setItem("user", JSON.stringify(user));
}

export function getSession() {
    const data = sessionStorage.getItem("user");
    return data ? JSON.parse(data) : null;
}

export function clearSession() {
    sessionStorage.removeItem("user");
}

export function requireAuth(role = null) {
    const user = getSession();
    if (!user) {
        window.location.href = "index.html";
        return null;
    }
    if (role && user.role !== role) {
        window.location.href = "index.html";
        return null;
    }
    return user;
}

export async function login(prenom, nom, password) {
    const q = query(
        collection(db, "users"),
        where("prenom", "==", prenom.trim()),
        where("nom", "==", nom.trim()),
        where("password", "==", password.trim())
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const userDoc = snapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() };
    saveSession(userData);
    return userData;
}