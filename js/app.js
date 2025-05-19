// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let editingId = null;

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const addNewBtn = document.getElementById('add-new-btn');
const logTable = document.getElementById('log-table');
const editForm = document.getElementById('edit-form');
const entryForm = document.getElementById('entry-form');
const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
const loginForm = document.getElementById('login-form');
const formTitle = document.getElementById('form-title');

// Event Listeners
loginBtn.addEventListener('click', toggleLogin);
loginForm.addEventListener('submit', handleLogin);
entryForm.addEventListener('submit', saveEntry);
document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
addNewBtn.addEventListener('click', addNewEntry);

// Auth State Listener
auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUI();
    loadLogs();
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
        addNewBtn.style.display = 'inline-block';
    } else {
        loginBtn.textContent = 'Admin Login';
        loginBtn.className = 'btn btn-sm btn-outline-primary';
        addNewBtn.style.display = 'none';
        editForm.style.display = 'none';
    }
}

function loadLogs() {
    db.collection('logs').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = `
            <table class="table table-striped table-hover"> <!-- Added table-hover -->
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
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editEntry(btn.dataset.id));
        });
    });
}

function addNewEntry() {
    editingId = null;
    formTitle.textContent = 'Add New Entry';
    entryForm.reset();
    document.getElementById('log-date').valueAsDate = new Date();
    editForm.style.display = 'block';
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

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// DOM Elements
const namePoolTextarea = document.getElementById('name-pool');
const generateBtn = document.getElementById('generate-lucky-dip');
const saveNamesBtn = document.getElementById('save-names');
const luckyDipResult = document.getElementById('lucky-dip-result');
const selectedNameDisplay = document.getElementById('selected-name');

// State
let usedNames = [];

// Load names on startup
auth.onAuthStateChanged(user => {
    if (user) loadNameList();
});

// Load names from Firebase
function loadNameList() {
    db.collection("nameLists").doc(currentUser.uid).get()
        .then(doc => {
            if (doc.exists) {
                namePoolTextarea.value = doc.data().names.join("\n");
                console.log("Loaded saved names");
            }
        });
}

// Save names to Firebase
saveNamesBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert("Please log in to save names");
        return;
    }

    const names = cleanNameInput(namePoolTextarea.value);
    
    db.collection("nameLists").doc(currentUser.uid).set({
        names: names,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("✅ Name list saved!");
    });
});

// Generate random pick
generateBtn.addEventListener('click', generateLuckyDip);

function generateLuckyDip() {
    const allNames = cleanNameInput(namePoolTextarea.value);
    
    if (allNames.length === 0) {
        alert("Please add names first!");
        return;
    }

    // Get names currently in the log
    const loggedNames = getNamesFromLogTable();

    // Filter out logged names
    let availableNames = allNames.filter(name => 
        !loggedNames.includes(name)
    );

    // If everyone is logged, reset
    if (availableNames.length === 0) {
        availableNames = [...allNames];
        usedNames = [];
        alert("⚠️ All members have been logged! Resetting pool.");
    }

    // Filter out recently used
    availableNames = availableNames.filter(name => 
        !usedNames.includes(name)
    );

    // If all available names have been used, reset
    if (availableNames.length === 0) {
        usedNames = [];
        availableNames = allNames.filter(name => 
            !loggedNames.includes(name)
        );
    }

    // Random selection
    const winner = availableNames[Math.floor(Math.random() * availableNames.length)];
    usedNames.push(winner);
    
    // Display
    selectedNameDisplay.textContent = winner;
    luckyDipResult.classList.remove('d-none');
}

// Helper functions
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
