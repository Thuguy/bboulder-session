import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireAuth } from "./auth.js";

requireAuth();

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

const tbody = document.getElementById("leaderboard-body");

onSnapshot(collection(db, "scores"), (snapshot) => {
    const results = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const blocsReussis = data.blocs.filter(b => b.completed).length;
        const essaisTotaux = data.blocs.reduce((sum, b) => sum + b.attempts, 0);
        results.push({ name: data.name, blocsReussis, essaisTotaux });
    });

    results.sort((a, b) => {
        if (b.blocsReussis !== a.blocsReussis) return b.blocsReussis - a.blocsReussis;
        return a.essaisTotaux - b.essaisTotaux;
    });

    tbody.innerHTML = results.length === 0
        ? `<tr><td colspan="4">Aucun resultat pour l'instant...</td></tr>`
        : results.map((r, i) => `
        <tr class="${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}">
          <td>${i + 1}</td>
          <td>${r.name}</td>
          <td>${r.blocsReussis}</td>
          <td>${r.essaisTotaux}</td>
        </tr>
      `).join("");
});