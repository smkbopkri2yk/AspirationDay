// ============================================================
// FIREBASE CONFIGURATION — PASTE YOUR CONFIG VALUES BELOW
// ============================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or use existing)
// 3. Enable Realtime Database (Build → Realtime Database → Create Database)
// 4. Set rules to: { "rules": { ".read": true, ".write": true } } for testing
// 5. Go to Project Settings → General → Your Apps → Web App → Copy config
// 6. Paste config values below:

const firebaseConfig = {
    apiKey: "AIzaSyA6Zwhf3hGEZn4lvSdbfhPo8jJqPvk0quY",
    authDomain: "aspiractionday-9ef51.firebaseapp.com",
    databaseURL: "https://aspiractionday-9ef51-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "aspiractionday-9ef51",
    storageBucket: "aspiractionday-9ef51.firebasestorage.app",
    messagingSenderId: "912136160142",
    appId: "1:912136160142:web:94db7944dd6b1f27231adf",
    measurementId: "G-PRP76W5P6V"
};

// ============================================================
// FIREBASE INITIALIZATION — DO NOT MODIFY BELOW
// ============================================================
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== FIREBASE HELPER FUNCTIONS =====

/**
 * Write data to a Firebase path
 * @param {string} path - e.g. 'aspirations' or 'currentSpeaker'
 * @param {*} data - data to write
 */
function fbSet(path, data) {
    return db.ref(path).set(data);
}

/**
 * Update specific fields at a Firebase path (merge, not overwrite)
 * @param {string} path
 * @param {object} data
 */
function fbUpdate(path, data) {
    return db.ref(path).update(data);
}

/**
 * Read data once from a Firebase path
 * @param {string} path
 * @returns {Promise<*>}
 */
async function fbGet(path) {
    const snap = await db.ref(path).once('value');
    return snap.val();
}

/**
 * Listen for realtime changes at a Firebase path
 * @param {string} path
 * @param {function} callback - receives the data value
 * @returns {function} unsubscribe function
 */
function fbListen(path, callback) {
    const ref = db.ref(path);
    const handler = ref.on('value', (snap) => {
        callback(snap.val());
    });
    return () => ref.off('value', handler);
}

/**
 * Push a new child with auto-generated key
 * @param {string} path
 * @param {*} data
 * @returns {Promise<string>} the generated key
 */
async function fbPush(path, data) {
    const ref = await db.ref(path).push(data);
    return ref.key;
}

/**
 * Remove data at a path
 * @param {string} path
 */
function fbRemove(path) {
    return db.ref(path).remove();
}
