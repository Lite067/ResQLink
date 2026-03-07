// Firebase Configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyAQU7n-P6lirLhXhyLuOm9JL-dnIf-j-2U",
  authDomain: "resqlink-73b57.firebaseapp.com",
  projectId: "resqlink-73b57",
  storageBucket: "resqlink-73b57.firebasestorage.app",
  messagingSenderId: "1089979527311",
  appId: "1:1089979527311:web:978de63a5d76348d7440fa",
  measurementId: "G-JVHWVP44H4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const userDashboard = document.getElementById('user-dashboard');
const guardianDashboard = document.getElementById('guardian-dashboard');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authRole = document.getElementById('auth-role');
const authNameInput = document.getElementById('auth-name');
const authGuardianEmailInput = document.getElementById('auth-guardian-email');
const authMessage = document.getElementById('auth-message');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const historyModal = document.getElementById('history-modal');
const closeHistory = document.querySelector('.close-modal');

let isLoginMode = true;
let currentUserData = null;

// --- Screen Management ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Initial Loading Logic
window.onload = () => {
    // Show loading screen for 2 seconds then check auth
    setTimeout(() => {
        auth.onAuthStateChanged(user => {
            if (user) {
                loadUserProfile(user.uid);
            } else {
                showScreen('auth-screen');
            }
        });
    }, 2000);
};

// --- Authentication Logic ---

tabLogin.onclick = () => {
    isLoginMode = true;
    authTitle.innerText = "Login";
    authSubmit.innerText = "Login";
    authNameInput.style.display = 'none';
    authGuardianEmailInput.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    authMessage.innerText = "";
};

tabRegister.onclick = () => {
    isLoginMode = false;
    authTitle.innerText = "Register";
    authSubmit.innerText = "Register";
    authNameInput.style.display = 'block';
    authNameInput.required = true;

    if (authRole.value === 'user') {
        authGuardianEmailInput.style.display = 'block';
        authGuardianEmailInput.required = true;
    }

    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    authMessage.innerText = "";
};

authRole.onchange = () => {
    if (!isLoginMode && authRole.value === 'user') {
        authGuardianEmailInput.style.display = 'block';
        authGuardianEmailInput.required = true;
    } else {
        authGuardianEmailInput.style.display = 'none';
        authGuardianEmailInput.required = false;
    }
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const role = authRole.value;
    const name = authNameInput.value;
    const guardianEmail = authGuardianEmailInput.value;

    authMessage.innerText = "Processing...";

    try {
        if (isLoginMode) {
            // LOGIN FLOW
            await auth.signInWithEmailAndPassword(email, password);
            // onAuthStateChanged will handle redirection via loadUserProfile
        } else {
            // REGISTRATION FLOW

            // 1. If registering as user, validate guardian exists
            if (role === 'user') {
                const guardianSnap = await db.collection('guardians').where('email', '==', guardianEmail).get();
                if (guardianSnap.empty) {
                    authMessage.innerText = "Error: Guardian with this email is not registered yet.";
                    speak("Guardian not registered.");
                    return;
                }
            }

            // 2. Create Auth User
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            // 3. Save Profile to Firestore
            const userData = {
                uid,
                name,
                email,
                role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (role === 'user') {
                userData.guardianEmail = guardianEmail;
                await db.collection('users').doc(uid).set(userData);
            } else {
                await db.collection('guardians').doc(uid).set(userData);
            }

            authMessage.innerText = "Registration complete! Logging you in...";
            speak("Registration complete.");
            // No need to redirect here, onAuthStateChanged will trigger
        }
    } catch (error) {
        authMessage.innerText = "Error: " + error.message;
        speak(error.message);
    }
};

async function loadUserProfile(uid) {
    authMessage.innerText = "Loading profile...";

    // Check 'users' collection
    let userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
        currentUserData = userDoc.data();
        initUserDashboard();
    } else {
        // Check 'guardians' collection
        userDoc = await db.collection('guardians').doc(uid).get();
        if (userDoc.exists) {
            currentUserData = userDoc.data();
            initGuardianDashboard();
        } else {
            // User authenticated but no profile found - likely internal error
            authMessage.innerText = "Profile not found. Please contact support.";
            auth.signOut();
        }
    }
}

document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.onclick = () => {
        auth.signOut().then(() => {
            location.reload();
        });
    };
});

// --- User Dashboard Logic (BLE & SOS) ---

let bleDevice;
let sosCharacteristic;

function initUserDashboard() {
    showScreen('user-dashboard');
    document.getElementById('user-display-name').innerText = currentUserData.name;
    document.getElementById('user-display-guardian').innerText = currentUserData.guardianEmail;

    document.getElementById('btn-connect-ble').onclick = connectBLE;
    document.getElementById('btn-sos').onclick = triggerSOS;
}

async function connectBLE() {
    try {
        speak("Searching for Smart Cane.");
        // Filters should match your ESP32's advertising name
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'ESP32' }],
            optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
        });

        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
        sosCharacteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

        await sosCharacteristic.startNotifications();
        sosCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
            const value = new TextDecoder().decode(event.target.value);
            // If ESP32 sends "1" when button is pressed
            if (value === "1") triggerSOS();
        });

        const bleIndicator = document.getElementById('ble-status');
        bleIndicator.innerText = "Stick: Connected";
        bleIndicator.className = "status-indicator connected";
        speak("Stick connected successfully.");

        bleDevice.addEventListener('gattserverdisconnected', () => {
            bleIndicator.innerText = "Stick: Disconnected";
            bleIndicator.className = "status-indicator disconnected";
            speak("Stick disconnected.");
        });

    } catch (error) {
        console.error("BLE Error:", error);
        speak("Connection failed. Ensure Bluetooth is on.");
    }
}

