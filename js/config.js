const firebaseConfig = {
  apiKey: "AIzaSyDesRiEQsIWQLoxcpzbss8kh7c9hH_LW64",
  authDomain: "fox-alliance-train-log.firebaseapp.com",
  projectId: "fox-alliance-train-log",
  storageBucket: "fox-alliance-train-log.firebasestorage.app",
  messagingSenderId: "484011286679",
  appId: "1:484011286679:web:2e757e9e955ddf8cd349d2",
  measurementId: "G-WNNG3GBJLZ"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);
const auth = firebase.auth(app);

// Disable Firestore persistence (causes CSP issues)
db.disablePersistence().catch((err) => {
  console.log("Persistence disabled:", err);
});
