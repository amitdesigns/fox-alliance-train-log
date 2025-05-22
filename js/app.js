
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let editingId = null;


const loginBtn = document.getElementById('login-btn');
const addNewBtn = document.getElementById('add-new-btn');
const logTable = document.getElementById('log-table');
const editForm = document.getElementById('edit-form');
const entryForm = document.getElementById('entry-form');
const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
const loginForm = document.getElementById('login-form');
const formTitle = document.getElementById('form-title');


loginBtn.addEventListener('click', toggleLogin);
loginForm.addEventListener('submit', handleLogin);
entryForm.addEventListener('submit', saveEntry);
document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
addNewBtn.addEventListener('click', addNewEntry);


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
        addNewBtn.style.display = 'inline-block';
        document.querySelectorAll('.edit-btn').forEach(btn => btn.style.display = 'inline-block');
    } else {
        loginBtn.textContent = 'Admin Login';
        loginBtn.className = 'btn btn-sm btn-outline-primary';
        addNewBtn.style.display = 'none';
        document.querySelectorAll('.edit-btn').forEach(btn => btn.style.display = 'none');
        cancelEdit();
    }
}

function loadLogs() {
    db.collection('logs').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Convoy Leader</th>
                        <th>Deputy Convoy Leader 1</th>
                        <th>Deputy Convoy Leader 2</th>
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


let participationChart = null;

function updateChart() {
    // Get all logged names
    const nameCounts = {};
    document.querySelectorAll('#log-table td:nth-child(2), #log-table td:nth-child(3), #log-table td:nth-child(4)')
        .forEach(td => {
            const name = td.textContent.trim();
            nameCounts[name] = (nameCounts[name] || 0) + 1;
        });

   
    const names = Object.keys(nameCounts);
    const counts = Object.values(nameCounts);
    
  
    const sortedIndices = [...Array(names.length).keys()]
        .sort((a, b) => counts[b] - counts[a]);
    
    const sortedNames = sortedIndices.map(i => names[i]);
    const sortedCounts = sortedIndices.map(i => counts[i]);


    const ctx = document.getElementById('participationChart').getContext('2d');
    
    if (participationChart) {
        participationChart.data.labels = sortedNames;
        participationChart.data.datasets[0].data = sortedCounts;
        participationChart.update();
    } else {
        participationChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: sortedNames,
                datasets: [{
                    label: 'Times Selected',
                    data: sortedCounts,
                    backgroundColor: 'rgba(124, 110, 232, 0.7)',
                    borderColor: 'rgba(168, 216, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Selected ${context.raw} time${context.raw === 1 ? '' : 's'}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#f0f8ff'
                        },
                        grid: {
                            color: 'rgba(168, 216, 234, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#f0f8ff'
                        },
                        grid: {
                            color: 'rgba(168, 216, 234, 0.1)'
                        }
                    }
                }
            }
        });
    }
}


function loadLogs() {
    db.collection('logs').orderBy('date', 'desc').onSnapshot(snapshot => {
        // ... existing table code ...
        
        
        updateChart();
    });
}