async function triggerSOS() {
    const statusEl = document.getElementById('sos-status');
    statusEl.innerText = "Emergency Alert Triggered...";
    speak("Sending emergency alert now.");

    if (!navigator.geolocation) {
        statusEl.innerText = "Error: Geolocation not supported";
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        const alertData = {
            userUID: currentUserData.uid,
            userName: currentUserData.name,
            guardianEmail: currentUserData.guardianEmail,
            lat: latitude,
            lon: longitude,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        };

        try {
            await db.collection('alerts').add(alertData);
            statusEl.innerText = "SOS Sent! Guardian notified.";
            speak("SOS sent. Help is being notified.");

            // Highlight the SOS button visually for a few seconds
            const sosBtn = document.getElementById('btn-sos');
            sosBtn.style.backgroundColor = "#ff0000";
            setTimeout(() => { sosBtn.style.backgroundColor = ""; }, 5000);

        } catch (error) {
            statusEl.innerText = "Failed to send SOS: " + error.message;
        }
    }, (error) => {
        statusEl.innerText = "Error: Please enable location permissions.";
        speak("Location error. Alert not sent.");
    }, { enableHighAccuracy: true });
}

// --- Guardian Dashboard Logic ---

function initGuardianDashboard() {
    showScreen('guardian-dashboard');
    listenForAlerts();
    loadMonitoredUsers();
}

function listenForAlerts() {
    // Listen for alerts directed to this guardian
    db.collection('alerts')
        .where('guardianEmail', '==', currentUserData.email)
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            const alertsList = document.getElementById('alerts-list');

            if (snapshot.empty) {
                alertsList.innerHTML = "<p>No active alerts.</p>";
                return;
            }

            alertsList.innerHTML = "";
            snapshot.forEach(doc => {
                const alert = doc.data();
                const div = document.createElement('div');
                div.className = "alert-item";

                const time = alert.timestamp ? alert.timestamp.toDate().toLocaleTimeString() : "Just now";

                div.innerHTML = `
                    <p style="font-size:1.2rem; color:red;"><strong>🚨 SOS: ${alert.userName}</strong></p>
                    <p>Time: ${time}</p>
                    <p>Location: ${alert.lat.toFixed(5)}, ${alert.lon.toFixed(5)}</p>
                    <div style="margin-top: 10px;">
                        <a href="https://www.google.com/maps?q=${alert.lat},${alert.lon}" target="_blank" style="padding: 5px 10px; background:#2196F3; color:white; text-decoration:none; border-radius:4px;">Open Map</a>
                    </div>
                `;
                alertsList.appendChild(div);

                // Audio cue for NEW alerts only
                if (!snapshot.metadata.hasPendingWrites && snapshot.docChanges().some(c => c.type === 'added')) {
                    speak(`Emergency! alert from ${alert.userName}`);
                }
            });
        });
}

async function loadMonitoredUsers() {
    const usersSnap = await db.collection('users')
        .where('guardianEmail', '==', currentUserData.email)
        .get();

    const list = document.getElementById('monitored-users-list');
    list.innerHTML = "";
    if (usersSnap.empty) {
        list.innerHTML = "<p>You are not monitoring any users yet.</p>";
        return;
    }

    usersSnap.forEach(doc => {
        const user = doc.data();
        const p = document.createElement('p');
        p.style.padding = "5px";
        p.style.borderBottom = "1px solid #ddd";
        p.innerText = `👤 ${user.name} (${user.email})`;
        list.appendChild(p);
    });
}

// History Modal
document.getElementById('btn-alerts-history').onclick = async () => {
    historyModal.style.display = "block";
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = "Fetching logs...";

    try {
        const historySnap = await db.collection('alerts')
            .where('guardianEmail', '==', currentUserData.email)
            .orderBy('timestamp', 'desc')
            .get();

        historyList.innerHTML = "";
        if (historySnap.empty) {
            historyList.innerHTML = "<li>No past alerts found.</li>";
            return;
        }

        historySnap.forEach(doc => {
            const alert = doc.data();
            const dateStr = alert.timestamp ? alert.timestamp.toDate().toLocaleString() : "Unknown date";
            const li = document.createElement('li');
            li.style.marginBottom = "10px";
            li.style.borderBottom = "1px solid #eee";
            li.innerHTML = `
                <strong>${alert.userName}</strong><br>
                ${dateStr}<br>
                <a href="https://www.google.com/maps?q=${alert.lat},${alert.lon}" target="_blank">View Location</a>
            `;
            historyList.appendChild(li);
        });
    } catch (e) {
        historyList.innerHTML = "Error loading history: " + e.message;
    }
};

closeHistory.onclick = () => historyModal.style.display = "none";
window.onclick = (e) => { if (e.target == historyModal) historyModal.style.display = "none"; };

// --- Accessibility Helpers ---
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
}
