// Configuration
const API_BASE_URL = '/api';

// Global variables
let extractedSessions = [];
let generatedPlans = [];

// Update total sessions calculation
document.getElementById('totalWeeks')?.addEventListener('input', updateTotalSessions);
document.getElementById('sessionsPerWeek')?.addEventListener('input', updateTotalSessions);

function updateTotalSessions() {
    const weeks = parseInt(document.getElementById('totalWeeks').value) || 12;
    const sessionsPerWeek = parseInt(document.getElementById('sessionsPerWeek').value) || 3;
    const total = weeks * sessionsPerWeek;
    document.getElementById('totalSessions').textContent = total;
    
    const estimatedMinutes = Math.ceil((total * 15) / 60);
    document.getElementById('estimatedTime').textContent = `${estimatedMinutes}-${estimatedMinutes + 5} minutes`;
}

function resetForm() {
    if (confirm('Are you sure you want to reset the form? All entered data will be lost.')) {
        document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
            if (input.id !== 'totalWeeks' && input.id !== 'sessionsPerWeek' && input.id !== 'sessionDuration') {
                input.value = '';
            }
        });
        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.value = '';
        });
        hideProgress();
        hideResults();
        hideError();
        extractedSessions = [];
        generatedPlans = [];
    }
}

function showProgress(text) {
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('progressText').textContent = text;
}

function updateProgress(percent, text) {
    const fill = document.getElementById('progressFill');
    fill.style.width = percent + '%';
    fill.textContent = Math.round(percent) + '%';
    if (text) {
        document.getElementById('progressText').textContent = text;
    }
}

function hideProgress() {
    document.getElementById('progressContainer').style.display = 'none';
}

function showResults() {
    document.getElementById('resultsContainer').style.display = 'block';
}

function hideResults() {
    document.getElementById('resultsContainer').style.display = 'none';
}

function showError(message) {
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function hideError() {
    document.getElementById('errorContainer').style.display = 'none';
}

function validateForm() {
    const requiredFields = ['learningPlan', 'courseName', 'unitCode', 'level', 'classes', 'institution'];
    
    for (const fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field.value && fieldId !== 'learningPlan') {
            showError(`Please fill in the required field: ${field.previousElementSibling.textContent}`);
            return false;
        }
        if (fieldId === 'learningPlan' && !field.files.length) {
            showError('Please upload the Learning Plan document');
            return false;
        }
    }
    
    return true;
}

// Detect the max week number from extracted sessions
function getDocumentWeekCount(sessions) {
    let maxWeek = 0;
    for (const s of sessions) {
        const weekStr = String(s.week || '');
        // Handle ranges like "10-11"
        const parts = weekStr.split('-').map(Number).filter(n => !isNaN(n));
        for (const n of parts) {
            if (n > maxWeek) maxWeek = n;
        }
    }
    return maxWeek;
}

// Promise-based modal: resolves with 'redistribute' or 'use-actual'
let weekChoiceResolve = null;

function showWeekMismatchModal(documentWeeks, configuredWeeks) {
    document.getElementById('documentWeeks').textContent = documentWeeks;
    document.getElementById('configuredWeeks').textContent = configuredWeeks;
    document.getElementById('redistributeWeeks').textContent = configuredWeeks;
    document.getElementById('useActualWeeks').textContent = documentWeeks;
    document.getElementById('weekMismatchModal').classList.add('active');
    
    return new Promise(resolve => {
        weekChoiceResolve = resolve;
    });
}

function handleWeekChoice(choice) {
    document.getElementById('weekMismatchModal').classList.remove('active');
    if (weekChoiceResolve) {
        weekChoiceResolve(choice);
        weekChoiceResolve = null;
    }
}

function getCourseInfo() {
    return {
        courseName: document.getElementById('courseName').value,
        unitCode: document.getElementById('unitCode').value,
        level: document.getElementById('level').value,
        classes: document.getElementById('classes').value,
        institution: document.getElementById('institution').value,
        trainer: document.getElementById('trainer').value || 'Not specified',
        duration: parseInt(document.getElementById('sessionDuration').value)
    };
}

