const API_BASE = '';
let currentSources = [];
let currentSourceIndex = 0;

const COUNTRIES = {
    ID: '🇮🇩 Indonesia',
    KR: '🇰🇷 Korea Selatan',
    JP: '🇯🇵 Jepang',
    US: '🇺🇸 Amerika Serikat',
    TH: '🇹🇭 Thailand',
    IN: '🇮🇳 India',
    GB: '🇬🇧 Inggris',
    FR: '🇫🇷 Prancis',
    CN: '🇨🇳 Tiongkok',
    HK: '🇭🇰 Hong Kong'
};

const views = {
    netflixHome: document.getElementById('netflix-home-view'),
    grid: document.getElementById('grid-view'),
    detail: document.getElementById('detail-view'),
    player: document.getElementById('player-view'),
    profile: document.getElementById('profile-view')
};

const navbar = document.getElementById('navbar');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const genreSelect = document.getElementById('genre-select');
const countrySelect = document.getElementById('country-select');
const movieGrid = document.getElementById('movie-grid');
const sectionTitle = document.getElementById('section-title');
const countryPills = document.getElementById('country-pills');
const navLinks = document.querySelectorAll('.nav-links a');
const mylistBadge = document.getElementById('mylist-badge');

document.addEventListener('DOMContentLoaded', () => {
    updateMyListBadge();
    initEventListeners();
    handleRouting();
});

function initEventListeners() {
    // Navbar transparent to solid on scroll
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
            navbar.classList.toggle('scrolled', window.scrollY > 40);
            scrollTicking = false;
        });
    }, { passive: true });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.dataset.category;
            const route = link.dataset.route;

            setActiveNav(link);
            countrySelect.value = '';
            genreSelect.value = '';

            if (category) {
                window.location.hash = `#category/${category}`;
            } else if (route === 'mylist') {
                window.location.hash = '#mylist';
            } else {
                window.location.hash = '';
            }
        });
    });

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // 1 Kategori Negara Transparan
    countrySelect.addEventListener('change', (e) => {
        const code = e.target.value;
        genreSelect.value = '';
        setActiveNav(null);
        if (code) {
            window.location.hash = `#country/${code}`;
        } else {
            window.location.hash = '';
        }
    });

    genreSelect.addEventListener('change', (e) => {
        const genreId = e.target.value;
        countrySelect.value = '';
        setActiveNav(null);
        if (genreId) {
            window.location.hash = `#genre/${genreId}`;
        } else {
            window.location.hash = '';
        }
    });

    window.addEventListener('hashchange', handleRouting);
}

function setActiveNav(activeLink) {
    navLinks.forEach(l => l.classList.remove('active'));
    if (activeLink) activeLink.classList.add('active');
}

async function handleRouting() {
    if (!window.rdwnCurrentUser) return;
    const hash = window.location.hash;
    countryPills.style.display = 'none';

    if (hash.startsWith('#movie/')) {
        const id = hash.replace('#movie/', '');
        showView('detail');
        loadMovieDetail(id);
    } else if (hash.startsWith('#play/')) {
        const id = hash.replace('#play/', '');
        showView('player');
        loadPlayer(id);
    } else if (hash.startsWith('#category/')) {
        const cat = hash.replace('#category/', '');
        showView('grid');
        loadCategoryMovies(cat);
    } else if (hash.startsWith('#country/')) {
        const code = hash.replace('#country/', '').toUpperCase();
        countrySelect.value = code;
        showView('grid');
        loadCountryMovies(code);
    } else if (hash.startsWith('#genre/')) {
        const genreId = hash.replace('#genre/', '');
        showView('grid');
        loadGenreMovies(genreId);
    } else if (hash.startsWith('#search/')) {
        const query = decodeURIComponent(hash.replace('#search/', ''));
        showView('grid');
        loadSearchResults(query);
    } else if (hash === '#mylist') {
        showView('grid');
        loadMyList();
    } else if (hash === '#history') {
        showView('grid');
        loadWatchHistory();
    } else if (hash === '#continue') {
        showView('grid');
        loadContinueWatching();
    } else if (hash === '#profile') {
        showView('profile');
        if (window.rdwnCurrentUser && typeof loadProfileSettings === 'function') loadProfileSettings(window.rdwnCurrentUser).catch(() => {});
    } else {
        setActiveNav(document.querySelector('.nav-links a[data-route="home"]'));
        showView('netflixHome');
        loadNetflixHome();
    }
}

