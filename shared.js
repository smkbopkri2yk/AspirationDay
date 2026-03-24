// ===== SHARED STATE & DATA =====
// Variables are initialized with defaults; Firebase listeners will overwrite them on load.
let aspirations = [];
let currentSpeaker = { name: '', major: '', topic: '' };
let eventMode = 'normal'; // 'normal' | 'openmic' | 'debat' | 'survey'
let debateData = {
    question: '',
    guruList: [{ name: '', title: '' }, { name: '', title: '' }, { name: '', title: '' }, { name: '', title: '' }, { name: '', title: '' }],
    siswaList: [{ name: '', title: '' }, { name: '', title: '' }, { name: '', title: '' }, { name: '', title: '' }, { name: '', title: '' }],
    guruPoints: '',
    siswaPoints: '',
    activeSpeaker: { side: '', index: -1 }
};
let debateResponses = {
    setuju: 0,
    tidakSetuju: 0,
    comments: []
    // comment shape: { id, text, time }
};
let openMicData = { label: '', bullet1: '', bullet2: '', bullet3: '' };
let surveyData = {
    title: '',
    respondents: 0,
    keyFinding: '',
    issues: [
        { label: '', value: 0 },
        { label: '', value: 0 },
        { label: '', value: 0 },
        { label: '', value: 0 },
        { label: '', value: 0 }
    ]
};
let openMic2Data = {
    activeIndex: -1, // -1 = none active
    issues: [
        { label: '', setuju: 0, tidakSetuju: 0 },
        { label: '', setuju: 0, tidakSetuju: 0 },
        { label: '', setuju: 0, tidakSetuju: 0 },
        { label: '', setuju: 0, tidakSetuju: 0 },
        { label: '', setuju: 0, tidakSetuju: 0 }
    ]
};

// ===== FIREBASE SAVE FUNCTIONS =====
// Each save function writes to Firebase AND localStorage (local cache fallback)

function saveEventMode() {
    localStorage.setItem('eventMode', eventMode);
    fbSet('eventMode', eventMode);
}

function saveDebateData() {
    localStorage.setItem('debateData', JSON.stringify(debateData));
    fbSet('debateData', debateData);
}

function saveDebateResponses() {
    localStorage.setItem('debateResponses', JSON.stringify(debateResponses));
    fbSet('debateResponses', debateResponses);
}

function resetDebateResponses() {
    debateResponses = { 
        guruSetuju: 0, guruTidakSetuju: 0, 
        siswaSetuju: 0, siswaTidakSetuju: 0, 
        comments: [],
        sessionId: Date.now()
    };
    saveDebateResponses();
    // Also clear per-device tracking on this device just in case
    localStorage.removeItem('myDebateVote');
    localStorage.removeItem('myDebateVote_guru');
    localStorage.removeItem('myDebateVote_siswa');
    localStorage.removeItem('myDebateCommentCount');
}

function saveOpenMicData() {
    localStorage.setItem('openMicData', JSON.stringify(openMicData));
    fbSet('openMicData', openMicData);
}

function saveSurveyData() {
    localStorage.setItem('surveyData', JSON.stringify(surveyData));
    fbSet('surveyData', surveyData);
}

function saveOpenMic2Data() {
    localStorage.setItem('openMic2Data', JSON.stringify(openMic2Data));
    fbSet('openMic2Data', openMic2Data);
}

// Timer State (synced via Firebase)
let timerDuration = 180;
let timerRemaining = 180;
let timerInterval = null;
let timerRunning = false;
let timerExpired = false;
let _isSaving = false; // Prevent Firebase echo loop when this page saves timer state
// timerMode: 'openmic' | 'debat-guru' | 'debat-siswa' | 'debat-respon'
let timerMode = 'openmic';

function saveTimerMode() {
    localStorage.setItem('timerMode', timerMode);
    fbSet('timerMode', timerMode);
}

const catIcons = {
    'Fasilitas': '🏢', 'Akademik': '📚', 'Kedisiplinan': '⚖️', 'Ekskul': '⚽', 'Kesejahteraan': '💖'
};

// Load timer state from Firebase snapshot or localStorage
function loadTimerState(data) {
    const saved = data || JSON.parse(localStorage.getItem('timerState'));
    if (saved) {
        timerDuration = saved.duration || 180;
        timerRemaining = saved.remaining || 180;
        // If timer was running, calculate elapsed time since last update
        if (saved.running && saved.lastUpdate) {
            const elapsed = Math.floor((Date.now() - saved.lastUpdate) / 1000);
            timerRemaining = Math.max(0, saved.remaining - elapsed);
        }
        timerRunning = saved.running || false;
        if (saved.mode) timerMode = saved.mode;
    }
}

