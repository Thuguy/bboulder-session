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
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

    // Sauvegarde la session apres connexion
    export function saveSession(user) {
        sessionStorage.setItem("user", JSON.stringify(user));
    }

    // Recupere la session en cours
    export function getSession() {
        const data = sessionStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    }

    // Supprime la session (deconnexion)
    export function clearSession() {
        sessionStorage.removeItem("user");
    }

    // Redirige si non connecte
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

    // Connexion : cherche dans la collection users
    export async function login(prenom, nom, password) {
        const { collection, query, where, getDocs } = await import(
            "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
        );

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
    sessionStorage.setItem("event_auth", "true");
}

export function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = "index.html";
    }
}