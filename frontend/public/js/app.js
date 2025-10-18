// Global variables
let currentUser = null;
let authToken = null;

// API Base URL
const API_BASE = 'http://localhost:3000/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set up event listeners
    setupEventListeners();
    
    // Check if user is already logged in
    checkAuthStatus();
    
    // Set default dates for surveillance filters
    setDefaultDates();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('symptomsForm').addEventListener('submit', handleSymptomsSubmit);

    // Auth toggle
    document.getElementById('showRegister').addEventListener('click', toggleAuthForm);
    document.getElementById('showLogin').addEventListener('click', toggleAuthForm);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Modal close
    document.querySelector('.close').addEventListener('click', closeAlert);
    document.getElementById('alertModal').addEventListener('click', function(e) {
        if (e.target === this) closeAlert();
    });

    // Hamburger menu
    document.getElementById('hamburger').addEventListener('click', toggleMobileMenu);
}

function handleNavigation(e) {
    e.preventDefault();
    const page = e.target.getAttribute('data-page');
    
    if (page === 'logout') {
        handleLogout();
        return;
    }
    
    showPage(page);
}

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Update navigation
    updateNavigation(pageId);
    
    // Load page-specific data
    if (pageId === 'dashboard') {
        loadDashboard();
    } else if (pageId === 'surveillance') {
        loadSurveillanceData();
    }
}

function updateNavigation(pageId) {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        if (linkPage === 'login') {
            link.style.display = currentUser ? 'none' : 'block';
        } else if (['dashboard', 'symptoms', 'surveillance', 'logout'].includes(linkPage)) {
            link.style.display = currentUser ? 'block' : 'none';
        }
    });
}

function toggleAuthForm() {
    const loginCard = document.querySelector('.auth-card');
    const registerCard = document.getElementById('registerCard');
    
    if (loginCard.style.display === 'none') {
        loginCard.style.display = 'block';
        registerCard.style.display = 'none';
    } else {
        loginCard.style.display = 'none';
        registerCard.style.display = 'block';
    }
}

function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    showLoading(true);
    
    const formData = new FormData(e.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.data.patient;
            authToken = result.data.token;
            
            // Store token in localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showAlert('Success', 'Login successful!', 'success');
            showPage('dashboard');
        } else {
            showAlert('Error', result.message, 'error');
        }
    } catch (error) {
        showAlert('Error', 'Login failed. Please try again.', 'error');
        console.error('Login error:', error);
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    showLoading(true);
    
    const formData = new FormData(e.target);
    const registerData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        password: formData.get('password'),
        dateOfBirth: formData.get('dateOfBirth'),
        gender: formData.get('gender'),
        phoneNumber: formData.get('phoneNumber'),
        address: {
            street: '123 Main St', // Default values for demo
            city: 'Anytown',
            state: 'CA',
            zipCode: '90210',
            country: 'US'
        },
        emergencyContact: {
            name: 'Emergency Contact',
            relationship: 'Family',
            phoneNumber: formData.get('phoneNumber'),
            email: formData.get('email')
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Success', 'Registration successful! Please login.', 'success');
            toggleAuthForm();
        } else {
            showAlert('Error', result.message, 'error');
        }
    } catch (error) {
        showAlert('Error', 'Registration failed. Please try again.', 'error');
        console.error('Registration error:', error);
    } finally {
        showLoading(false);
    }
}

function handleLogout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showPage('home');
    showAlert('Success', 'Logged out successfully.', 'success');
}

function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        updateNavigation('dashboard');
    }
}

// Dashboard functions
async function loadDashboard() {
    if (!authToken) return;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/patients/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayDashboardData(result.data);
        } else {
            showAlert('Error', 'Failed to load dashboard data.', 'error');
        }
    } catch (error) {
        showAlert('Error', 'Failed to load dashboard data.', 'error');
        console.error('Dashboard error:', error);
    } finally {
        showLoading(false);
    }
}