async function generateSessionPlans() {
    if (!validateForm()) {
        return;
    }
    
    hideError();
    hideResults();
    showProgress('Starting generation...');
    
    try {
        document.getElementById('generateBtn').disabled = true;
        
        const learningPlanFile = document.getElementById('learningPlan').files[0];
        
        // Step 1: Extract sessions from learning plan
        updateProgress(10, 'Extracting sessions from learning plan...');
        
        const formData = new FormData();
        formData.append('learningPlan', learningPlanFile);
        
        const extractResponse = await fetch(`${API_BASE_URL}/extract-sessions`, {
            method: 'POST',
            body: formData
        });
        
        if (!extractResponse.ok) {
            const error = await extractResponse.json();
            throw new Error(error.error || 'Failed to extract sessions');
        }
        
        const { sessions } = await extractResponse.json();
        extractedSessions = sessions;
        
        console.log('Extracted sessions:', sessions);
        
        // Step 2: Check for week mismatch
        const documentWeeks = getDocumentWeekCount(sessions);
        const configuredWeeks = parseInt(document.getElementById('totalWeeks').value) || 12;
        const sessionsPerWeek = parseInt(document.getElementById('sessionsPerWeek').value) || 3;
        
        let sessionsToUse = sessions;
        let actualWeeks = documentWeeks;
        
        if (documentWeeks > 0 && documentWeeks !== configuredWeeks) {
            hideProgress();
            const choice = await showWeekMismatchModal(documentWeeks, configuredWeeks);
            showProgress('Continuing generation...');
            
            if (choice === 'redistribute') {
                updateProgress(20, `Redistributing ${sessions.length} sessions across ${configuredWeeks} weeks...`);
                
                const redistResponse = await fetch(`${API_BASE_URL}/redistribute-sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessions,
                        targetWeeks: configuredWeeks,
                        sessionsPerWeek
                    })
                });
                
                if (!redistResponse.ok) {
                    const error = await redistResponse.json();
                    throw new Error(error.error || 'Failed to redistribute sessions');
                }
                
                const result = await redistResponse.json();
                sessionsToUse = result.sessions;
                actualWeeks = configuredWeeks;
            } else {
                // Use actual weeks — update the UI field to match
                document.getElementById('totalWeeks').value = documentWeeks;
                updateTotalSessions();
                actualWeeks = documentWeeks;
            }
        }
        
        updateProgress(30, `Using ${sessionsToUse.length} sessions across ${actualWeeks} weeks. Generating plans...`);
        
        // Step 3: Generate session plans
        const courseInfo = getCourseInfo();
        
        const generateResponse = await fetch(`${API_BASE_URL}/generate-plans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessions: sessionsToUse,
                courseInfo
            })
        });
        
        if (!generateResponse.ok) {
            const error = await generateResponse.json();
            throw new Error(error.error || 'Failed to generate plans');
        }
        
        const { plans } = await generateResponse.json();
        generatedPlans = plans;
        
        updateProgress(100, 'All session plans generated successfully!');
        
        setTimeout(() => {
            hideProgress();
            displayResults();
        }, 1000);
        
    } catch (error) {
        console.error('Error:', error);
        hideProgress();
        showError(`Error: ${error.message}`);
    } finally {
        document.getElementById('generateBtn').disabled = false;
    }
}

function displayResults() {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';
    
    generatedPlans.forEach((plan, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${plan.filename}</span>
            <button class="download-btn" onclick="downloadPlan(${index})">Download</button>
        `;
        resultsList.appendChild(li);
    });
    
    showResults();
}

function downloadPlan(index) {
    const plan = generatedPlans[index];
    
    // Convert base64 to blob
    const byteCharacters = atob(plan.buffer);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = plan.filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function downloadAllAsZip() {
    try {
        showProgress('Creating ZIP file...');
        
        const response = await fetch(`${API_BASE_URL}/generate-zip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plans: generatedPlans })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create ZIP file');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'session-plans.zip';
        a.click();
        URL.revokeObjectURL(url);
        
        hideProgress();
        
    } catch (error) {
        hideProgress();
        showError('Error creating ZIP file: ' + error.message);
    }
}

// Initialize
updateTotalSessions();
