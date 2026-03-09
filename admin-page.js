// ===== ADMIN PAGE LOGIC =====
let activeLiveAspirationId = null;
let voteNotifCount = 0;
let previousVoteTotals = {};

// Cache vote totals for detecting new votes
function cacheVoteTotals() {
    previousVoteTotals = {};
    aspirations.forEach(a => {
        previousVoteTotals[a.id] = (a.upvotes || 0) + (a.downvotes || 0);
    });
}

// ===== MODAL SYSTEM =====
function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    body.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ===== LOGIN =====
function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    if (user === 'admin' && pass === 'password123') {
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        localStorage.setItem('adminLoggedIn', 'true');
        showAdminDashboard();
        Swal.fire({
            icon: 'success',
            title: 'Selamat Datang!',
            text: 'Login berhasil. Dashboard admin siap digunakan.',
            timer: 2000,
            showConfirmButton: false,
            background: '#f0f9ff',
            iconColor: '#3b82f6'
        });
    } else {
        document.getElementById('login-error').classList.remove('hidden');
        Swal.fire({
            icon: 'error',
            title: 'Login Gagal',
            text: 'Username atau password salah.',
            confirmButtonColor: '#ef4444'
        });
    }
}

function handleLogout() {
    Swal.fire({
        title: 'Logout?',
        text: 'Anda yakin ingin keluar dari dashboard admin?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Logout',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('adminLoggedIn');
            document.getElementById('view-admin').classList.add('hide');
            document.getElementById('view-admin-login').classList.remove('hide');
            showToast('Anda telah logout.', 'info');
        }
    });
}

function showAdminDashboard() {
    document.getElementById('view-admin-login').classList.add('hide');
    document.getElementById('view-admin').classList.remove('hide');
    updateAdminDashboard();
    updateTimerUI();
    initAdminTimer();
    prefillSpeakerFields();
    cacheVoteTotals();
    updateStartButtonState();
}

function prefillSpeakerFields() {
    if (currentSpeaker.name) document.getElementById('ctrl-name').value = currentSpeaker.name;
    if (currentSpeaker.major && currentSpeaker.major !== '-') document.getElementById('ctrl-major').value = currentSpeaker.major;
    if (currentSpeaker.topic && currentSpeaker.topic !== '-') document.getElementById('ctrl-topic').value = currentSpeaker.topic;
}

function initAdminTimer() {
    loadTimerState();
    updateTimerUI();
    updateStartButtonState();
    // Timer interval is managed by startTimer() and Firebase listener in shared.js
    // No duplicate interval here — just resume if timer was running
    if (timerRunning && timerRemaining > 0 && !timerInterval) {
        // Re-use startTimer logic: set running=false first so startTimer() will proceed
        timerRunning = false;
        startTimer();
    }
}

function updateStartButtonState() {
    const startBtn = document.querySelector('[onclick="startTimer()"]');
    if (!startBtn) return;
    timerExpired = localStorage.getItem('timerExpired') === 'true';
    if (timerExpired || timerRemaining === 0) {
        startBtn.disabled = true;
        startBtn.classList.add('opacity-40', 'cursor-not-allowed');
        startBtn.classList.remove('hover:scale-105');
        startBtn.title = 'Waktu habis — tekan Reset untuk mengulang';
    } else {
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        startBtn.title = 'Start';
    }
}

// ===== ADMIN TABS =====
function switchAdminTab(tabName) {
    ['moderasi', 'timer', 'laporan'].forEach(t => {
        document.getElementById(`admin-tab-${t}`).classList.add('hidden');
        document.getElementById(`tab-btn-${t}`).className = "w-full flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-blue-50 hover:text-blue-600 font-semibold transition";
    });
    document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).className = "w-full flex items-center gap-3 p-3 rounded-xl bg-blue-100 text-blue-700 font-bold transition shadow-sm";
    if (tabName === 'laporan') updateAnalytics();
    if (tabName === 'timer') updateTimerUI();
}

