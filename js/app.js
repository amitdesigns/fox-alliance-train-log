// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Main App Variables
let currentUser = null;
let editingId = null;
const MANUAL_DOC_ID = "NameLog"; // Replace with your Firebase document ID

// DOM Elements - Main App
const loginBtn = document.getElementById('login-btn');
const logTable = document.getElementById('log-table');
const editForm = document.getElementById('edit-form');
const entryForm = document.getElementById('entry-form');
const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
const loginForm = document.getElementById('login-form');
const formTitle = document.getElementById('form-title');

// DOM Elements - Lucky Dip
const namePoolTextarea = document.getElementById('name-pool');
const generateBtn = document.getElementById('generate-lucky-dip');
const saveNamesBtn = document.getElementById('save-names');
const luckyDipResult = document.getElementById('lucky-dip-result');
const selectedNameDisplay = document.getElementById('selected-name');

// State
let usedNames = [];

// ======================
// Main App Functionality
// ======================

// Auth State Listener
auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUI();
    loadLogs();
    if (user) loadNameList(); // Load names when logged in
    console.log("Auth state changed. User:", user ? user.email : "None");
});

function toggleLogin() {
    if (currentUser) {
        auth.signOut();
    } else {
        loginModal.show();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            loginModal.hide();
            loginForm.reset();
        })
        .catch(error => alert('Login error: ' + error.message));
}

function updateUI() {
    if (currentUser) {
        loginBtn.textContent = 'Admin Logout';
        loginBtn.className = 'btn btn-sm btn-outline-danger';
        document.querySelectorAll('.edit-btn').forEach(btn => btn.style.display = 'inline-block');
    } else {
        loginBtn.textContent = 'Admin Login';
        loginBtn.className = 'btn btn-sm btn-outline-primary';
        document.querySelectorAll('.edit-btn').forEach(btn => btn.style.display = 'none');
        cancelEdit();
    }
}

function loadLogs() {
    db.collection('logs').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = `
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Person 1</th>
                        <th>Person 2</th>
                        <th>Person 3</th>
                        ${currentUser ? '<th>Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>`;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <tr>
                    <td>${formatDate(data.date)}</td>
                    <td>${data.person1}</td>
                    <td>${data.person2}</td>
                    <td>${data.person3}</td>
                    ${currentUser ? `
                    <td>
                        <button class="btn btn-sm btn-warning edit-btn" data-id="${doc.id}">
                            Edit
                        </button>
                    </td>` : ''}
                </tr>`;
        });
        
        html += `</tbody></table>`;
        logTable.innerHTML = html;
        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editEntry(btn.dataset.id));
        });
    });
}

function editEntry(id) {
    editingId = id;
    formTitle.textContent = 'Edit Entry';
    
    db.collection('logs').doc(id).get().then(doc => {
        const data = doc.data();
        document.getElementById('log-date').value = data.date;
        document.getElementById('person1').value = data.person1;
        document.getElementById('person2').value = data.person2;
        document.getElementById('person3').value = data.person3;
        editForm.style.display = 'block';
    });
}

function cancelEdit() {
    editingId = null;
    editForm.style.display = 'none';
}

function saveEntry(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert("Please log in to make changes");
        return;
    }

    const entry = {
        date: document.getElementById('log-date').value,
        person1: document.getElementById('person1').value,
        person2: document.getElementById('person2').value,
        person3: document.getElementById('person3').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const operation = editingId 
        ? db.collection('logs').doc(editingId).update(entry)
        : db.collection('logs').add(entry);

    operation.then(() => {
        cancelEdit();
    }).catch(error => {
        console.error("Error writing document:", error);
        alert("Error saving entry: " + error.message);
    });
}

// ======================
// Lucky Dip Functionality
// ======================

function loadNameList() {
    db.collection("nameLists").doc(MANUAL_DOC_ID).get()
        .then(doc => {
            if (doc.exists) {
                namePoolTextarea.value = doc.data().names.join("\n");
                console.log("Loaded names from Firebase");
            }
        })
        .catch(error => console.error("Error loading names:", error));
}

saveNamesBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert("Please log in to save names");
        return;
    }

    const names = cleanNameInput(namePoolTextarea.value);
    
    db.collection("nameLists").doc(MANUAL_DOC_ID).set({
        names: names,
        owner: currentUser.uid,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("✅ Name list saved to Firebase!");
    });
});

generateBtn.addEventListener('click', generateLuckyDip);

function generateLuckyDip() {
    const allNames = cleanNameInput(namePoolTextarea.value);
    
    if (allNames.length === 0) {
        alert("Please add names first!");
        return;
    }

    const loggedNames = getNamesFromLogTable();
    let availableNames = allNames.filter(name => !loggedNames.includes(name));

    if (availableNames.length === 0) {
        availableNames = [...allNames];
        usedNames = [];
        alert("⚠️ All members have been logged! Resetting pool.");
    }

    availableNames = availableNames.filter(name => !usedNames.includes(name));

    if (availableNames.length === 0) {
        usedNames = [];
        availableNames = allNames.filter(name => !loggedNames.includes(name));
    }

    const winner = availableNames[Math.floor(Math.random() * availableNames.length)];
    usedNames.push(winner);
    
    selectedNameDisplay.textContent = winner;
    luckyDipResult.classList.remove('d-none');
}

// Helper Functions
function cleanNameInput(input) {
    return input.split(/[\n,]/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
}

function getNamesFromLogTable() {
    const loggedNames = [];
    document.querySelectorAll('#log-table td:nth-child(2), #log-table td:nth-child(3), #log-table td:nth-child(4)')
        .forEach(td => loggedNames.push(td.textContent.trim()));
    return loggedNames;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