function saveTimerState() {
    _isSaving = true;
    const stateObj = {
        duration: timerDuration,
        remaining: timerRemaining,
        running: timerRunning,
        mode: timerMode,
        lastUpdate: Date.now()
    };
    localStorage.setItem('timerState', JSON.stringify(stateObj));
    fbSet('timerState', stateObj);
    // Reset flag after short delay to let Firebase echo settle
    setTimeout(() => { _isSaving = false; }, 500);
}

// ===== HELPERS =====
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function saveState() {
    localStorage.setItem('aspirations', JSON.stringify(aspirations));
    // Save aspirations as an object keyed by id for Firebase
    const aspObj = {};
    aspirations.forEach(a => { aspObj[a.id] = a; });
    fbSet('aspirations', aspObj);
}

function saveSpeaker() {
    localStorage.setItem('currentSpeaker', JSON.stringify(currentSpeaker));
    fbSet('currentSpeaker', currentSpeaker);
}

// ===== TOAST SYSTEM =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');

    let bgClass = 'bg-white text-gray-800 border-l-4 border-blue-500';
    let icon = '<i class="ph-fill ph-info text-blue-500 text-xl"></i>';

    if (type === 'success') {
        bgClass = 'bg-white text-gray-800 border-l-4 border-green-500';
        icon = '<i class="ph-fill ph-check-circle text-green-500 text-xl"></i>';
    } else if (type === 'warning') {
        bgClass = 'bg-white text-gray-800 border-l-4 border-yellow-500';
        icon = '<i class="ph-fill ph-warning text-yellow-500 text-xl"></i>';
    } else if (type === 'error') {
        bgClass = 'bg-white text-gray-800 border-l-4 border-red-500';
        icon = '<i class="ph-fill ph-x-circle text-red-500 text-xl"></i>';
    }

    toast.className = `flex items-center gap-3 p-4 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] slide-in-right pointer-events-auto ${bgClass}`;
    toast.innerHTML = `${icon} <span class="font-semibold text-sm">${escapeHTML(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== TIMER LOGIC =====
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimerUI() {
    const text = formatTime(timerRemaining);

    // Admin timer display
    const adminTimerEl = document.getElementById('admin-timer-display');
    if (adminTimerEl) adminTimerEl.innerText = text;

    // Debate panel timer display
    const debatTimerEl = document.getElementById('debat-timer-display');
    if (debatTimerEl) debatTimerEl.innerText = text;

    // Projector timer display
    const projTimerEl = document.getElementById('proj-timer-text');
    const projTimerCard = document.getElementById('proj-timer-card');
    const projBg = document.getElementById('proj-bg');

    if (projTimerEl) {
        projTimerEl.innerText = text;

        // Calculate progress for the progress bar (100% = full, 0% = empty)
        const pct = timerDuration > 0 ? (timerRemaining / timerDuration) * 100 : 0;
        const progressEl = document.getElementById('proj-timer-progress');
        if (progressEl) progressEl.style.width = pct + '%';

        if (timerRemaining > 30) {
            projTimerEl.className = "text-[7rem] xl:text-[9rem] leading-none font-black font-mono tracking-tighter text-emerald-400 drop-shadow-lg transition-all duration-300";
            if (progressEl) progressEl.className = 'h-full bg-emerald-400 rounded-full transition-all duration-1000';
            if (projBg) projBg.className = "absolute inset-0 bg-gradient-to-br from-blue-900 via-gray-900 to-green-900/30 transition-colors duration-1000 z-0";
            if (projTimerCard) projTimerCard.classList.remove('pulse-red');
        } else if (timerRemaining <= 30 && timerRemaining > 15) {
            projTimerEl.className = "text-[7rem] xl:text-[9rem] leading-none font-black font-mono tracking-tighter text-yellow-400 drop-shadow-lg transition-all duration-300 scale-105";
            if (progressEl) progressEl.className = 'h-full bg-yellow-400 rounded-full transition-all duration-1000';
            if (projBg) projBg.className = "absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-yellow-900/40 transition-colors duration-1000 z-0";
            if (projTimerCard) projTimerCard.classList.remove('pulse-red');
        } else if (timerRemaining <= 15 && timerRemaining > 0) {
            projTimerEl.className = "text-[7rem] xl:text-[9rem] leading-none font-black font-mono tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] transition-all duration-300 scale-110";
            if (progressEl) progressEl.className = 'h-full bg-red-500 rounded-full transition-all duration-500 animate-pulse';
            if (projBg) projBg.className = "absolute inset-0 bg-gradient-to-br from-gray-900 to-red-900/60 transition-colors duration-500 z-0";
            if (projTimerCard) projTimerCard.classList.add('pulse-red');
        } else {
            projTimerEl.className = "text-[7rem] xl:text-[9rem] leading-none font-black font-mono tracking-tighter text-red-600 animate-bounce";
            if (progressEl) progressEl.style.width = '0%';
            // Show WAKTU HABIS overlay
            const expiredOverlay = document.getElementById('timer-expired-overlay');
            if (expiredOverlay) { expiredOverlay.classList.remove('hidden'); setTimeout(() => expiredOverlay.classList.add('hidden'), 3000); }
        }
    }
}

function setTimerDuration(seconds) {
    timerDuration = seconds;
    resetTimer();
    showToast(`Durasi diset ${seconds / 60} menit.`, 'info');
}

function startTimer() {
    if (!timerRunning && timerRemaining > 0) {
        timerRunning = true;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        saveTimerState();
        timerInterval = setInterval(() => {
            timerRemaining--;
            updateTimerUI();
            // Save state every 5 seconds to reduce Firebase writes and echo loops
            if (timerRemaining % 5 === 0) saveTimerState();
            if (timerRemaining <= 0) {
                timerRemaining = 0;
                pauseTimer();
                playBeep();
                timerExpired = true;
                fbSet('timerExpired', true);
                showToast('Waktu habis!', 'warning');
            }
        }, 1000);
    }
}

function pauseTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    saveTimerState();
}

function resetTimer() {
    pauseTimer();
    timerRemaining = timerDuration;
    timerExpired = false;
    fbSet('timerExpired', false);
    updateTimerUI();
    saveTimerState();
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // 3-tone descending chime: C5 → A4 → F4
        [[523, 0], [440, 0.35], [349, 0.7]].forEach(([freq, when]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
            gain.gain.setValueAtTime(0, ctx.currentTime + when);
            gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + when + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.9);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + when);
            osc.stop(ctx.currentTime + when + 0.9);
        });
    } catch (e) { console.log('Audio not supported'); }
}

// ===== TICKER =====
function updateTicker() {
    const tickerEl = document.getElementById('proj-ticker-content');
    if (!tickerEl) return;

    const feed = aspirations.filter(a => a.status === 'pending' || a.status === 'approved');

    if (feed.length === 0) {
        tickerEl.innerHTML = '<div class="ticker-item">Gunakan portal siswa di HP Anda untuk mulai mengirim aspirasi! Suara Anda menentukan perubahan.</div>';
        return;
    }

    const icons = { 'Fasilitas': '🏢', 'Akademik': '📚', 'Kedisiplinan': '⚖️', 'Ekskul': '⚽', 'Kesejahteraan': '💖' };
    let html = '';
    feed.slice(-15).forEach(asp => {
        const icon = icons[asp.category] || '📣';
        const preview = asp.text.length > 70 ? asp.text.substring(0, 70) + '…' : asp.text;
        html += `<div class="ticker-item">${icon} <span class="text-yellow-300 mx-1">${escapeHTML(asp.category)}</span> — "${escapeHTML(preview)}"</div>`;
        html += `<div class="ticker-item text-white/40">  ✦  </div>`;
    });
    tickerEl.innerHTML = html;
}

// ===== CROSS-PAGE SYNC VIA FIREBASE =====
// Each page registers its own onFirebaseUpdate callback
let _onFirebaseUpdate = null;

// Legacy compatibility alias
function onStorageSync(callback) {
    _onFirebaseUpdate = callback;
}

// Flag to prevent re-entrant listener triggering during init
let _firebaseInitialized = false;

function initFirebaseListeners() {
    // Aspirations
    fbListen('aspirations', (val) => {
        if (val) {
            aspirations = Object.values(val);
            localStorage.setItem('aspirations', JSON.stringify(aspirations));
        } else {
            aspirations = [];
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('aspirations');
    });

    // Current Speaker
    fbListen('currentSpeaker', (val) => {
        if (val) {
            currentSpeaker = val;
            localStorage.setItem('currentSpeaker', JSON.stringify(currentSpeaker));
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('currentSpeaker');
    });

    // Event Mode
    fbListen('eventMode', (val) => {
        if (val !== null && val !== undefined) {
            eventMode = val;
            localStorage.setItem('eventMode', eventMode);
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('eventMode');
    });

    // Debate Data
    fbListen('debateData', (val) => {
        if (val) {
            debateData = val;
            // Ensure arrays exist
            if (!debateData.guruList) debateData.guruList = [];
            if (!debateData.siswaList) debateData.siswaList = [];
            if (!debateData.activeSpeaker) debateData.activeSpeaker = { side: '', index: -1 };
            localStorage.setItem('debateData', JSON.stringify(debateData));
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('debateData');
    });

    // Debate Responses (audience votes + comments)
    fbListen('debateResponses', (val) => {
        if (val) {
            debateResponses = val;
            if (!debateResponses.comments) debateResponses.comments = [];
            localStorage.setItem('debateResponses', JSON.stringify(debateResponses));
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('debateResponses');
    });

    // Open Mic Data
    fbListen('openMicData', (val) => {
        if (val) {
            openMicData = val;
            localStorage.setItem('openMicData', JSON.stringify(openMicData));
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('openMicData');
    });

    // Survey Data
    fbListen('surveyData', (val) => {
        if (val) {
            surveyData = val;
            localStorage.setItem('surveyData', JSON.stringify(surveyData));
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('surveyData');
    });

    // Open Mic 2 Data
    fbListen('openMic2Data', (val) => {
        if (val) {
            openMic2Data = val;
            // Ensure issues array exists
            if (!openMic2Data.issues) openMic2Data.issues = [];
            localStorage.setItem('openMic2Data', JSON.stringify(openMic2Data));
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('openMic2Data');
    });

    // Timer Mode
    fbListen('timerMode', (val) => {
        if (val !== null && val !== undefined) {
            timerMode = val;
            localStorage.setItem('timerMode', timerMode);
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('timerMode');
    });

    // Timer State
    fbListen('timerState', (val) => {
        if (val) {
            // Skip if this page just saved the state (avoid echo loop)
            if (_isSaving) {
                if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('timerState');
                return;
            }
            loadTimerState(val);
            localStorage.setItem('timerState', JSON.stringify(val));
            // Fix double-tick: always clear existing interval before possibly starting a new one
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            if (timerRunning && timerRemaining > 0) {
                timerInterval = setInterval(() => {
                    timerRemaining--;
                    updateTimerUI();
                    if (timerRemaining <= 0) {
                        timerRemaining = 0;
                        pauseTimer();
                        playBeep();
                    }
                }, 1000);
            }
            updateTimerUI();
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('timerState');
    });

    // Projector Right View
    fbListen('projectorRightView', (val) => {
        if (val !== null && val !== undefined) {
            localStorage.setItem('projectorRightView', val);
            if (typeof projectorRightView !== 'undefined') {
                projectorRightView = val;
                if (typeof renderOpenMicPanel === 'function') renderOpenMicPanel();
            }
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('projectorRightView');
    });

    // Debate Projector View
    fbListen('debateProjectorView', (val) => {
        if (val !== null && val !== undefined) {
            localStorage.setItem('debateProjectorView', val);
            if (typeof debateProjectorView !== 'undefined') {
                debateProjectorView = val;
                if (typeof toggleDebateView === 'function') {
                    if (debateProjectorView === 'aspirasi' && typeof applyProjectorMode !== 'undefined') {
                        const mainGrid = document.querySelector('.flex-1.grid');
                        if (mainGrid) { debateProjectorView = 'debate'; toggleDebateView(); }
                    } else if (debateProjectorView === 'debate' && typeof applyProjectorMode !== 'undefined') {
                        applyProjectorMode();
                    }
                }
            }
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('debateProjectorView');
    });

    // Timer Expired
    fbListen('timerExpired', (val) => {
        timerExpired = val === true;
        localStorage.setItem('timerExpired', timerExpired ? 'true' : 'false');
    });

    // Aspirasi Enabled Status
    fbListen('aspirasiEnabled', (val) => {
        if (val !== null && val !== undefined) {
            localStorage.setItem('aspirasiEnabled', val ? 'true' : 'false');
        }
        if (_firebaseInitialized && _onFirebaseUpdate) _onFirebaseUpdate('aspirasiEnabled');
    });

    // Mark initialization complete after a short delay to let initial values load
    setTimeout(() => { _firebaseInitialized = true; }, 1500);
}

// Also keep localStorage listener as fallback for same-browser tab sync
window.addEventListener('storage', (e) => {
    // Only handle keys that are local-only (like myOM2Votes, adminLoggedIn)
    // Firebase handles all shared data now
    if (e.key === 'myOM2Votes' || e.key === 'adminLoggedIn') {
        if (_onFirebaseUpdate) _onFirebaseUpdate(e.key);
    }
});

// Initialize Firebase listeners on load
initFirebaseListeners();

// Load initial timer state from localStorage cache (Firebase will overwrite soon)
loadTimerState();
