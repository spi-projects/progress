// App Constants
const STORAGE_KEY_GOALS = 'orbit_goals';
const STORAGE_KEY_HISTORY = 'orbit_history';

// State
let goals = [];
let historyData = {};
let currentDate = new Date(); // The date currently being viewed
let currentReportDate = new Date(); // The month being viewed in the report

// DOM Elements
const goalsGrid = document.getElementById('goals-grid');
const currentDateDisplay = document.getElementById('current-date-display');
const lockIndicator = document.getElementById('lock-indicator');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const circle = document.querySelector('.progress-ring__circle');
const radius = circle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;

// --- Initialization ---

circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = circumference;

function init() {
    loadData();
    updateDateDisplay();
    renderGoals();
}

function loadData() {
    const goalsRaw = localStorage.getItem(STORAGE_KEY_GOALS);
    const historyRaw = localStorage.getItem(STORAGE_KEY_HISTORY);

    goals = goalsRaw ? JSON.parse(goalsRaw) : [];
    historyData = historyRaw ? JSON.parse(historyRaw) : {};
}

function saveData() {
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyData));
}

// --- Date & Locking Logic ---

function getFormattedDate(date) {
    return date.toISOString().split('T')[0];
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

function isFuture(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const check = new Date(date);
    check.setHours(0, 0, 0, 0);
    return check > today;
}

function isLocked() {
    // Locked if the date viewed is strictly BEFORE today (not today)
    const view = new Date(currentDate);
    view.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return view < today;
}

function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    if (isToday(currentDate)) {
        currentDateDisplay.textContent = "Today, " + currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        nextDayBtn.disabled = true;
        lockIndicator.classList.add('hidden');
    } else {
        currentDateDisplay.textContent = currentDate.toLocaleDateString('en-US', options);
        nextDayBtn.disabled = false;

        if (isLocked()) {
            lockIndicator.classList.remove('hidden');
        } else {
            lockIndicator.classList.add('hidden');
        }
    }
}

// --- Core Rendering ---

function renderGoals() {
    goalsGrid.innerHTML = '';
    const dateKey = getFormattedDate(currentDate);
    const dayData = historyData[dateKey] || {};
    const locked = isLocked();

    let totalGoals = goals.length;
    let completedGoals = 0;

    goals.forEach(goal => {
        const value = dayData[goal.id] !== undefined ? dayData[goal.id] : 0;

        // Calculate completion for stats
        if (goal.type === 'boolean' && value) completedGoals++;
        if (goal.type === 'number' && value >= goal.target) completedGoals++;

        const card = document.createElement('div');
        card.className = `goal-card ${locked ? 'locked' : ''}`;

        // Visual indicator of completion
        let isDone = false;
        if (goal.type === 'boolean' && value) isDone = true;
        if (goal.type === 'number' && value >= goal.target) isDone = true;
        if (isDone) card.style.borderColor = 'var(--success-color)';

        // Inner HTML
        let inputHTML = '';

        if (goal.type === 'boolean') {
            inputHTML = `
                <label class="custom-checkbox">
                    <input type="checkbox" 
                        ${value ? 'checked' : ''} 
                        onchange="toggleBool('${goal.id}', this.checked)"
                        ${locked ? 'disabled' : ''}>
                    <span class="checkmark"><i class="fa-solid fa-check"></i></span>
                    <span class="checkbox-text">${isDone ? 'Completed' : 'Mark Done'}</span>
                </label>
            `;
        } else {
            const percentage = Math.min((value / goal.target) * 100, 100);
            inputHTML = `
                <div class="number-control-wrapper">
                    <div class="number-control">
                        <button class="num-btn" onclick="changeNumber('${goal.id}', -1)" ${locked ? 'disabled' : ''}>-</button>
                        <span class="num-display">${value} / ${goal.target}</span>
                        <button class="num-btn" onclick="changeNumber('${goal.id}', 1)" ${locked ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="goal-header">
                <div class="goal-icon"><i class="fa-solid ${goal.icon}"></i></div>
                <button class="goal-menu-btn"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="goal-title">${goal.title}</div>
            <div class="goal-input-area">
                ${inputHTML}
            </div>
        `;

        // Attach event listener programmatically
        const deleteBtn = card.querySelector('.goal-menu-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteGoal(goal.id));
        }
        goalsGrid.appendChild(card);
    });

    updateStats(completedGoals, totalGoals);
}

function updateStats(completed, total) {
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const offset = circumference - (percent / 100) * circumference;

    circle.style.strokeDashoffset = offset;
    document.getElementById('daily-text').textContent = `${percent}%`;
}

// --- Action Handlers ---

window.toggleBool = (id, checked) => {
    if (isLocked()) return; // Double security check
    updateHistory(id, checked);
};

window.changeNumber = (id, delta) => {
    if (isLocked()) return;
    const dateKey = getFormattedDate(currentDate);
    const currentVal = (historyData[dateKey] && historyData[dateKey][id]) || 0;
    const newVal = Math.max(0, currentVal + delta);
    updateHistory(id, newVal);
};

function updateHistory(id, value) {
    const dateKey = getFormattedDate(currentDate);
    if (!historyData[dateKey]) historyData[dateKey] = {};

    historyData[dateKey][id] = value;
    saveData();
    renderGoals(); // Re-render to update UI state
}

window.deleteGoal = (id) => {
    if (!confirm('Delete this orbit? Data will be preserved but goal removed.')) return;
    goals = goals.filter(g => g.id !== id);
    saveData();
    renderGoals();
};

// --- Modal & Form ---

const modal = document.getElementById('goal-modal');
const addBtn = document.getElementById('btn-add-goal');
const closeBtn = document.getElementById('close-modal');
const form = document.getElementById('goal-form');

addBtn.onclick = () => {
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
};

closeBtn.onclick = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// Type Toggle Logic
const typeRadios = document.getElementsByName('targetType');
const targetGroup = document.getElementById('target-value-group');

typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'number') {
            targetGroup.classList.remove('hidden');
        } else {
            targetGroup.classList.add('hidden');
        }
    });
});

