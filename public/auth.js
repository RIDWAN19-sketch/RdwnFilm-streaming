/* ================= AUTHENTICATION (FIREBASE) ================= */
let authMode = 'login';
let phoneConfirmation = null;
let phoneRecaptcha = null;
let authReady = false;

const authEls = {
    screen: document.getElementById('auth-screen'),
    shell: document.getElementById('site-shell'),
    message: document.getElementById('auth-message'),
    form: document.getElementById('email-auth-form'),
    identifier: document.getElementById('auth-identifier'),
    password: document.getElementById('auth-password'),
    signupEmail: document.getElementById('signup-email'),
    signupUsername: document.getElementById('signup-username'),
    signupEmailWrap: document.getElementById('signup-email-wrap'),
    signupUsernameWrap: document.getElementById('signup-username-wrap'),
    submit: document.getElementById('email-auth-submit'),
    toggle: document.getElementById('auth-mode-toggle'),
    switchText: document.getElementById('auth-switch-text')
};

function authNotice(message, isError = true) {
    authEls.message.textContent = message;
    authEls.message.classList.toggle('success', !isError);
}

function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === 'register';
    document.getElementById('auth-title').textContent = registering ? 'Buat akun RdwnFilm' : 'Masuk untuk melanjutkan';
    authEls.submit.textContent = registering ? 'Daftar' : 'Masuk';
    authEls.switchText.textContent = registering ? 'Sudah punya akun?' : 'Belum punya akun?';
    authEls.toggle.textContent = registering ? 'Masuk' : 'Daftar sekarang';
    authEls.signupEmailWrap.hidden = !registering;
    authEls.signupUsernameWrap.hidden = !registering;
    authEls.identifier.hidden = registering; 
    authEls.identifier.placeholder = registering ? 'Email untuk akun Anda' : 'Email atau username';
    authEls.identifier.autocomplete = registering ? 'email' : 'username';
    authEls.identifier.required = !registering;
    authEls.signupEmail.required = registering;
    authEls.signupUsername.required = registering;
    authEls.password.autocomplete = registering ? 'new-password' : 'current-password';
    authNotice('');
}

function showAuthenticated(user) {
    window.rdwnCurrentUser = user;
    authEls.screen.hidden = true;
    authEls.shell.hidden = false;
    authReady = true;
    addAccountControls(user);
    updateMyListBadge();
    handleRouting();
}

function showUnauthenticated() {
    window.rdwnCurrentUser = null;
    authEls.shell.hidden = true;
    authEls.screen.hidden = false;
    authReady = true;
    authNotice('Silakan masuk atau daftar untuk mengakses RdwnFilm.', false);
}

function addAccountControls(user) {
    const nav = document.querySelector('.nav-right');
    if (!nav) return;
    document.getElementById('account-controls')?.remove();

    const wrap = document.createElement('div');
    wrap.id = 'account-controls';
    wrap.className = 'account-menu-wrap';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'account-avatar-button';
    trigger.setAttribute('aria-label', 'Buka menu profil');
    const avatar = document.createElement('img');
    avatar.className = 'account-avatar';
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    const initials = document.createElement('span');
    initials.className = 'account-avatar-initials';
    initials.textContent = (user.displayName || user.email || 'R').trim().charAt(0).toUpperCase();
    if (user.photoURL) {
        avatar.src = user.photoURL;
        avatar.hidden = false;
        initials.hidden = true;
        avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
    } else {
        avatar.hidden = true;
    }
    trigger.append(avatar, initials, document.createTextNode(' ▾'));

    const menu = document.createElement('div');
    menu.className = 'account-dropdown';
    menu.innerHTML = '<button type="button" data-action="profile">Profil & Pengaturan</button><button type="button" data-action="history">Riwayat Tontonan</button><button type="button" data-action="continue">Lanjutkan Menonton</button><button type="button" data-action="logout">Keluar</button>';
    trigger.addEventListener('click', () => menu.classList.toggle('open'));
    menu.addEventListener('click', event => {
        const action = event.target.closest('button')?.dataset.action;
        if (!action) return;
        menu.classList.remove('open');
        if (action === 'profile') location.hash = '#profile';
        if (action === 'history') location.hash = '#history';
        if (action === 'continue') location.hash = '#continue';
        if (action === 'logout') firebase.auth().signOut();
    });
    document.addEventListener('click', event => {
        if (!wrap.contains(event.target)) menu.classList.remove('open');
    });
    wrap.append(trigger, menu);
    nav.appendChild(wrap);
}

