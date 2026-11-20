const express = require('express');
const path = require('path');
const cors = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Security Headers
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});


// TMDB API Config
const TMDB_KEY  = '4f599baa15d072c9de346b2816a131b8'; // TMDB key bawaan website
const TMDB_BASE = 'https://api.tmdb.org/3';

async function fetchTMDB(endpoint, query = {}) {
  try {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: 'id-ID',
      ...query
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${TMDB_BASE}${endpoint}?${params}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`[TMDB Error] ${endpoint}:`, error.message);
    throw error;
  }
}

// Routes API
app.get('/api/movies/home', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const [trending, pop, now, top, up, idMovies, krMovies] = await Promise.all([
      fetchTMDB('/trending/movie/week', { page }),
      fetchTMDB('/movie/popular', { page }),
      fetchTMDB('/movie/now_playing', { page }),
      fetchTMDB('/movie/top_rated', { page }),
      fetchTMDB('/movie/upcoming', { page }),
      fetchTMDB('/discover/movie', { with_origin_country: 'ID', sort_by: 'popularity.desc', page }),
      fetchTMDB('/discover/movie', { with_origin_country: 'KR', sort_by: 'popularity.desc', page })
    ]);
    
    const filterPoster = (arr) => (arr?.results || []).filter(m => m.poster_path);

    res.json({
      featured: filterPoster(trending).filter(m => m.backdrop_path).slice(0, 5),
      rows: {
        trending: filterPoster(trending),
        popular: filterPoster(pop),
        nowPlaying: filterPoster(now),
        topRated: filterPoster(top),
        upcoming: filterPoster(up),
        indonesia: filterPoster(idMovies),
        korea: filterPoster(krMovies)
      }
    });
  } catch (e) { 
    res.status(500).json({ error: 'Gagal memuat film home' }); 
  }
});

app.get('/api/movies/popular', async (req, res) => {
  try {
    const data = await fetchTMDB('/movie/popular', { page: req.query.page || 1 });
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal memuat film populer' }); }
});

app.get('/api/movies/now-playing', async (req, res) => {
  try {
    const data = await fetchTMDB('/movie/now_playing', { page: req.query.page || 1 });
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal memuat film sedang tayang' }); }
});

app.get('/api/movies/top-rated', async (req, res) => {
  try {
    const data = await fetchTMDB('/movie/top_rated', { page: req.query.page || 1 });
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal memuat film top rated' }); }
});

app.get('/api/movies/upcoming', async (req, res) => {
  try {
    const data = await fetchTMDB('/movie/upcoming', { page: req.query.page || 1 });
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal memuat film segera tayang' }); }
});

app.get('/api/movies/search', async (req, res) => {
  try {
    const data = await fetchTMDB('/search/movie', { 
      query: req.query.q, 
      page: req.query.page || 1,
      include_adult: false
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal mencari film' }); }
});

app.get('/api/movies/discover', async (req, res) => {
  try {
    const data = await fetchTMDB('/discover/movie', { 
      with_genres: req.query.genre, 
      page: req.query.page || 1,
      sort_by: 'popularity.desc'
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal filter genre' }); }
});

// Filter Film Berdasarkan Negara (1 Kategori Negara)
app.get('/api/movies/country/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const data = await fetchTMDB('/discover/movie', {
      with_origin_country: code.toUpperCase(),
      page: req.query.page || 1,
      sort_by: 'popularity.desc'
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Gagal memuat film berdasarkan negara' });
  }
});

app.get('/api/movies/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [detail, recommendations] = await Promise.all([
      fetchTMDB(`/movie/${id}`),
      fetchTMDB(`/movie/${id}/recommendations`)
    ]);
    res.json({
      ...detail,
      recommendations: (recommendations.results || []).filter(m => m.poster_path).slice(0, 12)
    });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat detail film' }); }
});

app.get('/api/movies/credits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchTMDB(`/movie/${id}/credits`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'Gagal memuat data pemeran' }); }
});

app.get('/api/movies/play/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    id: id,
    sources: [
      { label: 'Server 1 (VidLink Pro)', url: `https://vidlink.pro/movie/${id}` },
      { label: 'Server 2 (MultiEmbed)',  url: `https://multiembed.mov/?video_id=${id}&tmdb=1` },
      { label: 'Server 3 (EmbedWave)',   url: `https://embedwave.cc/embed/movie/${id}` },
      { label: 'Server 4 (VidCore)',     url: `https://www.vidcore.org/embed/movie/${id}` },
      { label: 'Server 5 (Videasy)',     url: `https://player.videasy.net/movie/${id}` },
      { label: 'Server 6 (Vidsrc CC)',   url: `https://vidsrc.cc/v2/embed/movie/${id}` },
      { label: 'Server 7 (Vidsrc Pro)',  url: `https://vidsrc.pro/embed/movie/${id}` },
      { label: 'Server 8 (Embed.su)',    url: `https://embed.su/embed/movie/${id}` }
    ]
  });
});

// Static Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Catch-All Routing Single Page App
app.get(/^\/(?!api|docs).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[RdwnFilm] Berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