form.onsubmit = (e) => {
    e.preventDefault();

    const title = document.getElementById('goal-title').value;
    const icon = document.getElementById('goal-icon').value || 'fa-bullseye';
    const type = document.querySelector('input[name="targetType"]:checked').value;
    const target = type === 'number' ? parseInt(document.getElementById('goal-target').value) : 1;

    const newGoal = {
        id: Date.now().toString(),
        title,
        icon,
        type,
        target
    };

    goals.push(newGoal);
    saveData();

    form.reset();
    closeBtn.click();
    renderGoals();
};

// --- Navigation ---

prevDayBtn.onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateDateDisplay();
    renderGoals();
};

nextDayBtn.onclick = () => {
    if (isToday(currentDate)) return;
    currentDate.setDate(currentDate.getDate() + 1);
    updateDateDisplay();
    renderGoals();
};

// --- Report Logic ---

const reportModal = document.getElementById('report-modal');
const btnStats = document.getElementById('btn-stats');
const closeReportBtn = document.getElementById('close-report');
const btnExportPdf = document.getElementById('btn-export-pdf'); // New
const reportBody = document.getElementById('report-body');
const reportTitle = document.getElementById('report-month-title');

// Report Navigation Elements
const prevReportBtn = document.getElementById('prev-report-month');
const nextReportBtn = document.getElementById('next-report-month');

btnStats.onclick = () => {
    currentReportDate = new Date(); // Reset to current month
    generateMonthlyReport();
    reportModal.classList.remove('hidden');
    setTimeout(() => reportModal.classList.add('visible'), 10);
};

prevReportBtn.onclick = () => {
    currentReportDate.setMonth(currentReportDate.getMonth() - 1);
    generateMonthlyReport();
};

nextReportBtn.onclick = () => {
    const today = new Date();
    // Optional: prevent going into future months ? For now allow it, it will just show 0
    currentReportDate.setMonth(currentReportDate.getMonth() + 1);
    generateMonthlyReport();
};

closeReportBtn.onclick = () => {
    reportModal.classList.remove('visible');
    setTimeout(() => reportModal.classList.add('hidden'), 300);
};

// PDF Export Logic
btnExportPdf.onclick = () => {
    exportReportToPDF();
};

function exportReportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Theme Colors (approximate for PDF)
    const primaryColor = [15, 15, 19];   // #0f0f13
    const accentColor = [0, 212, 255];   // #00d4ff

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(...accentColor);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("crypt_progress_tracker Report", 14, 25);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

    // Calc Stats Again (Reuse logic)
    const year = currentReportDate.getFullYear();
    const month = currentReportDate.getMonth();

    // For past months, daysPassed is days in month. For current month, it's today's date.
    const now = new Date();
    let daysPassed;
    if (year === now.getFullYear() && month === now.getMonth()) {
        daysPassed = now.getDate();
    } else {
        daysPassed = new Date(year, month + 1, 0).getDate();
    }

    let stats = goals.map(g => ({
        title: g.title,
        type: g.type,
        target: g.target,
        successCount: 0
    }));

    for (let d = 1; d <= daysPassed; d++) {
        const dayStr = String(d).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;
        const dayRecord = historyData[dateKey] || {};

        stats.forEach(goal => {
            const val = dayRecord[goal.id] || 0;
            let met = false;
            if (goal.type === 'boolean' && val) met = true;
            if (goal.type === 'number' && val >= goal.target) met = true;
            if (met) goal.successCount++;
        });
    }

    // Table
    const tableData = stats.map(g => {
        const percent = Math.round((g.successCount / daysPassed) * 100) + '%';
        return [g.title, g.type === 'boolean' ? 'Habit' : `Target: ${g.target}`, `${g.successCount}/${daysPassed} Days`, percent];
    });

    doc.autoTable({
        startY: 50,
        head: [['Goal/Habit', 'Target Type', 'Success Rate', 'Completion %']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: accentColor, textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("crypt_progress_tracker - Local Personal Progress System", 14, pageHeight - 10);

    // Save
    doc.save(`crypt_progress_tracker_${year}-${month + 1}.pdf`);
}

function generateMonthlyReport() {
    // 1. Determine Month Range
    const year = currentReportDate.getFullYear();
    const month = currentReportDate.getMonth();

    // Set title
    reportTitle.textContent = currentReportDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + " Report";

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Days passed so far (inclusive of today if current month, or all days if past month)
    const now = new Date();
    let daysPassed;
    if (year === now.getFullYear() && month === now.getMonth()) {
        daysPassed = now.getDate();
    } else {
        daysPassed = daysInMonth;
    }

    // 2. Aggregate Data
    // We scan from Day 1 to Day [daysPassed]
    // For each goal, count how many days target was met

    let stats = goals.map(g => ({
        ...g,
        successCount: 0
    }));

    for (let d = 1; d <= daysPassed; d++) {
        // Construct date key "YYYY-MM-DD"
        // Note: Month is 0-indexed in JS Date, but we need correct formatting
        // We use a small helper to ensure padding
        const dayStr = String(d).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        const dayRecord = historyData[dateKey] || {};

        stats.forEach(goal => {
            const val = dayRecord[goal.id] || 0;
            let met = false;

            if (goal.type === 'boolean' && val) met = true;
            if (goal.type === 'number' && val >= goal.target) met = true;

            if (met) goal.successCount++;
        });
    }

    // 3. Render
    reportBody.innerHTML = '';

    if (stats.length === 0) {
        reportBody.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No active habits to report.</p>';
        return;
    }

    stats.forEach(goal => {
        const percentage = Math.round((goal.successCount / daysPassed) * 100);

        const item = document.createElement('div');
        item.className = 'report-item';
        item.innerHTML = `
            <div class="report-header">
                <div class="report-title"><i class="fa-solid ${goal.icon}" style="color:var(--accent-color)"></i> ${goal.title}</div>
                <div class="report-stat">${goal.successCount}/${daysPassed} Days (${percentage}%)</div>
            </div>
            <div class="report-bar-bg">
                <div class="report-bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        reportBody.appendChild(item);
    });
}

// Init
init();

// --- Storage Inspector Logic ---

const storagePanel = document.getElementById('storage-panel');
// New Elements
const btnStorageToggle = document.getElementById('btn-storage-toggle');
const btnCloseStorage = document.getElementById('btn-close-storage');

// Visualization Elements
const storageBarFill = document.getElementById('storage-bar-fill');
const storageUsageText = document.getElementById('storage-usage-text');
const jsonViewer = document.getElementById('json-viewer');
const projectLocation = document.getElementById('project-location');

// Set Location Immediately
if (projectLocation) {
    // Decode URI to show spaces/special chars correctly
    let path = decodeURI(window.location.pathname);
    // Remove leading slash on windows if present (e.g. /C:/...)
    if (path.startsWith('/') && path.indexOf(':') === 2) path = path.substring(1);
    projectLocation.textContent = path || window.location.href;
}

// Open
if (btnStorageToggle) {
    btnStorageToggle.onclick = () => {
        storagePanel.classList.remove('collapsed');
        updateStorageInspector();
    };
}

// Close
if (btnCloseStorage) {
    btnCloseStorage.onclick = () => {
        storagePanel.classList.add('collapsed');
    };
}

function updateStorageInspector() {
    // 1. Calculate approximate size
    let visualObj = {}; // For nice display

    // We only care about our app's keys, but let's show all for "system" feel
    visualObj[STORAGE_KEY_GOALS] = goals;
    visualObj[STORAGE_KEY_HISTORY] = historyData;

    const jsonStr = JSON.stringify(visualObj, null, 2);

    // 2. Update Visuals
    if (jsonViewer) jsonViewer.textContent = jsonStr;

    // Approx 5MB limit for local storage
    const limit = 5 * 1024 * 1024;
    const sizeInBytes = new Blob([jsonStr]).size; // approximate utf8 size
    const kb = (sizeInBytes / 1024).toFixed(2);

    // Percentage
    const percent = Math.min((sizeInBytes / limit) * 100, 100).toFixed(4); // usually very small

    if (storageBarFill) storageBarFill.style.width = `${Math.max(percent, 1)}%`; // Min 1% visibility
    if (storageUsageText) storageUsageText.textContent = `${kb} KB Used (${percent}% of ~5MB Quota)`;
}

// Update storage inspector whenever we save
const originalSave = saveData;
saveData = function () {
    originalSave();
    if (storagePanel && !storagePanel.classList.contains('collapsed')) {
        updateStorageInspector();
    }
};
