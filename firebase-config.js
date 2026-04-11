// Firebase Configuration

const firebaseConfig = {
    apiKey: "AIzaSyAxMF9zqHOeiq5ILApkO2SFR6prbWiJ0ts",
    authDomain: "resqlink-194aa.firebaseapp.com",
    databaseURL: "https://resqlink-194aa-default-rtdb.firebaseio.com",
    projectId: "resqlink-194aa",
    storageBucket: "resqlink-194aa.firebasestorage.app",
    messagingSenderId: "20482192786",
    appId: "1:20482192786:web:3ca219eb156b0906d0fd4b",
    measurementId: "G-6SW87B02WF"
  };


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const rtdb = firebase.database();

// Accessibility Helper: Voice feedback
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
}
