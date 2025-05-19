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
const formTitle = document.getElementById('form-title');

// Event Listeners
loginBtn.addEventListener('click', toggleLogin);
loginForm.addEventListener('submit', handleLogin);
entryForm.addEventListener('submit', saveEntry);
document.getElementById('cancel-edit').addEventListener('click', cancelEdit);

// Auth State Listener
auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUI();
    loadLogs();
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
    } else {
        loginBtn.textContent = 'Admin Login';
        loginBtn.className = 'btn btn-sm btn-outline-primary';
    }
}

function loadLogs() {
    db.collection('logs').orderBy('date', 'desc').onSnapshot(snapshot => {
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

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