function updateProfileAvatar(photoURL, displayName) {
    const avatar = document.querySelector('.account-avatar');
    const initials = document.querySelector('.account-avatar-initials');
    if (avatar && initials) {
        if (photoURL) {
            avatar.src = photoURL;
            avatar.hidden = false;
            initials.hidden = true;
            avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
        } else {
            avatar.hidden = true;
            initials.hidden = false;
            initials.textContent = (displayName || 'R').trim().charAt(0).toUpperCase();
        }
    }
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) {
        preview.innerHTML = '';
        if (photoURL) {
            const img = document.createElement('img');
            img.src = photoURL; img.alt = 'Foto profil'; img.onerror = () => { preview.textContent = (displayName || 'R').charAt(0).toUpperCase(); };
            preview.appendChild(img);
        } else preview.textContent = (displayName || 'R').charAt(0).toUpperCase();
    }
}

async function loadProfileSettings(user) {
    const db = window.rdwnDB;
    const ref = db.collection('userProfiles').doc(user.uid);
    const snap = await ref.get();
    const profile = snap.exists ? snap.data() : {};
    const name = profile.displayName || user.displayName || '';
    const photo = profile.photoURL || user.photoURL || '';
    document.getElementById('profile-name').value = name;
    document.getElementById('profile-photo').value = photo;
    document.getElementById('profile-account-info').textContent = user.email || user.phoneNumber || 'Akun Google';
    updateProfileAvatar(photo, name);
}

