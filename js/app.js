// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let editingId = null;
let participationChart = null;
let currentChartType = 'doughnut';
let chartData = { names: [], counts: [] }; // Store chart data globally

// DOM Elements
const elements = {
    loginBtn: document.getElementById('login-btn'),
    addNewBtn: document.getElementById('add-new-btn'),
    logTable: document.getElementById('log-table'),
    editForm: document.getElementById('edit-form'),
    entryForm: document.getElementById('entry-form'),
    loginModal: new bootstrap.Modal(document.getElementById('login-modal')),
    loginForm: document.getElementById('login-form'),
    formTitle: document.getElementById('form-title'),
    chartCanvas: document.getElementById('participationChart'),
    chartTypeBtns: document.querySelectorAll('.btn-viz'),
    chartTab: document.getElementById('chart-tab-pane')
};

// Initialize the application
function init() {
    setupEventListeners();
    auth.onAuthStateChanged(handleAuthChange);
}

// Set up all event listeners
function setupEventListeners() {
    // Auth and log management
    elements.loginBtn.addEventListener('click', toggleLogin);
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.entryForm.addEventListener('submit', saveEntry);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
    elements.addNewBtn.addEventListener('click', addNewEntry);
    
    // Chart controls
    elements.chartTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentChartType = btn.dataset.type;
            updateChart();
            elements.chartTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Tab visibility observer
    const observer = new MutationObserver(() => {
        if (elements.chartTab.classList.contains('active') && !participationChart) {
            updateChart();
        }
    });
    
    observer.observe(elements.chartTab, {
        attributes: true,
        attributeFilter: ['class']
    });
}

// Handle authentication state changes
function handleAuthChange(user) {
    currentUser = user;
    updateUI();
    loadLogs();
}

function toggleLogin() {
    if (currentUser) {
        auth.signOut();
    } else {
        elements.loginModal.show();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            elements.loginModal.hide();
            elements.loginForm.reset();
        })
        .catch(error => alert('Login error: ' + error.message));
}

function updateUI() {
    if (currentUser) {
        elements.loginBtn.textContent = 'Admin Logout';
        elements.loginBtn.className = 'btn btn-sm btn-outline-danger';
        elements.addNewBtn.style.display = 'inline-block';
    } else {
        elements.loginBtn.textContent = 'Admin Login';
        elements.loginBtn.className = 'btn btn-sm btn-outline-primary';
        elements.addNewBtn.style.display = 'none';
        cancelEdit();
    }
}

function loadLogs() {
    db.collection("logs").orderBy("date", "desc").onSnapshot(
        snapshot => {
            const nameCounts = {};
            let tableHTML = `
                <table class="table table-dark table-striped">
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
                tableHTML += `
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
                
                // Count participations
                [data.person1, data.person2, data.person3].forEach(name => {
                    if (name) nameCounts[name] = (nameCounts[name] || 0) + 1;
                });
            });
            
            tableHTML += `</tbody></table>`;
            elements.logTable.innerHTML = snapshot.empty 
                ? '<div class="alert alert-info">No participation data yet</div>' 
                : tableHTML;
            
            // Add edit event listeners
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => editEntry(btn.dataset.id));
            });
            
            // Process and store chart data
            processChartData(nameCounts);
        },
        error => {
            console.error("Error loading logs:", error);
            elements.logTable.innerHTML = '<div class="alert alert-danger">Error loading data</div>';
        }
    );
}

function processChartData(nameCounts) {
    const names = Object.keys(nameCounts);
    const counts = Object.values(nameCounts);
    
    // Sort by count (descending)
    const sortedIndices = [...Array(names.length).keys()].sort((a, b) => counts[b] - counts[a]);
    chartData.names = sortedIndices.map(i => names[i]);
    chartData.counts = sortedIndices.map(i => counts[i]);
    
    // Update chart if it's visible
    if (elements.chartTab.classList.contains('active')) {
        updateChart();
    }
}

function updateChart() {
    if (!chartData.names.length) return;
    
    if (participationChart) {
        participationChart.destroy();
    }
    
    const ctx = elements.chartCanvas.getContext('2d');
    participationChart = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels: chartData.names,
            datasets: [{
                data: chartData.counts,
                backgroundColor: generateChartColors(chartData.counts),
                borderColor: 'rgba(31, 41, 71, 0.8)',
                borderWidth: 2
            }]
        },
        options: getChartOptions()
    });
}

function generateChartColors(counts) {
    return counts.map(count => {
        if (count >= 5) return '#ffc107'; // Gold for top participants
        if (count >= 3) return '#7c6ee8'; // Purple for regulars
        return '#a8d8ea'; // Blue for occasional
    });
}

function getChartOptions() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: '#f0f8ff',
                    font: { size: 14 }
                }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((context.raw / total) * 100);
                        return `${context.label}: ${context.raw} time${context.raw === 1 ? '' : 's'} (${percentage}%)`;
                    }
                }
            }
        }
    };

    if (currentChartType === 'bar') {
        return {
            ...commonOptions,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0,
                        color: '#f0f8ff'
                    },
                    grid: {
                        color: 'rgba(168, 216, 234, 0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#f0f8ff'
                    }
                }
            }
        };
    }

    if (currentChartType === 'doughnut') {
        return {
            ...commonOptions,
            cutout: '65%'
        };
    }

    return commonOptions;
}

// Existing entry management functions
function addNewEntry() {
    editingId = null;
    elements.formTitle.textContent = 'Add New Entry';
    elements.entryForm.reset();
    document.getElementById('log-date').valueAsDate = new Date();
    elements.editForm.style.display = 'block';
}

function editEntry(id) {
    editingId = id;
    elements.formTitle.textContent = 'Edit Entry';
    
    db.collection("logs").doc(id).get().then(doc => {
        const data = doc.data();
        document.getElementById('log-date').value = data.date;
        document.getElementById('person1').value = data.person1;
        document.getElementById('person2').value = data.person2;
        document.getElementById('person3').value = data.person3;
        elements.editForm.style.display = 'block';
    });
}

function cancelEdit() {
    editingId = null;
    elements.editForm.style.display = 'none';
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
        ? db.collection("logs").doc(editingId).update(entry)
        : db.collection("logs").add(entry);

    operation.then(() => {
        cancelEdit();
    }).catch(error => {
        console.error("Error writing document:", error);
        alert("Error saving entry: " + error.message);
    });
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Initialize the app
init();