function showView(viewName) {
    if (viewName !== 'player' && views.player) {
        const iframe = views.player.querySelector('iframe');
        if (iframe) iframe.src = '';
    }

    Object.keys(views).forEach(key => {
        if (views[key]) {
            const active = key === viewName;
            views[key].style.display = active ? 'block' : 'none';
            views[key].classList.toggle('view-enter', active);
        }
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ================= STORAGE: DAFTAR SAYA & LANJUTKAN MENONTON ================= */
function userStorageKey(key) {
    const uid = window.rdwnCurrentUser?.uid || 'guest';
    return `${key}_${uid}`;
}

function getStoredList(key) {
    try {
        return JSON.parse(localStorage.getItem(userStorageKey(key))) || [];
    } catch {
        return [];
    }
}

function saveStoredList(key, list) {
    localStorage.setItem(userStorageKey(key), JSON.stringify(list));
    const user = window.rdwnCurrentUser;
    const db = window.rdwnDB;
    if (user && db) {
        db.collection('userLibraries').doc(user.uid).set({
            [key]: list,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(err => console.warn('Sinkronisasi akun gagal:', err));
    }
}

async function syncUserLibrary() {
    const user = window.rdwnCurrentUser;
    const db = window.rdwnDB;
    if (!user || !db) return;
    try {
        const libraryRef = db.collection('userLibraries').doc(user.uid);
        const snap = await libraryRef.get();
        if (!snap.exists) {
            const localData = {};
            ['rdwn_mylist', 'rdwn_continue', 'rdwn_history'].forEach(key => {
                localData[key] = getStoredList(key);
            });
            if (Object.values(localData).some(list => list.length)) {
                await libraryRef.set({
                    ...localData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            return;
        }
        const data = snap.data();
        ['rdwn_mylist', 'rdwn_continue', 'rdwn_history'].forEach(key => {
            if (Array.isArray(data[key])) {
                localStorage.setItem(`${key}_${user.uid}`, JSON.stringify(data[key]));
            }
        });
        updateMyListBadge();
        if (location.hash === '#mylist') loadMyList();
        if (location.hash === '#history') loadWatchHistory();
    } catch (err) {
        console.warn('Tidak dapat memuat data akun:', err);
    }
}
window.addEventListener('rdwn-auth-ready', syncUserLibrary);

function isInMyList(id) {
    return getStoredList('rdwn_mylist').some(m => String(m.id) === String(id));
}

function toggleMyList(movieObj, event) {
    if (event) event.stopPropagation();
    let list = getStoredList('rdwn_mylist');
    const exists = list.some(m => String(m.id) === String(movieObj.id));

    if (exists) {
        list = list.filter(m => String(m.id) !== String(movieObj.id));
        showToast(`Dihapus dari Daftar Saya: ${movieObj.title}`);
    } else {
        list.unshift({
            id: movieObj.id,
            title: movieObj.title,
            poster_path: movieObj.poster_path,
            vote_average: movieObj.vote_average,
            release_date: movieObj.release_date
        });
        showToast(`Ditambahkan ke Daftar Saya: ${movieObj.title}`);
    }

    saveStoredList('rdwn_mylist', list);
    updateMyListBadge();

    // Update icon tombol jika sedang tampil
    document.querySelectorAll(`.card-mylist-btn[data-id="${movieObj.id}"]`).forEach(btn => {
        const saved = !exists;
        btn.classList.toggle('saved', saved);
        btn.textContent = saved ? '✓' : '+';
    });

    if (window.location.hash === '#mylist') {
        loadMyList();
    }
}

function addToContinueWatching(movie) {
    if (!movie || !movie.id) return;
    const item = {
        id: movie.id, title: movie.title, poster_path: movie.poster_path,
        vote_average: movie.vote_average, release_date: movie.release_date,
        lastOpenedAt: Date.now(), positionSeconds: 0
    };
    let queue = getStoredList('rdwn_continue').filter(m => String(m.id) !== String(movie.id));
    queue.unshift(item);
    saveStoredList('rdwn_continue', queue.slice(0, 15));

    let history = getStoredList('rdwn_history').filter(m => String(m.id) !== String(movie.id));
    history.unshift(item);
    saveStoredList('rdwn_history', history.slice(0, 50));
}

function loadWatchHistory() {
    sectionTitle.textContent = 'Riwayat Tontonan';
    const history = getStoredList('rdwn_history');
    if (!history.length) {
        movieGrid.innerHTML = '<div class="no-results">Belum ada riwayat tontonan.</div>';
        return;
    }
    renderMovieGrid(history);
}

function loadContinueWatching() {
    sectionTitle.textContent = 'Lanjutkan Menonton';
    const queue = getStoredList('rdwn_continue');
    if (!queue.length) {
        movieGrid.innerHTML = '<div class="no-results">Belum ada film untuk dilanjutkan.</div>';
        return;
    }
    renderMovieGrid(queue);
}

function updateMyListBadge() {
    const count = getStoredList('rdwn_mylist').length;
    if (mylistBadge) mylistBadge.textContent = count;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ================= NETFLIX HOME (HERO + HORIZONTAL ROWS) ================= */
async function loadNetflixHome() {
    const heroEl = document.getElementById('hero-billboard');
    const rowsEl = document.getElementById('netflix-rows-container');
    rowsEl.innerHTML = '<div class="loading">Menyiapkan katalog film ala Netflix...</div>';

    try {
        const res = await fetch(`${API_BASE}/api/movies/home`);
        const data = await res.json();

        const featuredList = data.featured || [];
        const heroMovie = featuredList[Math.floor(Math.random() * featuredList.length)] || data.rows.popular[0];
        renderHeroBillboard(heroEl, heroMovie);

        const continueList = getStoredList('rdwn_continue');
        const rowsConfig = [
            ...(continueList.length ? [{ title: '⏯ Lanjutkan Menonton', movies: continueList, tag: 'Riwayat Anda' }] : []),
            { title: '🔥 Sedang Tren Minggu Ini', movies: data.rows.trending, tag: 'Top 20' },
            { title: '🇮🇩 Film Pilihan Indonesia', movies: data.rows.indonesia, tag: 'Kategori Negara' },
            { title: '🇰🇷 Sinema Populer Korea Selatan', movies: data.rows.korea, tag: 'Kategori Negara' },
            { title: '🎬 Paling Populer', movies: data.rows.popular },
            { title: '🍿 Sedang Tayang di Bioskop', movies: data.rows.nowPlaying },
            { title: '⭐ Rating Tertinggi Sepanjang Masa', movies: data.rows.topRated },
            { title: '📅 Segera Tayang', movies: data.rows.upcoming }
        ];

        rowsEl.innerHTML = rowsConfig.map((row, idx) => renderHorizontalRow(row, idx)).join('');
    } catch (err) {
        rowsEl.innerHTML = '<div class="error">Gagal memuat beranda Netflix. Periksa koneksi Anda.</div>';
    }
}

function renderHeroBillboard(container, movie) {
    if (!movie) return;
    const backdrop = movie.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
        : '';
    const matchPercent = movie.vote_average ? Math.round(movie.vote_average * 10) : 88;
    const year = movie.release_date ? movie.release_date.split('-')[0] : '2026';

    container.style.backgroundImage = `url('${backdrop}')`;
    container.innerHTML = `
        <div class="hero-content">
            <span class="hero-badge">N FILM UNGGULAN</span>
            <h1 class="hero-title">${movie.title}</h1>
            <div class="hero-meta">
                <span class="match-score">${matchPercent}% Cocok</span>
                <span>${year}</span>
                <span>★ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
                <span>HD</span>
            </div>
            <p class="hero-overview">${movie.overview || 'Saksikan kisah seru dan sinematografi memukau hanya di RdwnFilm.'}</p>
            <div class="hero-actions">
                <button class="btn-netflix-play" onclick="location.hash='#play/${movie.id}'">
                    ▶ Putar
                </button>
                <button class="btn-netflix-info" onclick="location.hash='#movie/${movie.id}'">
                    ⓘ Info Selengkapnya
                </button>
            </div>
        </div>
    `;
}

function renderHorizontalRow(row, idx) {
    if (!row.movies || !row.movies.length) return '';
    const rowId = `row-track-${idx}`;
    const cards = row.movies.map(m => createMovieCardHTML(m)).join('');

    return `
        <div class="row-section">
            <div class="row-header">
                <h2 class="row-title">
                    ${row.title}
                    ${row.tag ? `<span class="tag-transparent">${row.tag}</span>` : ''}
                </h2>
            </div>
            <div class="slider-wrapper">
                <button class="slider-arrow left" onclick="scrollRow('${rowId}', -1)" aria-label="Geser Kiri">‹</button>
                <div class="row-posters" id="${rowId}">
                    ${cards}
                </div>
                <button class="slider-arrow right" onclick="scrollRow('${rowId}', 1)" aria-label="Geser Kanan">›</button>
            </div>
        </div>
    `;
}

function scrollRow(rowId, direction) {
    const track = document.getElementById(rowId);
    if (!track) return;
    const scrollAmount = track.clientWidth * 0.8;
    track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

function createMovieCardHTML(movie) {
    const poster = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const year = movie.release_date ? movie.release_date.split('-')[0] : '';
    const saved = isInMyList(movie.id);
    const safeMovieData = JSON.stringify({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average,
        release_date: movie.release_date
    }).replace(/'/g, "&apos;");

    return `
        <div class="movie-card" onclick="location.hash='#movie/${movie.id}'">
            <div class="poster-wrapper">
                <img src="${poster}" alt="${movie.title}" loading="lazy">
                <span class="rating">★ ${rating}</span>
                <button class="card-mylist-btn ${saved ? 'saved' : ''}"
                        data-id="${movie.id}"
                        title="Simpan ke Daftar Saya"
                        onclick='toggleMyList(${safeMovieData}, event)'>
                    ${saved ? '✓' : '+'}
                </button>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${movie.title}</h3>
                <span class="movie-year">${year}</span>
            </div>
        </div>
    `;
}

/* ================= GRID VIEWS (KATEGORI, NEGARA, GENRE, SEARCH, MY LIST) ================= */
async function loadCategoryMovies(category) {
    const titles = {
        'popular': 'Film Populer',
        'now-playing': 'Sedang Tayang',
        'top-rated': 'Rating Tinggi',
        'upcoming': 'Segera Tayang'
    };
    sectionTitle.textContent = titles[category] || 'Daftar Film';
    movieGrid.innerHTML = '<div class="loading">Memuat film...</div>';
    try {
        const res = await fetch(`${API_BASE}/api/movies/${category}`);
        const data = await res.json();
        renderMovieGrid(data.results);
    } catch (err) {
        movieGrid.innerHTML = '<div class="error">Gagal memuat kategori.</div>';
    }
}

async function loadCountryMovies(code) {
    const countryLabel = COUNTRIES[code] || code;
    sectionTitle.textContent = `Kategori Negara: ${countryLabel}`;
    renderCountryPills(code);
    movieGrid.innerHTML = '<div class="loading">Memuat kumpulan film dari ' + countryLabel + '...</div>';

    try {
        const res = await fetch(`${API_BASE}/api/movies/country/${code}`);
        const data = await res.json();
        renderMovieGrid(data.results);
    } catch (err) {
        movieGrid.innerHTML = '<div class="error">Gagal memuat film negara tersebut.</div>';
    }
}

function renderCountryPills(activeCode) {
    countryPills.style.display = 'flex';
    countryPills.innerHTML = Object.entries(COUNTRIES).map(([code, name]) => `
        <button class="country-pill ${code === activeCode ? 'active' : ''}"
                onclick="location.hash='#country/${code}'">
            ${name}
        </button>
    `).join('');
}

async function loadGenreMovies(genreId) {
    const genreName = genreSelect.options[genreSelect.selectedIndex]?.text || 'Genre';
    sectionTitle.textContent = `Genre: ${genreName}`;
    movieGrid.innerHTML = '<div class="loading">Memuat film...</div>';
    try {
        const res = await fetch(`${API_BASE}/api/movies/discover?genre=${genreId}`);
        const data = await res.json();
        renderMovieGrid(data.results);
    } catch (err) {
        movieGrid.innerHTML = '<div class="error">Gagal memuat genre.</div>';
    }
}

function handleSearch() {
    const query = searchInput.value.trim();
    if (query) {
        window.location.hash = `#search/${encodeURIComponent(query)}`;
    }
}

async function loadSearchResults(query) {
    sectionTitle.textContent = `Hasil Pencarian: "${query}"`;
    movieGrid.innerHTML = '<div class="loading">Mencari film...</div>';
    try {
        const res = await fetch(`${API_BASE}/api/movies/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderMovieGrid(data.results);
    } catch (err) {
        movieGrid.innerHTML = '<div class="error">Gagal mencari film.</div>';
    }
}

function loadMyList() {
    sectionTitle.textContent = 'Daftar Saya (Watchlist)';
    const savedMovies = getStoredList('rdwn_mylist');
    if (!savedMovies.length) {
        movieGrid.innerHTML = '<div class="no-results">Daftar Saya masih kosong. Klik tombol <strong>+</strong> pada poster film untuk menyimpannya.</div>';
        return;
    }
    renderMovieGrid(savedMovies);
}

function renderMovieGrid(movies) {
    if (!movies || movies.length === 0) {
        movieGrid.innerHTML = '<div class="no-results">Film tidak ditemukan.</div>';
        return;
    }
    movieGrid.innerHTML = movies.map(movie => createMovieCardHTML(movie)).join('');
}

/* ================= DETAIL FILM + REKOMENDASI ================= */
async function loadMovieDetail(id) {
    views.detail.innerHTML = '<div class="loading" style="padding-top: 8rem;">Memuat detail film...</div>';
    try {
        const [detailRes, creditsRes] = await Promise.all([
            fetch(`${API_BASE}/api/movies/detail/${id}`),
            fetch(`${API_BASE}/api/movies/credits/${id}`)
        ]);

        const movie = await detailRes.json();
        const credits = await creditsRes.json();

        const backdrop = movie.backdrop_path
            ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
            : '';
        const poster = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/500x750?text=No+Poster';

        const cast = credits.cast ? credits.cast.slice(0, 8).map(c => c.name).join(', ') : '-';
        const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : '-';
        const countries = movie.production_countries ? movie.production_countries.map(c => c.name).join(', ') : '-';
        const saved = isInMyList(movie.id);

        const safeMovieData = JSON.stringify({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date
        }).replace(/'/g, "&apos;");

        views.detail.innerHTML = `
            <div class="detail-header" style="background-image: linear-gradient(to bottom, rgba(20,20,20,0.65), #141414), url('${backdrop}')">
                <div class="detail-container">
                    <button class="back-btn" onclick="history.back()">← Kembali</button>
                    <div class="detail-content">
                        <img src="${poster}" alt="${movie.title}" class="detail-poster">
                        <div class="detail-info">
                            <h1>${movie.title}</h1>
                            <div class="meta">
                                <span class="match-score">★ ${movie.vote_average?.toFixed(1) || 'N/A'}</span>
                                <span>${movie.release_date?.split('-')[0] || ''}</span>
                                <span>${movie.runtime ? movie.runtime + ' Menit' : ''}</span>
                                <span>🌍 ${countries}</span>
                            </div>
                            <p class="genres"><strong>Genre:</strong> ${genres}</p>
                            <p class="overview">${movie.overview || 'Deskripsi tidak tersedia.'}</p>
                            <p class="cast"><strong>Pemeran:</strong> ${cast}</p>

                            <div class="detail-actions">
                                <button class="play-btn" onclick="location.hash='#play/${movie.id}'">
                                    ▶ Tonton Sekarang
                                </button>
                                <button class="btn-netflix-info" onclick='toggleMyList(${safeMovieData})'>
                                    ${saved ? '✓ Tersimpan di Daftar Saya' : '+ Tambah ke Daftar Saya'}
                                </button>
                            </div>

                        </div>
                    </div>

                    ${movie.recommendations && movie.recommendations.length ? `
                        <div style="margin-top: 3rem;">
                            <h3 style="margin-bottom: 1.2rem; font-size: 1.35rem;">Film Serupa Lainnya</h3>
                            <div class="movie-grid">
                                ${movie.recommendations.map(rec => createMovieCardHTML(rec)).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        views.detail.innerHTML = '<div class="error" style="padding-top: 8rem;">Gagal memuat detail film.</div>';
    }
}

/* ================= PLAYER VIDEO ================= */
async function loadPlayer(id) {
    views.player.innerHTML = '<div class="loading">Memuat pemutar video...</div>';
    try {
        const [playRes, detailRes] = await Promise.all([
            fetch(`${API_BASE}/api/movies/play/${id}`),
            fetch(`${API_BASE}/api/movies/detail/${id}`)
        ]);

        const playData = await playRes.json();
        const movie = await detailRes.json();

        addToContinueWatching(movie);

        currentSources = playData.sources || [];
        currentSourceIndex = 0;

        renderPlayerUI(movie);
    } catch (err) {
        views.player.innerHTML = '<div class="error">Gagal memuat pemutar video.</div>';
    }
}

function renderPlayerUI(movie) {
    if (!currentSources.length) {
        views.player.innerHTML = '<div class="error">Server tidak tersedia.</div>';
        return;
    }

    const currentSource = currentSources[currentSourceIndex];

    const serverButtons = currentSources.map((src, idx) => `
        <button class="server-btn ${idx === currentSourceIndex ? 'active' : ''}" 
                onclick="changeServer(${idx})">
            ${src.label}
        </button>
    `).join('');

    views.player.innerHTML = `
        <div class="player-container">
            <button class="back-btn" onclick="location.hash='#movie/${movie.id}'">← Kembali ke Detail</button>
            <h2 style="margin-bottom: 0.5rem;">Sedang Memutar: ${movie.title}</h2>
            
            <div class="iframe-wrapper">
                <iframe src="${currentSource.url}" 
                        allowfullscreen 
                        frameborder="0" 
                        scrolling="no"
                        allow="autoplay; encrypted-media">
                </iframe>
            </div>

            <div class="server-selector">
                <h3>Pilih Server Streaming (Ganti jika pemutar error atau blank):</h3>
                <div class="server-list">
                    ${serverButtons}
                </div>
            </div>
        </div>
    `;
}

function changeServer(index) {
    currentSourceIndex = index;
    const iframe = document.querySelector('.iframe-wrapper iframe');
    if (iframe) {
        iframe.src = currentSources[index].url;
    }

    document.querySelectorAll('.server-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });
}


/* Autentikasi dipisahkan ke /auth.js agar app.js fokus pada fitur film. */