function initProfileSettings() {
    document.getElementById('save-profile')?.addEventListener('click', async () => {
        const user = window.rdwnCurrentUser;
        if (!user) return;
        const name = document.getElementById('profile-name').value.trim();
        const photo = document.getElementById('profile-photo').value.trim();
        const message = document.getElementById('profile-message');
        try {
            if (photo && !/^https:\/\/|^http:\/\//i.test(photo)) throw new Error('URL foto harus diawali http:// atau https://.');
            await user.updateProfile({ displayName: name || null, photoURL: photo || null });
            await window.rdwnDB.collection('userProfiles').doc(user.uid).set({
                displayName: name,
                photoURL: photo,
                email: user.email || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            updateProfileAvatar(photo, name);
            message.textContent = 'Profil berhasil disimpan.';
            message.classList.add('success');
        } catch (error) {
            message.textContent = error.message || 'Gagal menyimpan profil.';
            message.classList.remove('success');
        }
    });
    document.getElementById('profile-signout')?.addEventListener('click', () => firebase.auth().signOut());
}

async function initRdwnAuth() {
    try {
        // Konfigurasi Firebase khusus autentikasi RdwnFilm.
        // Firebase Web API key boleh berada di frontend; keamanan data tetap diatur melalui Firestore Rules.
        const firebaseConfig = {
            apiKey: "AIzaSyCVuBxRck0hOoqUgdHuhP77tTERZ9WD1FM",
            authDomain: "rdwnfilm.firebaseapp.com",
            projectId: "rdwnfilm",
            storageBucket: "rdwnfilm.firebasestorage.app",
            messagingSenderId: "1069414093737",
            appId: "1:1069414093737:web:de82f3d24ee4f57d78aab8"
        };
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        window.rdwnDB = db;
        initProfileSettings();
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        authEls.toggle.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));

        document.getElementById('google-signin').addEventListener('click', async () => {
            try {
                await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
            } catch (error) { authNotice(authErrorMessage(error)); }
        });

        authEls.form.addEventListener('submit', async (event) => {
            event.preventDefault();
            authEls.submit.disabled = true;
            try {
                const identifier = authEls.identifier.value.trim();
                const password = authEls.password.value;
                if (authMode === 'register') {
                    const email = authEls.signupEmail.value.trim().toLowerCase();
                    const username = authEls.signupUsername.value.trim().toLowerCase();
                    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username harus 3–20 karakter (huruf, angka, atau garis bawah).');
                    const usernameRef = db.collection('usernames').doc(username);
                    const existing = await usernameRef.get();
                    if (existing.exists) throw new Error('Username sudah digunakan.');
                    const credential = await auth.createUserWithEmailAndPassword(email, password);
                    await credential.user.updateProfile({ displayName: username });
                    await usernameRef.set({ email, uid: credential.user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    authNotice('Pendaftaran berhasil.', false);
                } else {
                    let email = identifier;
                    if (!identifier.includes('@')) {
                        const usernameDoc = await db.collection('usernames').doc(identifier.toLowerCase()).get();
                        if (!usernameDoc.exists) throw new Error('Username tidak ditemukan.');
                        email = usernameDoc.data().email;
                    }
                    await auth.signInWithEmailAndPassword(email, password);
                }
            } catch (error) { authNotice(authErrorMessage(error)); }
            finally { authEls.submit.disabled = false; }
        });

        document.getElementById('send-otp').addEventListener('click', async () => {
            try {
                const phone = document.getElementById('phone-number').value.trim();
                if (!/^\\+[1-9]\\d{7,14}$/.test(phone)) throw new Error('Gunakan format internasional, contoh +628123456789.');
                if (!phoneRecaptcha) phoneRecaptcha = new firebase.auth.RecaptchaVerifier('phone-recaptcha', { size: 'invisible' });
                phoneConfirmation = await auth.signInWithPhoneNumber(phone, phoneRecaptcha);
                document.getElementById('otp-wrap').hidden = false;
                authNotice('Kode OTP telah dikirim melalui SMS.', false);
            } catch (error) { authNotice(authErrorMessage(error)); }
        });

        document.getElementById('verify-otp').addEventListener('click', async () => {
            try {
                const code = document.getElementById('phone-otp').value.trim();
                if (!phoneConfirmation || !code) throw new Error('Masukkan kode OTP terlebih dahulu.');
                await phoneConfirmation.confirm(code);
            } catch (error) { authNotice(authErrorMessage(error)); }
        });

        auth.onAuthStateChanged(user => {
            if (user) {
                showAuthenticated(user);
                loadProfileSettings(user).catch(() => {});
                window.dispatchEvent(new CustomEvent('rdwn-auth-ready', { detail: { user } }));
            }
            else {
                document.getElementById('account-controls')?.remove();
                showUnauthenticated();
            }
        });
    } catch (error) {
        authNotice('Tidak dapat menghubungkan layanan login. Periksa konfigurasi Firebase dan koneksi internet.');
    }
}

function authErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Email sudah terdaftar.',
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/weak-password': 'Kata sandi minimal 6 karakter.',
        'auth/user-not-found': 'Akun tidak ditemukan.',
        'auth/wrong-password': 'Kata sandi salah.',
        'auth/invalid-credential': 'Email/username atau kata sandi salah.',
        'auth/popup-closed-by-user': 'Jendela Google ditutup sebelum selesai.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
        'auth/operation-not-allowed': 'Metode login ini belum diaktifkan di Firebase.',
        'auth/invalid-phone-number': 'Nomor telepon tidak valid.',
        'auth/quota-exceeded': 'Kuota SMS Firebase telah tercapai.'
    };
    return messages[error.code] || error.message || 'Terjadi kesalahan autentikasi.';
}

document.addEventListener('DOMContentLoaded', initRdwnAuth);
