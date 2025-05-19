// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let editingId = null;

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logTable = document.getElementById('log-table');
const editForm = document.getElementById('edit-form');
const entryForm = document.getElementById('entry-form');
const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
const loginForm = document.getElementById('login-form');

// Consolidated Login/Logout Button Handler
loginBtn.addEventListener('click', function() {
    if (currentUser) {
        auth.signOut().then(() => {
            console.log("User logged out successfully");
            currentUser = null;
            updateUI();
        }).catch(error => {
            console.error("Logout error:", error);
        });
    } else {
        console.log("Showing login modal");
        loginModal.show();
    }
});

// Login Form Handler
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log("Attempting login with:", email);
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            console.log("Login successful");
            loginModal.hide();
            loginForm.reset();
        })
        .catch(error => {
            console.error("Login error:", error);
            alert('Login error: ' + error.message);
        });
});

// Entry Form Handler
entryForm.addEventListener('submit', saveEntry);
document.getElementById('cancel-edit').addEventListener('click', cancelEdit);

// Auth State Listener
auth.onAuthStateChanged(user => {
    console.log("Auth state changed. Current user:", user ? user.email : "None");
    currentUser = user;
    updateUI();
    loadLogs();
});

// Update UI Elements
function updateUI() {
    console.log("Updating UI for user:", currentUser ? currentUser.email : "Not logged in");
    
    if (currentUser) {
        loginBtn.textContent = 'Admin Logout';
        loginBtn.className = 'btn btn-sm btn-outline-danger';
        editForm.classList.remove('d-none');
    } else {
        loginBtn.textContent = 'Admin Login';
        loginBtn.className = 'btn btn-sm btn-outline-primary';
        editForm.classList.add('d-none');
    }
}

// Load Logs from Firestore
function loadLogs() {
    console.log("Loading logs from Firestore...");
    
    db.collection('logs').orderBy('date', 'desc').onSnapshot(snapshot => {
        console.log("Received", snapshot.size, "log entries");
        
        let html = `
            <table class="table table-striped">
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
            btn.addEventListener('click', () => {
                console.log("Edit button clicked for ID:", btn.dataset.id);
                editEntry(btn.dataset.id);
            });
        });
    }, error => {
        console.error("Error loading logs:", error);
    });
}

// Edit Existing Entry
function editEntry(id) {
    console.log("Editing entry with ID:", id);
    editingId = id;
    
    db.collection('logs').doc(id).get().then(doc => {
        if (!doc.exists) {
            throw new Error("Document does not exist");
        }
        
        const data = doc.data();
        console.log("Editing data:", data);
        
        document.getElementById('log-date').value = data.date;
        document.getElementById('person1').value = data.person1;
        document.getElementById('person2').value = data.person2;
        document.getElementById('person3').value = data.person3;
        
        editForm.classList.remove('d-none');
        window.scrollTo(0, document.body.scrollHeight);
    }).catch(error => {
        console.error("Error loading document:", error);
        alert("Error loading document: " + error.message);
    });
}

// Save Entry (New or Edited)
function saveEntry(e) {
    e.preventDefault();
    console.log("Saving entry...");
    
    if (!currentUser) {
        alert("Please log in first!");
        return;
    }

    const entry = {
        date: document.getElementById('log-date').value,
        person1: document.getElementById('person1').value,
        person2: document.getElementById('person2').value,
        person3: document.getElementById('person3').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log("Saving data:", entry);
    
    const operation = editingId 
        ? db.collection('logs').doc(editingId).update(entry)
        : db.collection('logs').add(entry);

    operation.then(() => {
        console.log(editingId ? "Update successful" : "Add successful");
        cancelEdit();
    }).catch(error => {
        console.error("Error writing document:", error);
        alert("Error saving: " + error.message);
    });
}

// Cancel Editing
function cancelEdit() {
    console.log("Canceling edit");
    editingId = null;
    entryForm.reset();
    editForm.classList.add('d-none');
}

// Format Date for Display
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