// ===== ADMIN DASHBOARD (READ) =====
function updateAdminDashboard() {
    const pendingCount = aspirations.filter(a => a.status === 'pending').length;
    document.getElementById('live-count').innerText = pendingCount;

    const searchTerm = document.getElementById('admin-search').value.toLowerCase();
    const filterCat = document.getElementById('admin-filter-cat').value;
    const listEl = document.getElementById('admin-aspiration-list');
    listEl.innerHTML = '';

    let filtered = aspirations.filter(a => {
        const matchSearch = a.text.toLowerCase().includes(searchTerm);
        const matchCat = filterCat === 'all' ? true : a.category === filterCat;
        return matchSearch && matchCat;
    }).sort((a, b) => {
        const order = { 'shown': 1, 'pending': 2, 'approved': 3, 'rejected': 4 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return b.id - a.id;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="col-span-full text-center p-10 bg-white/50 rounded-2xl"><i class="ph-duotone ph-magnifying-glass text-4xl text-gray-400 mb-2"></i><p class="text-gray-500 font-semibold">Tidak ada aspirasi ditemukan.</p></div>`;
    }

    filtered.forEach(asp => {
        let badgeClass = "bg-yellow-100 text-yellow-700 border border-yellow-300";
        if (asp.status === 'shown') badgeClass = "bg-blue-600 text-white shadow-md animate-pulse";
        if (asp.status === 'approved') badgeClass = "bg-green-100 text-green-700 border border-green-300";
        if (asp.status === 'rejected') badgeClass = "bg-red-50 text-red-500 opacity-60";

        let statusLabel = asp.status.toUpperCase();
        if (asp.status === 'shown') statusLabel = 'ON SCREEN';

        const card = document.createElement('div');
        card.className = `clay-card p-5 flex flex-col relative transition-all cursor-pointer hover:shadow-lg ${asp.status === 'shown' ? 'ring-2 ring-blue-400 scale-[1.02]' : ''} ${asp.status === 'rejected' ? 'grayscale opacity-60' : ''}`;

        let actionBtns = '';
        // View detail button (always)
        actionBtns += `<button onclick="event.stopPropagation();openDetailModal('${asp.id}')" class="px-3 py-2 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg transition" title="Lihat Detail"><i class="ph-bold ph-eye"></i></button>`;

        if (asp.status === 'pending' || asp.status === 'approved') {
            actionBtns += `<button onclick="event.stopPropagation();showAspirationOnProjector('${asp.id}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 transition" title="Tampilkan di Layar Besar"><i class="ph-bold ph-projector-screen"></i></button>`;
        }
        if (asp.status === 'pending') {
            actionBtns += `<button onclick="event.stopPropagation();approveAspiration('${asp.id}')" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold shadow transition" title="Approve"><i class="ph-bold ph-check"></i></button>`;
            actionBtns += `<button onclick="event.stopPropagation();confirmReject('${asp.id}')" class="px-3 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition" title="Tolak"><i class="ph-bold ph-trash"></i></button>`;
        }
        if (asp.status === 'shown') {
            actionBtns += `<button onclick="event.stopPropagation();unshowAspiration('${asp.id}')" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs font-bold shadow transition">Turunkan</button>`;
        }
        // Edit button (not for rejected)
        if (asp.status !== 'rejected') {
            actionBtns += `<button onclick="event.stopPropagation();openEditModal('${asp.id}')" class="px-3 py-2 bg-white border border-yellow-300 text-yellow-600 hover:bg-yellow-50 rounded-lg transition" title="Edit"><i class="ph-bold ph-pencil-simple"></i></button>`;
        }
        // Permanent delete
        actionBtns += `<button onclick="event.stopPropagation();confirmDelete('${asp.id}')" class="px-3 py-2 bg-white border border-red-200 text-red-400 hover:bg-red-50 rounded-lg transition" title="Hapus Permanen"><i class="ph-bold ph-x"></i></button>`;

        card.setAttribute('onclick', `openDetailModal('${asp.id}')`);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex gap-2 flex-wrap">
                    <span class="px-3 py-1 rounded-md text-xs font-bold ${badgeClass}">${statusLabel}</span>
                    <span class="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold text-gray-600">${catIcons[asp.category]} ${escapeHTML(asp.category)}</span>
                </div>
                <span class="text-xs text-gray-400 font-mono"><i class="ph ph-clock"></i> ${asp.time}</span>
            </div>
            <p class="text-gray-800 font-medium text-sm mb-4 leading-relaxed bg-white/60 p-3 rounded-xl flex-1">${escapeHTML(asp.text)}</p>
            <div class="flex gap-2 justify-between items-center mt-2">
                <div class="flex gap-3 text-xs font-bold text-gray-500">
                    <span class="flex items-center gap-1 text-green-600"><i class="ph-fill ph-thumbs-up text-lg"></i> ${asp.upvotes}</span>
                    <span class="flex items-center gap-1 text-red-500"><i class="ph-fill ph-thumbs-down text-lg"></i> ${asp.downvotes}</span>
                </div>
                <div class="flex gap-2 flex-wrap justify-end">${actionBtns}</div>
            </div>
        `;
        listEl.appendChild(card);
    });
    updateAnalytics();
}

// ===== CRUD: CREATE (via student portal — admin can also create) =====
function openCreateModal() {
    openModal(`
        <div class="p-6 sm:p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-extrabold text-gray-800 flex items-center gap-2"><i class="ph-fill ph-plus-circle text-blue-500 text-2xl"></i> Buat Aspirasi Baru</h3>
                <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><i class="ph-bold ph-x text-gray-500"></i></button>
            </div>
            <form onsubmit="createAspirationFromAdmin(event)" class="space-y-4">
                <div>
                    <label class="block font-semibold mb-1 text-sm text-gray-700">Kategori</label>
                    <select id="modal-create-cat" class="clay-input w-full p-3 text-gray-700" required>
                        <option value="" disabled selected>Pilih Kategori...</option>
                        <option value="Fasilitas">🏢 Fasilitas Sekolah</option>
                        <option value="Akademik">📚 Akademik & Kurikulum</option>
                        <option value="Kedisiplinan">⚖️ Kedisiplinan</option>
                        <option value="Ekskul">⚽ Ekstrakurikuler</option>
                        <option value="Kesejahteraan">💖 Kesejahteraan Siswa</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1 text-sm text-gray-700">Isi Aspirasi</label>
                    <textarea id="modal-create-text" class="clay-input w-full p-3 text-gray-700 h-28 resize-none" placeholder="Tuliskan aspirasi..." required></textarea>
                </div>
                <div>
                    <label class="block font-semibold mb-1 text-sm text-gray-700">Status Awal</label>
                    <select id="modal-create-status" class="clay-input w-full p-3 text-gray-700">
                        <option value="pending">Pending (Menunggu Moderasi)</option>
                        <option value="approved">Approved (Langsung Vote)</option>
                    </select>
                </div>
                <button type="submit" class="clay-btn-blue w-full py-4 font-bold text-base flex items-center justify-center gap-2"><i class="ph-bold ph-plus"></i> Tambahkan Aspirasi</button>
            </form>
        </div>
    `);
}

function createAspirationFromAdmin(e) {
    e.preventDefault();
    const cat = document.getElementById('modal-create-cat').value;
    const text = document.getElementById('modal-create-text').value.trim();
    const status = document.getElementById('modal-create-status').value;
    if (!text) return;

    aspirations.push({
        id: Date.now().toString(),
        category: cat,
        text: text,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: status,
        upvotes: 0,
        downvotes: 0,
        userVote: null
    });
    saveState();
    closeModal();
    updateAdminDashboard();
    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Aspirasi baru ditambahkan.', timer: 1500, showConfirmButton: false });
}

// ===== CRUD: READ (Detail Modal) =====
function openDetailModal(id) {
    const asp = aspirations.find(a => a.id === id);
    if (!asp) return;

    const totalVotes = asp.upvotes + asp.downvotes;
    const upPercent = totalVotes > 0 ? Math.round((asp.upvotes / totalVotes) * 100) : 0;

    let statusColor = 'bg-yellow-100 text-yellow-700';
    if (asp.status === 'shown') statusColor = 'bg-blue-600 text-white';
    if (asp.status === 'approved') statusColor = 'bg-green-100 text-green-700';
    if (asp.status === 'rejected') statusColor = 'bg-red-100 text-red-600';

    openModal(`
        <div class="p-6 sm:p-8">
            <div class="flex justify-between items-start mb-6">
                <div class="flex gap-2 items-center">
                    <span class="px-3 py-1 rounded-lg text-xs font-bold ${statusColor}">${asp.status === 'shown' ? 'ON SCREEN' : asp.status.toUpperCase()}</span>
                    <span class="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold text-gray-600">${catIcons[asp.category]} ${escapeHTML(asp.category)}</span>
                </div>
                <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><i class="ph-bold ph-x text-gray-500"></i></button>
            </div>
            <div class="bg-blue-50/80 p-5 rounded-2xl border border-blue-100 mb-6">
                <p class="text-gray-800 text-lg font-semibold leading-relaxed">"${escapeHTML(asp.text)}"</p>
            </div>
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                    <p class="text-2xl font-black text-green-600">${asp.upvotes}</p>
                    <p class="text-xs font-semibold text-green-500 mt-1"><i class="ph-fill ph-thumbs-up"></i> Setuju</p>
                </div>
                <div class="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                    <p class="text-2xl font-black text-red-500">${asp.downvotes}</p>
                    <p class="text-xs font-semibold text-red-400 mt-1"><i class="ph-fill ph-thumbs-down"></i> Tidak</p>
                </div>
                <div class="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p class="text-2xl font-black text-blue-600">${upPercent}%</p>
                    <p class="text-xs font-semibold text-blue-500 mt-1"><i class="ph-fill ph-chart-bar"></i> Approval</p>
                </div>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-400 mb-4">
                <i class="ph ph-clock"></i> Dikirim pada ${asp.time} • ID: ${asp.id}
            </div>
            ${asp._ip ? `
            <details class="mb-6 group">
                <summary class="cursor-pointer text-xs font-bold text-gray-400 hover:text-red-500 transition flex items-center gap-1.5 select-none">
                    <i class="ph-fill ph-shield-warning text-sm"></i> Forensik Pengirim (Internal Panitia)
                    <i class="ph-bold ph-caret-down text-[10px] group-open:rotate-180 transition-transform"></i>
                </summary>
                <div class="mt-3 p-4 bg-gray-900 text-gray-300 rounded-xl text-xs font-mono space-y-2 border border-gray-700">
                    <div class="flex items-start gap-2">
                        <span class="text-red-400 font-bold shrink-0">IP:</span>
                        <span class="text-yellow-300 break-all">${escapeHTML(asp._ip)}</span>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="text-red-400 font-bold shrink-0">UA:</span>
                        <span class="text-gray-400 break-all">${escapeHTML(asp._ua || 'N/A')}</span>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="text-red-400 font-bold shrink-0">Waktu:</span>
                        <span class="text-gray-400">${asp._ts ? new Date(asp._ts).toLocaleString('id-ID') : 'N/A'}</span>
                    </div>
                </div>
            </details>
            ` : '<div class="text-xs text-gray-300 italic mb-6">Data IP tidak tersedia (aspirasi lama)</div>'}
            <div class="flex gap-2 flex-wrap">
                ${asp.status !== 'rejected' ? `<button onclick="closeModal();openEditModal('${asp.id}')" class="flex-1 py-3 rounded-xl bg-yellow-50 border-2 border-yellow-300 text-yellow-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-100 transition"><i class="ph-bold ph-pencil-simple"></i> Edit</button>` : ''}
                ${asp.status === 'pending' ? `<button onclick="closeModal();approveAspiration('${asp.id}')" class="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition"><i class="ph-bold ph-check"></i> Approve</button>` : ''}
                <button onclick="closeModal();confirmDelete('${asp.id}')" class="flex-1 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition"><i class="ph-bold ph-trash"></i> Hapus</button>
            </div>
        </div>
    `);
}

// ===== CRUD: UPDATE (Edit Modal) =====
function openEditModal(id) {
    const asp = aspirations.find(a => a.id === id);
    if (!asp) return;

    openModal(`
        <div class="p-6 sm:p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-extrabold text-gray-800 flex items-center gap-2"><i class="ph-fill ph-pencil-simple text-yellow-500 text-2xl"></i> Edit Aspirasi</h3>
                <button onclick="closeModal()" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><i class="ph-bold ph-x text-gray-500"></i></button>
            </div>
            <form onsubmit="saveEditAspiration(event, '${asp.id}')" class="space-y-4">
                <div>
                    <label class="block font-semibold mb-1 text-sm text-gray-700">Kategori</label>
                    <select id="modal-edit-cat" class="clay-input w-full p-3 text-gray-700">
                        <option value="Fasilitas" ${asp.category === 'Fasilitas' ? 'selected' : ''}>🏢 Fasilitas Sekolah</option>
                        <option value="Akademik" ${asp.category === 'Akademik' ? 'selected' : ''}>📚 Akademik & Kurikulum</option>
                        <option value="Kedisiplinan" ${asp.category === 'Kedisiplinan' ? 'selected' : ''}>⚖️ Kedisiplinan</option>
                        <option value="Ekskul" ${asp.category === 'Ekskul' ? 'selected' : ''}>⚽ Ekstrakurikuler</option>
                        <option value="Kesejahteraan" ${asp.category === 'Kesejahteraan' ? 'selected' : ''}>💖 Kesejahteraan Siswa</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1 text-sm text-gray-700">Isi Aspirasi</label>
                    <textarea id="modal-edit-text" class="clay-input w-full p-3 text-gray-700 h-28 resize-none">${escapeHTML(asp.text)}</textarea>
                </div>
                <div>
                    <label class="block font-semibold mb-1 text-sm text-gray-700">Status</label>
                    <select id="modal-edit-status" class="clay-input w-full p-3 text-gray-700">
                        <option value="pending" ${asp.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${asp.status === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="shown" ${asp.status === 'shown' ? 'selected' : ''}>On Screen</option>
                        <option value="rejected" ${asp.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="closeModal()" class="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition">Batal</button>
                    <button type="submit" class="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"><i class="ph-bold ph-check"></i> Simpan</button>
                </div>
            </form>
        </div>
    `);
}

function saveEditAspiration(e, id) {
    e.preventDefault();
    const asp = aspirations.find(a => a.id === id);
    if (!asp) return;

    asp.category = document.getElementById('modal-edit-cat').value;
    asp.text = document.getElementById('modal-edit-text').value.trim();
    asp.status = document.getElementById('modal-edit-status').value;

    saveState();
    closeModal();
    updateAdminDashboard();
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Aspirasi berhasil diperbarui.', timer: 1500, showConfirmButton: false });
}

// ===== CRUD: DELETE =====
function confirmDelete(id) {
    Swal.fire({
        title: 'Hapus Aspirasi?',
        text: 'Aspirasi akan dihapus secara permanen dan tidak bisa dikembalikan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="ph-bold ph-trash"></i> Ya, Hapus!',
        cancelButtonText: 'Batal',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            aspirations = aspirations.filter(a => a.id !== id);
            saveState();
            updateAdminDashboard();
            Swal.fire({ icon: 'success', title: 'Dihapus!', text: 'Aspirasi berhasil dihapus.', timer: 1500, showConfirmButton: false });
        }
    });
}

// ===== MODERATION ACTIONS =====
function approveAspiration(id) {
    const asp = aspirations.find(a => a.id === id);
    if (asp) {
        asp.status = 'approved';
        saveState();
        updateAdminDashboard();
        showToast('Aspirasi masuk ke ruang vote siswa.', 'success');
    }
}

function confirmReject(id) {
    Swal.fire({
        title: 'Tolak Aspirasi?',
        text: 'Aspirasi yang ditolak tidak akan tampil di portal siswa.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Tolak',
        cancelButtonText: 'Batal',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            rejectAspiration(id);
        }
    });
}

function showAspirationOnProjector(id) {
    aspirations.forEach(a => { if (a.status === 'shown') a.status = 'approved'; });
    const asp = aspirations.find(a => a.id === id);
    if (asp) {
        asp.status = 'shown';
        activeLiveAspirationId = id;
        saveState();
        updateAdminDashboard();
        Swal.fire({
            icon: 'success',
            title: 'Ditampilkan!',
            text: 'Aspirasi sekarang tampil di layar proyektor.',
            timer: 1500,
            showConfirmButton: false,
            background: '#eff6ff',
            iconColor: '#3b82f6'
        });
    }
}

function unshowAspiration(id) {
    const asp = aspirations.find(a => a.id === id);
    if (asp) { asp.status = 'approved'; activeLiveAspirationId = null; saveState(); updateAdminDashboard(); }
}

function rejectAspiration(id) {
    const asp = aspirations.find(a => a.id === id);
    if (asp) {
        asp.status = 'rejected';
        if (activeLiveAspirationId === id) activeLiveAspirationId = null;
        saveState();
        updateAdminDashboard();
        showToast('Aspirasi ditolak.', 'warning');
    }
}

// ===== SPEAKER INFO =====
function updateSpeakerInfo() {
    currentSpeaker.name = document.getElementById('ctrl-name').value || 'Siswa Pembicara';
    currentSpeaker.major = document.getElementById('ctrl-major').value || '-';
    currentSpeaker.topic = document.getElementById('ctrl-topic').value || '-';
    saveSpeaker();
    Swal.fire({
        icon: 'success',
        title: 'Diperbarui!',
        text: 'Info orator berhasil dikirim ke layar proyektor.',
        timer: 1500,
        showConfirmButton: false
    });

    // Force a storage event locally so projector updates immediately
    localStorage.setItem('speakerUpdateTick', Date.now().toString());
}

// ===== ANALYTICS =====
function updateAnalytics() {
    const totalEl = document.getElementById('stat-total');
    const votesEl = document.getElementById('stat-votes');
    const topEl = document.getElementById('stat-top');
    if (!totalEl) return;

    totalEl.innerText = aspirations.length;
    let totalVotes = 0;
    const catCount = {};
    aspirations.forEach(a => {
        totalVotes += (a.upvotes + a.downvotes);
        if (a.status !== 'rejected') catCount[a.category] = (catCount[a.category] || 0) + 1;
    });
    votesEl.innerText = totalVotes;
    if (Object.keys(catCount).length > 0) {
        topEl.innerText = Object.keys(catCount).reduce((a, b) => catCount[a] > catCount[b] ? a : b);
    } else { topEl.innerText = '-'; }
}

// ===== AI SUMMARY =====
function generateAISummary() {
    const btn = document.getElementById('btn-ai-summary');
    const res = document.getElementById('ai-summary-result');
    const validAsps = aspirations.filter(a => a.status !== 'rejected');
    if (validAsps.length < 3) {
        Swal.fire({ icon: 'info', title: 'Data Kurang', text: 'Butuh minimal 3 aspirasi valid untuk membuat ringkasan AI.', confirmButtonColor: '#3b82f6' });
        return;
    }
    btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Menganalisis...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Buat Ringkasan';
        btn.disabled = false;
        const topCat = document.getElementById('stat-top').innerText;
        const totalVote = document.getElementById('stat-votes').innerText;
        res.innerHTML = `
            <div class="border-l-4 border-purple-500 pl-4 mb-4"><p class="font-bold text-lg text-indigo-900 mb-1">Analisis Insight Eksekutif</p><p class="text-xs text-gray-500 uppercase tracking-widest">Digenerate pada ${new Date().toLocaleTimeString('id-ID')}</p></div>
            <ul class="space-y-3">
                <li class="flex gap-3"><i class="ph-fill ph-target text-purple-500 text-xl shrink-0 mt-0.5"></i><div><strong>Titik Kritis:</strong> Fokus utama mengerucut pada masalah <strong>${escapeHTML(topCat)}</strong>, mendominasi total pengajuan.</div></li>
                <li class="flex gap-3"><i class="ph-fill ph-users-three text-blue-500 text-xl shrink-0 mt-0.5"></i><div><strong>Tingkat Partisipasi:</strong> Sangat aktif. Terjadi <strong>${totalVote} interaksi voting</strong> yang menunjukkan kepedulian tinggi.</div></li>
                <li class="flex gap-3"><i class="ph-fill ph-lightbulb text-yellow-500 text-xl shrink-0 mt-0.5"></i><div><strong>Rekomendasi:</strong> Siswa mengharapkan transparansi progres. Disarankan sekolah merilis <i>timeline</i> perbaikan terkait ${escapeHTML(topCat)} dalam 1 minggu.</div></li>
            </ul>`;
        res.classList.remove('hidden');
        res.classList.add('fade-in');
        Swal.fire({ icon: 'success', title: 'AI Summary Siap!', text: 'Ringkasan berhasil di-generate.', timer: 1500, showConfirmButton: false });
    }, 2000);
}

// ===== CSV EXPORT =====
function exportCSV() {
    if (aspirations.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data aspirasi untuk di-export.', confirmButtonColor: '#f59e0b' });
        return;
    }
    Swal.fire({
        title: 'Export CSV?',
        text: `Akan mengunduh ${aspirations.length} data aspirasi ke file CSV.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="ph-bold ph-download-simple"></i> Download',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            const headers = "ID,Kategori,Teks,Waktu,Status,Upvotes,Downvotes\n";
            const csv = aspirations.map(a => `${a.id},"${a.category}","${a.text.replace(/"/g, '""')}",${a.time},${a.status},${a.upvotes},${a.downvotes}`).join("\n");
            const blob = new Blob([headers + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.setAttribute("href", URL.createObjectURL(blob));
            link.setAttribute("download", `AspirAction_Report_${Date.now()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Swal.fire({ icon: 'success', title: 'Diunduh!', text: 'File CSV berhasil didownload.', timer: 1500, showConfirmButton: false });
        }
    });
}

// ===== VOTE NOTIFICATION SYSTEM =====
function detectNewVotes() {
    let newVotes = 0;
    aspirations.forEach(a => {
        const current = (a.upvotes || 0) + (a.downvotes || 0);
        const prev = previousVoteTotals[a.id] || 0;
        if (current > prev) newVotes += (current - prev);
    });

    if (newVotes > 0) {
        voteNotifCount += newVotes;
        updateVoteNotifBadge();
        showToast(`🗳️ ${newVotes} vote baru masuk dari siswa!`, 'info');
    }

    cacheVoteTotals();
}

function updateVoteNotifBadge() {
    const badge = document.getElementById('vote-notif-badge');
    if (!badge) return;
    if (voteNotifCount > 0) {
        badge.textContent = voteNotifCount > 99 ? '99+' : voteNotifCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function showVoteNotifPanel() {
    voteNotifCount = 0;
    updateVoteNotifBadge();

    // Show recent vote activity in a SweetAlert
    const recentVoted = aspirations
        .filter(a => (a.upvotes + a.downvotes) > 0 && a.status !== 'rejected')
        .sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes))
        .slice(0, 5);

    if (recentVoted.length === 0) {
        Swal.fire({ icon: 'info', title: 'Belum Ada Vote', text: 'Belum ada siswa yang memberikan vote.', confirmButtonColor: '#3b82f6' });
        return;
    }

    let listHtml = recentVoted.map(a => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:12px;margin-bottom:8px;text-align:left;">
            <div style="flex:1;">
                <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:2px;">${catIcons[a.category]} ${escapeHTML(a.category)}</div>
                <div style="font-size:13px;color:#1e293b;font-weight:600;">${escapeHTML(a.text.slice(0, 60))}${a.text.length > 60 ? '...' : ''}</div>
            </div>
            <div style="display:flex;gap:8px;font-weight:800;font-size:13px;">
                <span style="color:#16a34a;">👍 ${a.upvotes}</span>
                <span style="color:#dc2626;">👎 ${a.downvotes}</span>
            </div>
        </div>
    `).join('');

    Swal.fire({
        title: '🗳️ Aktivitas Vote Terbaru',
        html: `<div style="max-height:300px;overflow-y:auto;">${listHtml}</div>`,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'Tutup',
        width: 480
    });
}

// ===== CROSS-PAGE SYNC =====
onStorageSync((key) => {
    if (key === 'aspirations') {
        detectNewVotes();
        updateAdminDashboard();
    }
    if (key === 'eventMode') {
        eventMode = localStorage.getItem('eventMode') || 'normal';
        updateModeUI();
    }
    if (key === 'timerExpired') {
        timerExpired = localStorage.getItem('timerExpired') === 'true';
        updateStartButtonState();
    }
    if (key === 'debateData') {
        debateData = JSON.parse(localStorage.getItem('debateData')) || { question: '', guruList: [], siswaList: [], guruPoints: '', siswaPoints: '', activeSpeaker: { side: '', index: -1 } };
        prefillDebateFields();
    }
    if (key === 'timerMode') {
        timerMode = localStorage.getItem('timerMode') || 'openmic';
        if (eventMode === 'debat') updateDebateTimerPresetUI();
    }
    if (key === 'openMicData') {
        openMicData = JSON.parse(localStorage.getItem('openMicData')) || { label: '', bullet1: '', bullet2: '', bullet3: '' };
        prefillOpenMicFields();
    }
    if (key === 'surveyData') {
        surveyData = JSON.parse(localStorage.getItem('surveyData')) || surveyData;
        prefillSurveyFields();
    }
});

// ===== EVENT MODE =====
function setEventMode(mode) {
    if (eventMode === mode && mode !== 'normal') {
        // Clicking same active mode → revert to normal
        eventMode = 'normal';
    } else {
        eventMode = mode;
    }
    saveEventMode();
    updateModeUI();

    if (mode === 'normal') showToast('Mode Normal aktif.', 'info');
    else if (mode === 'openmic') showToast('🎙️ Open Mic Mode aktif!', 'success');
    else if (mode === 'debat') showToast('⚔️ Debate Mode aktif!', 'success');
    else if (mode === 'survey') showToast('📊 Survey Mode aktif!', 'success');
}

function updateModeUI() {
    const btnNormal = document.getElementById('mode-btn-normal');
    const btnMic = document.getElementById('mode-btn-openmic');
    const btnDebat = document.getElementById('mode-btn-debat');
    const btnSurvey = document.getElementById('mode-btn-survey');
    const micPanel = document.getElementById('openmic-panel');
    const debatPanel = document.getElementById('debat-panel');
    const surveyPanel = document.getElementById('survey-panel');
    const timerOratorGrid = document.getElementById('timer-orator-grid');

    if (!btnNormal) return;

    // Reset all buttons
    const btns = ['normal', 'openmic', 'debat', 'survey'];
    btns.forEach(id => {
        const el = document.getElementById(`mode-btn-${id}`);
        if (el) {
            el.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700', 'border-purple-400', 'bg-purple-50', 'text-purple-700', 'border-orange-400', 'bg-orange-50', 'text-orange-700', 'border-green-400', 'bg-green-50', 'text-green-700', 'border-gray-200');
            el.classList.add('border-gray-200', 'bg-white', 'text-gray-500');

            // hide all panels initially
            if (document.getElementById(`${id}-panel`)) document.getElementById(`${id}-panel`).style.display = 'none';
        }
    });

    // Hide OpenMic2 panel specifically (which is normal mode's panel)
    if (document.getElementById('openmic2-panel')) document.getElementById('openmic2-panel').style.display = 'none';

    // Hide timer-orator grid in survey, debat, and normal(openmic2) modes
    if (timerOratorGrid) {
        if (eventMode === 'survey' || eventMode === 'normal' || eventMode === 'debat') {
            timerOratorGrid.classList.add('hidden');
        } else {
            timerOratorGrid.classList.remove('hidden');
        }
    }

    // Activate current mode
    if (eventMode === 'normal') {
        const btnNormal = document.getElementById('mode-btn-normal');
        if (btnNormal) btnNormal.className = 'p-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 border-blue-500 bg-blue-50 text-blue-700';
        const om2Panel = document.getElementById('openmic2-panel');
        if (om2Panel) om2Panel.style.display = '';
    } else if (eventMode === 'openmic') {
        btnMic.className = 'p-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 border-purple-500 bg-purple-50 text-purple-700';
        if (micPanel) micPanel.style.display = '';
    } else if (eventMode === 'debat') {
        btnDebat.className = 'p-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 border-orange-500 bg-orange-50 text-orange-700';
        if (debatPanel) debatPanel.style.display = '';
        updateDebateTimerPresetUI();
        renderPanelistSlots();
    } else if (eventMode === 'survey') {
        if (btnSurvey) btnSurvey.className = 'p-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 border-green-500 bg-green-50 text-green-700';
        if (surveyPanel) surveyPanel.style.display = '';
        prefillSurveyFields();
    }
}

// ===== DEBATE DATA MIGRATION & PANELIST RENDERING =====
function migrateDebateData() {
    const empty5 = () => Array.from({ length: 5 }, () => ({ name: '', title: '' }));
    if (!Array.isArray(debateData.guruList) || debateData.guruList.length === 0) {
        const arr = empty5();
        if (debateData.guruName) { arr[0].name = debateData.guruName; }
        if (debateData.guruTitle) { arr[0].title = debateData.guruTitle; }
        debateData.guruList = arr;
    }
    while (debateData.guruList.length < 5) debateData.guruList.push({ name: '', title: '' });
    if (!Array.isArray(debateData.siswaList) || debateData.siswaList.length === 0) {
        const arr = empty5();
        if (debateData.siswaName) { arr[0].name = debateData.siswaName; }
        if (debateData.siswaTitle) { arr[0].title = debateData.siswaTitle; }
        debateData.siswaList = arr;
    }
    while (debateData.siswaList.length < 5) debateData.siswaList.push({ name: '', title: '' });
    if (!debateData.activeSpeaker) debateData.activeSpeaker = { side: '', index: -1 };
    if (typeof debateData.guruScore !== 'number') debateData.guruScore = 0;
    if (typeof debateData.siswaScore !== 'number') debateData.siswaScore = 0;
    if (!Array.isArray(debateData.history)) debateData.history = [];
}
// Run migration once on load
migrateDebateData();


function renderPanelistSlots() {
    ['guru', 'siswa'].forEach(side => {
        const container = document.getElementById(`${side}-panelist-list`);
        if (!container) return;
        const list = debateData[`${side}List`] || [];
        container.innerHTML = '';
        const activeSide = debateData.activeSpeaker?.side;
        const activeIdx = debateData.activeSpeaker?.index ?? -1;
        for (let i = 0; i < 5; i++) {
            const p = list[i] || { name: '', title: '' };
            const isSpeaking = activeSide === side && activeIdx === i;
            const colorName = side === 'guru' ? 'blue' : 'emerald';
            const speakingRing = isSpeaking ? `ring-2 ring-${colorName}-500 bg-white` : 'bg-white/70';
            const speakBtn = isSpeaking
                ? `<button onclick="setActiveSpeaker('${side}',${i})" title="Sedang berbicara" class="flex-shrink-0 w-7 h-7 rounded-full bg-${colorName}-500 text-white flex items-center justify-center text-xs animate-pulse" ><i class="ph-fill ph-microphone"></i></button>`
                : `<button onclick="setActiveSpeaker('${side}',${i})" title="Tandai berbicara" class="flex-shrink-0 w-7 h-7 rounded-full border-2 border-gray-300 text-gray-400 flex items-center justify-center text-xs hover:border-${colorName}-400 hover:text-${colorName}-400 transition"><i class="ph-fill ph-microphone"></i></button>`;
            container.innerHTML += `
                <div class="flex items-center gap-1.5 rounded-xl p-1.5 border border-gray-200 ${speakingRing} transition">
                    ${speakBtn}
                    <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                        <input type="text" value="${escapeHTML(p.name)}" placeholder="Nama ${side === 'guru' ? 'Guru' : 'Siswa'} ${i + 1}"
                            class="clay-input w-full px-2 py-1 text-xs" oninput="debateData.${side}List[${i}].name=this.value">
                        <input type="text" value="${escapeHTML(p.title)}" placeholder="${side === 'guru' ? 'Jabatan' : 'Kelas'} (opsional)"
                            class="clay-input w-full px-2 py-1 text-xs" oninput="debateData.${side}List[${i}].title=this.value">
                    </div>
                </div>`;
        }
    });
}

function setActiveSpeaker(side, index) {
    const cur = debateData.activeSpeaker || { side: '', index: -1 };
    if (cur.side === side && cur.index === index) {
        debateData.activeSpeaker = { side: '', index: -1 };
    } else {
        debateData.activeSpeaker = { side, index };
    }
    saveDebateData();
    renderPanelistSlots();
    pushDebateData(); // silent — no toast
}

// Silent push (no toast) — used by setActiveSpeaker and adjustScore
function pushDebateData() {
    if (!Array.isArray(debateData.guruList)) debateData.guruList = Array.from({ length: 5 }, () => ({ name: '', title: '' }));
    if (!Array.isArray(debateData.siswaList)) debateData.siswaList = Array.from({ length: 5 }, () => ({ name: '', title: '' }));
    debateData.question = document.getElementById('debat-question')?.value || debateData.question || '';
    debateData.guruPoints = document.getElementById('debat-guru-points')?.value || debateData.guruPoints || '';
    debateData.siswaPoints = document.getElementById('debat-siswa-points')?.value || debateData.siswaPoints || '';
    saveDebateData();
}

function updateDebateData() {
    if (!Array.isArray(debateData.guruList)) debateData.guruList = Array.from({ length: 5 }, () => ({ name: '', title: '' }));
    if (!Array.isArray(debateData.siswaList)) debateData.siswaList = Array.from({ length: 5 }, () => ({ name: '', title: '' }));
    debateData.question = document.getElementById('debat-question')?.value || '';
    debateData.guruPoints = document.getElementById('debat-guru-points')?.value || '';
    debateData.siswaPoints = document.getElementById('debat-siswa-points')?.value || '';
    // Save to history (keep last 5, no duplicates)
    const q = debateData.question.trim();
    if (q && !debateData.history?.includes(q)) {
        debateData.history = [q, ...(debateData.history || [])].slice(0, 5);
    }
    saveDebateData();
    renderQuestionHistory();
    Swal.fire({ icon: 'success', title: 'Diperbarui!', text: 'Data debat dikirim ke proyektor.', timer: 1500, showConfirmButton: false });
}

// Score controls
function adjustScore(side, delta) {
    migrateDebateData();
    if (side === 'guru') debateData.guruScore = Math.max(0, (debateData.guruScore || 0) + delta);
    if (side === 'siswa') debateData.siswaScore = Math.max(0, (debateData.siswaScore || 0) + delta);
    renderDebateScores();
    pushDebateData();
}

function renderDebateScores() {
    const gs = document.getElementById('admin-guru-score');
    const ss = document.getElementById('admin-siswa-score');
    if (gs) gs.textContent = debateData.guruScore ?? 0;
    if (ss) ss.textContent = debateData.siswaScore ?? 0;
}

function renderQuestionHistory() {
    const container = document.getElementById('debat-question-history');
    if (!container) return;
    const history = debateData.history || [];
    if (!history.length) { container.innerHTML = ''; return; }
    container.innerHTML = '<p class="text-[10px] text-orange-600 font-bold w-full mb-0.5">Riwayat:</p>' +
        history.map((q, i) => `<button onclick="loadQuestion(${i})" title="${escapeHTML(q)}"
            class="text-[10px] bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200 rounded-lg px-2 py-1 truncate max-w-[160px] transition">${escapeHTML(q.length > 30 ? q.slice(0, 30) + '…' : q)}</button>`).join('');
}

function loadQuestion(idx) {
    const q = (debateData.history || [])[idx];
    if (!q) return;
    const el = document.getElementById('debat-question');
    if (el) el.value = q;
}

// ===== DEBATE SPLIT TIMER PRESETS =====
const DEBATE_PRESET_DURATIONS = {
    'debat-guru': 120, // 2 minutes
    'debat-siswa': 120, // 2 minutes
    'debat-respon': 60  // 1 minute
};

function setDebateTimerPreset(mode) {
    timerMode = mode;
    saveTimerMode();
    timerDuration = DEBATE_PRESET_DURATIONS[mode] || 120;
    resetTimer();
    updateDebateTimerPresetUI();
    // Auto-highlight matching side on projector
    if (mode === 'debat-guru') {
        debateData.activeSpeaker = debateData.activeSpeaker?.side === 'guru'
            ? debateData.activeSpeaker
            : { side: 'guru', index: debateData.activeSpeaker?.index ?? 0 };
        pushDebateData();
        renderPanelistSlots();
    } else if (mode === 'debat-siswa') {
        debateData.activeSpeaker = debateData.activeSpeaker?.side === 'siswa'
            ? debateData.activeSpeaker
            : { side: 'siswa', index: debateData.activeSpeaker?.index ?? 0 };
        pushDebateData();
        renderPanelistSlots();
    }
    const labels = {
        'debat-guru': '🎓 Timer Guru (2 mnt)',
        'debat-siswa': '🧑‍🎓 Timer Siswa (2 mnt)',
        'debat-respon': '💬 Respon / Klarifikasi (1 mnt)'
    };
    showToast(`${labels[mode]} aktif — reset & siap.`, 'info');
}

function updateDebateTimerPresetUI() {
    const btns = {
        'debat-guru': document.getElementById('debat-timer-btn-guru'),
        'debat-siswa': document.getElementById('debat-timer-btn-siswa'),
        'debat-respon': document.getElementById('debat-timer-btn-respon')
    };
    const activeColors = {
        'debat-guru': 'border-blue-500 bg-blue-50 text-blue-700',
        'debat-siswa': 'border-emerald-500 bg-emerald-50 text-emerald-700',
        'debat-respon': 'border-purple-500 bg-purple-50 text-purple-700'
    };
    const resetClass = 'p-3 rounded-xl border-2 font-bold text-xs transition-all flex flex-col items-center gap-1.5 border-gray-200 bg-white text-gray-500';
    Object.entries(btns).forEach(([mode, btn]) => {
        if (!btn) return;
        if (timerMode === mode) {
            btn.className = `${resetClass} ${activeColors[mode]}`;
        } else {
            btn.className = `${resetClass} hover:border-gray-400`;
        }
    });
}

function prefillDebateFields() {
    migrateDebateData();
    const q = document.getElementById('debat-question');
    const gp = document.getElementById('debat-guru-points');
    const sp = document.getElementById('debat-siswa-points');
    if (q) q.value = debateData.question || '';
    if (gp) gp.value = debateData.guruPoints || '';
    if (sp) sp.value = debateData.siswaPoints || '';
    renderPanelistSlots();
    renderDebateScores();
    renderQuestionHistory();
}

function updateOpenMicData() {
    openMicData.label = document.getElementById('openmic-label').value || '';
    openMicData.bullet1 = document.getElementById('openmic-bullet1').value || '';
    openMicData.bullet2 = document.getElementById('openmic-bullet2').value || '';
    openMicData.bullet3 = document.getElementById('openmic-bullet3').value || '';
    saveOpenMicData();

    Swal.fire({
        icon: 'success',
        title: 'Diperbarui!',
        text: 'Poin utama berhasil dikirim ke layar proyektor.',
        timer: 1500,
        showConfirmButton: false
    });
}

function prefillOpenMicFields() {
    const lb = document.getElementById('openmic-label');
    const b1 = document.getElementById('openmic-bullet1');
    const b2 = document.getElementById('openmic-bullet2');
    const b3 = document.getElementById('openmic-bullet3');
    if (lb) lb.value = openMicData.label || '';
    if (b1) b1.value = openMicData.bullet1 || '';
    if (b2) b2.value = openMicData.bullet2 || '';
    if (b3) b3.value = openMicData.bullet3 || '';
}

// ===== SURVEY DATA =====
function updateSurveyData() {
    surveyData.title = document.getElementById('survey-title')?.value || '';
    surveyData.respondents = parseInt(document.getElementById('survey-respondents')?.value) || 0;
    surveyData.keyFinding = document.getElementById('survey-key-finding')?.value || '';
    surveyData.issues = [];
    for (let i = 0; i < 5; i++) {
        const label = document.getElementById(`survey-issue-label-${i}`)?.value || '';
        const value = parseFloat(document.getElementById(`survey-issue-val-${i}`)?.value) || 0;
        surveyData.issues.push({ label, value });
    }
    saveSurveyData();
    Swal.fire({
        icon: 'success',
        title: 'Diperbarui!',
        text: 'Data survey dikirim ke layar proyektor.',
        timer: 1500,
        showConfirmButton: false
    });
}

function prefillSurveyFields() {
    const titleEl = document.getElementById('survey-title');
    const respEl = document.getElementById('survey-respondents');
    const kfEl = document.getElementById('survey-key-finding');
    if (titleEl) titleEl.value = surveyData.title || '';
    if (respEl) respEl.value = surveyData.respondents || '';
    if (kfEl) kfEl.value = surveyData.keyFinding || '';
    for (let i = 0; i < 5; i++) {
        const issue = (surveyData.issues || [])[i] || { label: '', value: 0 };
        const lEl = document.getElementById(`survey-issue-label-${i}`);
        const vEl = document.getElementById(`survey-issue-val-${i}`);
        if (lEl) lEl.value = issue.label || '';
        if (vEl) vEl.value = issue.value || '';
    }
    // Update all preview bars after prefill
    for (let i = 0; i < 5; i++) updateSurveyPreviewBar(i);
}

// Live mini bar preview in admin panel
function updateSurveyPreviewBar(index) {
    const vals = [];
    for (let i = 0; i < 5; i++) {
        vals.push(parseFloat(document.getElementById(`survey-issue-val-${i}`)?.value) || 0);
    }
    const maxVal = Math.max(...vals, 1);
    const bar = document.getElementById(`survey-preview-bar-${index}`);
    if (bar) {
        const pct = Math.round((vals[index] / maxVal) * 100);
        bar.style.width = pct + '%';
    }
}

// Backward compat wrapper
function updateOpenMicUI() { updateModeUI(); }

// ===== OPEN MIC 2 LOGIC =====
function prefillOpenMic2Fields() {
    if (!openMic2Data) return;
    for (let i = 0; i < 5; i++) {
        const labelEl = document.getElementById(`om2-label-${i}`);
        const setujuEl = document.getElementById(`om2-setuju-${i}`);
        const tidakEl = document.getElementById(`om2-tidak-${i}`);
        const rowEl = document.getElementById(`om2-row-${i}`);
        const btnTayang = document.getElementById(`om2-btn-tayang-${i}`);

        if (labelEl) labelEl.value = openMic2Data.issues[i].label || '';
        if (setujuEl) setujuEl.innerHTML = `<i class="ph-fill ph-thumbs-up"></i> ${openMic2Data.issues[i].setuju || 0}`;
        if (tidakEl) tidakEl.innerHTML = `<i class="ph-fill ph-thumbs-down"></i> ${openMic2Data.issues[i].tidakSetuju || 0}`;

        // Highlight active issue
        if (openMic2Data.activeIndex === i) {
            if (rowEl) {
                rowEl.classList.add('border-blue-500', 'ring-2', 'ring-blue-300', 'bg-blue-100');
                rowEl.classList.remove('border-blue-200', 'bg-blue-50');
            }
            if (btnTayang) {
                btnTayang.innerHTML = `<i class="ph-fill ph-check-circle"></i> Sedang Tayang`;
                btnTayang.classList.replace('text-blue-600', 'text-white');
                btnTayang.classList.replace('bg-white', 'bg-blue-600');
            }
        } else {
            if (rowEl) {
                rowEl.classList.remove('border-blue-500', 'ring-2', 'ring-blue-300', 'bg-blue-100');
                rowEl.classList.add('border-blue-200', 'bg-blue-50');
            }
            if (btnTayang) {
                btnTayang.innerHTML = `<i class="ph-fill ph-projector-screen"></i> Tayangkan`;
                btnTayang.classList.replace('text-white', 'text-blue-600');
                btnTayang.classList.replace('bg-blue-600', 'bg-white');
            }
        }
    }
}

function updateOpenMic2Issues() {
    for (let i = 0; i < 5; i++) {
        const el = document.getElementById(`om2-label-${i}`);
        if (el) openMic2Data.issues[i].label = el.value;
    }
    saveOpenMic2Data();
    showToast('Label isu tersimpan!', 'success');
}

function tayangkanOpenMic2(index) {
    // 1. Save any label inputs just in case
    for (let i = 0; i < 5; i++) {
        const el = document.getElementById(`om2-label-${i}`);
        if (el) openMic2Data.issues[i].label = el.value;
    }

    // 2. Set active
    openMic2Data.activeIndex = index;
    saveOpenMic2Data();

    prefillOpenMic2Fields();
    showToast(`Isu #${index + 1} tayang di proyektor!`, 'success');

    // Force trigger cross-tab storage event
    localStorage.setItem('om2UpdateTick', Date.now().toString());
}

function resetOpenMic2IssueVotes(index) {
    Swal.fire({
        title: 'Reset Voting?',
        text: `Anda yakin ingin me-reset perolehan suara untuk Isu #${index + 1}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Reset',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            openMic2Data.issues[index].setuju = 0;
            openMic2Data.issues[index].tidakSetuju = 0;
            saveOpenMic2Data();
            prefillOpenMic2Fields();
            showToast(`Voting Isu #${index + 1} direset.`, 'success');
        }
    });
}

// ===== PROJECTOR VIEW TOGGLE (synced via Firebase → projector listens) =====
function toggleProjView(mode) {
    if (mode === 'openmic') {
        const cur = localStorage.getItem('projectorRightView') || 'openmic';
        const next = cur === 'openmic' ? 'aspirasi' : 'openmic';
        localStorage.setItem('projectorRightView', next);
        fbSet('projectorRightView', next);
    } else if (mode === 'debate') {
        const cur = localStorage.getItem('debateProjectorView') || 'debate';
        const next = cur === 'debate' ? 'aspirasi' : 'debate';
        localStorage.setItem('debateProjectorView', next);
        fbSet('debateProjectorView', next);
    }
    syncProjViewUI();
}

function syncProjViewUI() {
    // Open Mic toggle
    const omView = localStorage.getItem('projectorRightView') || 'openmic';
    const omLabel = document.getElementById('admin-openmic-proj-label');
    const omBtnLabel = document.getElementById('admin-openmic-proj-btn-label');
    if (omLabel) omLabel.textContent = omView === 'openmic' ? 'Open Mic' : 'Live Aspirasi';
    if (omBtnLabel) omBtnLabel.textContent = omView === 'openmic' ? 'Live Aspirasi' : '← Open Mic';

    // Debate toggle
    const dbView = localStorage.getItem('debateProjectorView') || 'debate';
    const dbLabel = document.getElementById('admin-debate-proj-label');
    const dbBtnLabel = document.getElementById('admin-debate-proj-btn-label');
    if (dbLabel) dbLabel.textContent = dbView === 'debate' ? 'Debate' : 'Live Aspirasi';
    if (dbBtnLabel) dbBtnLabel.textContent = dbView === 'debate' ? 'Live Aspirasi' : '← Debate';
}

// ===== INIT =====
const shownAsp = aspirations.find(a => a.status === 'shown');
if (shownAsp) activeLiveAspirationId = shownAsp.id;

// Auto-login if admin was previously logged in
if (localStorage.getItem('adminLoggedIn') === 'true') {
    showAdminDashboard();
    updateModeUI();
    prefillDebateFields();
    prefillOpenMicFields();
    prefillSurveyFields();
    prefillOpenMic2Fields();
    syncProjViewUI();
}