function displayDashboardData(data) {
    // Display recent symptoms
    const recentSymptomsContainer = document.getElementById('recentSymptoms');
    if (data.recentSymptoms && data.recentSymptoms.length > 0) {
        recentSymptomsContainer.innerHTML = data.recentSymptoms.map(record => `
            <div class="symptom-item">
                <div class="symptom-header">
                    <strong>${new Date(record.recordedAt).toLocaleDateString()}</strong>
                    <span class="risk-score ${getRiskClass(record.mlAnalysis.riskScore)}">
                        Risk: ${(record.mlAnalysis.riskScore * 100).toFixed(1)}%
                    </span>
                </div>
                <div class="symptom-details">
                    <p><strong>Symptoms:</strong> ${record.symptoms.map(s => s.name).join(', ')}</p>
                    <p><strong>Predicted Syndrome:</strong> ${record.mlAnalysis.predictedSyndrome}</p>
                </div>
            </div>
        `).join('');
    } else {
        recentSymptomsContainer.innerHTML = '<p>No recent symptoms recorded.</p>';
    }
    
    // Display health statistics
    const healthStatsContainer = document.getElementById('healthStats');
    healthStatsContainer.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${data.statistics.totalRecords}</div>
            <div class="stat-label">Total Records</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${data.statistics.highRiskRecords}</div>
            <div class="stat-label">High Risk</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${data.statistics.flaggedRecords}</div>
            <div class="stat-label">Flagged</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${data.statistics.averageRiskScore.toFixed(1)}%</div>
            <div class="stat-label">Avg Risk</div>
        </div>
    `;
}

// Symptoms form functions
function addSymptom() {
    const symptomsList = document.getElementById('symptomsList');
    const newSymptom = document.createElement('div');
    newSymptom.className = 'symptom-item';
    newSymptom.innerHTML = `
        <div class="form-group">
            <label>Symptom Name</label>
            <input type="text" name="symptomName" placeholder="e.g., fever, headache, cough" required>
        </div>
        <div class="form-group">
            <label>Severity (1-10)</label>
            <input type="number" name="severity" min="1" max="10" required>
        </div>
        <div class="form-group">
            <label>Duration</label>
            <div class="duration-input">
                <input type="number" name="durationValue" placeholder="0" required>
                <select name="durationUnit" required>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Description (Optional)</label>
            <textarea name="description" placeholder="Additional details about this symptom"></textarea>
        </div>
        <button type="button" class="btn btn-danger btn-small" onclick="removeSymptom(this)">
            <i class="fas fa-trash"></i> Remove
        </button>
    `;
    symptomsList.appendChild(newSymptom);
}

function removeSymptom(button) {
    button.parentElement.remove();
}

async function handleSymptomsSubmit(e) {
    e.preventDefault();
    
    if (!authToken) {
        showAlert('Error', 'Please login to submit symptoms.', 'error');
        return;
    }
    
    showLoading(true);
    
    const formData = new FormData(e.target);
    const symptoms = [];
    
    // Collect symptoms
    const symptomItems = document.querySelectorAll('.symptom-item');
    symptomItems.forEach(item => {
        const name = item.querySelector('input[name="symptomName"]').value;
        const severity = parseInt(item.querySelector('input[name="severity"]').value);
        const durationValue = parseInt(item.querySelector('input[name="durationValue"]').value);
        const durationUnit = item.querySelector('select[name="durationUnit"]').value;
        const description = item.querySelector('textarea[name="description"]').value;
        
        if (name && severity && durationValue) {
            symptoms.push({
                name,
                severity,
                duration: {
                    value: durationValue,
                    unit: durationUnit
                },
                description
            });
        }
    });
    
    if (symptoms.length === 0) {
        showAlert('Error', 'Please add at least one symptom.', 'error');
        showLoading(false);
        return;
    }
    
    const symptomsData = {
        symptoms,
        vitalSigns: {
            temperature: formData.get('temperature') ? {
                value: parseFloat(formData.get('temperature')),
                unit: 'fahrenheit'
            } : undefined,
            heartRate: formData.get('heartRate') ? parseInt(formData.get('heartRate')) : undefined,
            respiratoryRate: formData.get('respiratoryRate') ? parseInt(formData.get('respiratoryRate')) : undefined,
            bloodPressure: (formData.get('systolicBP') || formData.get('diastolicBP')) ? {
                systolic: formData.get('systolicBP') ? parseInt(formData.get('systolicBP')) : undefined,
                diastolic: formData.get('diastolicBP') ? parseInt(formData.get('diastolicBP')) : undefined
            } : undefined,
            oxygenSaturation: formData.get('oxygenSaturation') ? parseFloat(formData.get('oxygenSaturation')) : undefined
        },
        additionalInfo: {
            recentTravel: formData.get('recentTravel') === 'on',
            recentExposure: formData.get('recentExposure') === 'on',
            currentMedications: formData.get('currentMedications') ? formData.get('currentMedications').split('\n') : []
        },
        location: {
            zipCode: formData.get('zipCode'),
            city: formData.get('city'),
            state: formData.get('state')
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}/patients/symptoms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(symptomsData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAnalysisResults(result.data.symptomRecord);
            e.target.reset();
            // Remove all symptom items except the first one
            const symptomItems = document.querySelectorAll('.symptom-item');
            for (let i = 1; i < symptomItems.length; i++) {
                symptomItems[i].remove();
            }
        } else {
            showAlert('Error', result.message, 'error');
        }
    } catch (error) {
        showAlert('Error', 'Failed to submit symptoms.', 'error');
        console.error('Symptoms submit error:', error);
    } finally {
        showLoading(false);
    }
}

function showAnalysisResults(record) {
    const analysisResults = document.createElement('div');
    analysisResults.className = 'analysis-results';
    analysisResults.innerHTML = `
        <div class="analysis-header">
            <h3>Analysis Results</h3>
            <div class="risk-score ${getRiskClass(record.mlAnalysis.riskScore)}">
                ${(record.mlAnalysis.riskScore * 100).toFixed(1)}%
            </div>
        </div>
        <div class="analysis-details">
            <p><strong>Predicted Syndrome:</strong> ${record.mlAnalysis.predictedSyndrome}</p>
            <p><strong>Confidence:</strong> ${(record.mlAnalysis.confidence * 100).toFixed(1)}%</p>
            <p><strong>Risk Level:</strong> <span class="${getRiskClass(record.mlAnalysis.riskScore)}">${record.mlAnalysis.riskLevel}</span></p>
            ${record.mlAnalysis.flaggedForReview ? '<p><strong>⚠️ Flagged for Review</strong></p>' : ''}
        </div>
        <div class="recommendations">
            <h4>Recommendations:</h4>
            <ul>
                ${record.mlAnalysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    `;
    
    // Insert after the form
    const form = document.getElementById('symptomsForm');
    form.parentNode.insertBefore(analysisResults, form.nextSibling);
    
    // Scroll to results
    analysisResults.scrollIntoView({ behavior: 'smooth' });
}

// Surveillance functions
async function loadSurveillanceData() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/ml/surveillance`, {
            headers: {
                'Authorization': `Bearer ${authToken || 'demo'}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displaySurveillanceData(result.data);
        } else {
            showAlert('Error', 'Failed to load surveillance data.', 'error');
        }
    } catch (error) {
        showAlert('Error', 'Failed to load surveillance data.', 'error');
        console.error('Surveillance error:', error);
    } finally {
        showLoading(false);
    }
}

function displaySurveillanceData(data) {
    // Display statistics
    const stats = data.statistics;
    document.getElementById('riskDistribution').innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.totalRecords}</div>
                <div class="stat-label">Total Cases</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.highRiskCount}</div>
                <div class="stat-label">High Risk</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.flaggedCount}</div>
                <div class="stat-label">Flagged</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${(stats.avgRiskScore * 100).toFixed(1)}%</div>
                <div class="stat-label">Avg Risk</div>
            </div>
        </div>
    `;
    
    // Display syndrome distribution
    const syndromeData = data.syndromeDistribution;
    document.getElementById('syndromeTrends').innerHTML = `
        <div class="syndrome-list">
            ${syndromeData.map(syndrome => `
                <div class="syndrome-item">
                    <span class="syndrome-name">${syndrome._id}</span>
                    <span class="syndrome-count">${syndrome.count} cases</span>
                    <span class="syndrome-risk">${(syndrome.avgRiskScore * 100).toFixed(1)}% avg risk</span>
                </div>
            `).join('')}
        </div>
    `;
    
    // Display geographic distribution
    const geoData = data.geographicDistribution;
    document.getElementById('geographicDistribution').innerHTML = `
        <div class="geo-list">
            ${geoData.map(geo => `
                <div class="geo-item">
                    <span class="geo-zip">${geo._id}</span>
                    <span class="geo-count">${geo.count} cases</span>
                    <span class="geo-risk">${(geo.avgRiskScore * 100).toFixed(1)}% avg risk</span>
                </div>
            `).join('')}
        </div>
    `;
    
    // Display surveillance table
    const tableData = data.surveillanceData;
    document.getElementById('surveillanceTable').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Patient</th>
                    <th>Symptoms</th>
                    <th>Syndrome</th>
                    <th>Risk Score</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${tableData.map(record => `
                    <tr>
                        <td>${new Date(record.recordedAt).toLocaleDateString()}</td>
                        <td>${record.patientId.firstName} ${record.patientId.lastName}</td>
                        <td>${record.symptoms.map(s => s.name).join(', ')}</td>
                        <td>${record.mlAnalysis.predictedSyndrome}</td>
                        <td class="${getRiskClass(record.mlAnalysis.riskScore)}">
                            ${(record.mlAnalysis.riskScore * 100).toFixed(1)}%
                        </td>
                        <td>${record.mlAnalysis.flaggedForReview ? '⚠️ Flagged' : '✅ Normal'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function setDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    document.getElementById('startDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
}

// Utility functions
function getRiskClass(riskScore) {
    if (riskScore >= 0.7) return 'risk-high';
    if (riskScore >= 0.4) return 'risk-medium';
    return 'risk-low';
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

function showAlert(title, message, type = 'info') {
    const modal = document.getElementById('alertModal');
    const titleEl = document.getElementById('alertTitle');
    const messageEl = document.getElementById('alertMessage');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Add type-specific styling
    modal.className = `modal show ${type}`;
    
    modal.classList.add('show');
}

function closeAlert() {
    document.getElementById('alertModal').classList.remove('show');
}

// Add some additional CSS for the new elements
const additionalCSS = `
.syndrome-list, .geo-list {
    max-height: 200px;
    overflow-y: auto;
}

.syndrome-item, .geo-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    border-bottom: 1px solid #e9ecef;
}

.syndrome-name, .geo-zip {
    font-weight: bold;
    color: #333;
}

.syndrome-count, .geo-count {
    color: #666;
}

.syndrome-risk, .geo-risk {
    color: #667eea;
    font-weight: bold;
}

.analysis-details p {
    margin: 0.5rem 0;
}

.analysis-details strong {
    color: #333;
}
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);
