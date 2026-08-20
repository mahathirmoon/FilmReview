// Frontend is served by FastAPI itself (StaticFiles), so requests are
// same-origin — no need to hardcode a host/port here.
const API_BASE = "";

/* ---------------- Homepage: poster grid ---------------- */

// Reads what login stored in localStorage and updates the navbar —
// shows "Log in / Sign up" when signed out, or a greeting + Log out when signed in.
function renderNavAuthState() {
  const navActions = document.getElementById("nav-actions");
  if (!navActions) return;

  const token = localStorage.getItem("session_token");
  const username = localStorage.getItem("username");

  if (token && username) {
    navActions.innerHTML = `
      <span style="font-size: 14px; color: #b3b3bd;">Hi, ${escapeHtml(username)}</span>
      <button class="btn" id="logout-btn">Log out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => {
      localStorage.removeItem("session_token");
      localStorage.removeItem("username");
      window.location.reload();
    });
  } else {
    navActions.innerHTML = `
      <a class="btn" href="/login">Log in</a>
      <a class="btn btn-primary" href="/login?mode=signup">Sign up</a>
    `;
  }
}

// Generated once per page load and reused across pagination requests,
// so /movies/homepage returns a consistent random order across pages.
const HOME_SEED = Math.floor(Math.random() * 1000000);

async function loadPosterSection(gridId, page = 1, limit = 20) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  try {
    // Backend route: GET /movies/homepage?seed=&page=&limit=
    // Response shape: { page, limit, results: [...], next_page }
    const res = await fetch(
      `${API_BASE}/movies/homepage?seed=${HOME_SEED}&page=${page}&limit=${limit}`
    );

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = await res.json();
    const movies = data.results;

    if (!Array.isArray(movies) || movies.length === 0) {
      grid.innerHTML = `<p class="state-msg">No movies found.</p>`;
      return;
    }

    grid.innerHTML = movies.map(renderPosterCard).join("");
  } catch (err) {
    console.error("Failed to load homepage movies:", err);
    grid.innerHTML = `<p class="state-msg">Couldn't load movies. Is the backend running?</p>`;
  }
}

function renderPosterCard(movie) {
  const title = escapeHtml(movie.title || "Untitled");
  const posterUrl = resolvePosterUrl(movie.poster_url);

  const image = posterUrl
    ? `<img src="${escapeHtml(posterUrl)}" alt="${title} poster" loading="lazy"
         onerror="this.replaceWith(Object.assign(document.createElement('div'), {
           className: 'poster-placeholder', textContent: 'No image'
         }))" />`
    : `<div class="poster-placeholder">No image</div>`;

  return `
    <a class="poster-card" href="/static/movie.html?id=${movie.film_id}" data-movie-id="${movie.film_id}">
      ${image}
      <div class="poster-title">${title}</div>
    </a>
  `;
}

// TMDB stores only the image filename (e.g. "abc123.jpg") in the database,
// not a full URL — build the real image URL here.
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function resolvePosterUrl(posterUrl) {
  if (!posterUrl) return null;
  if (posterUrl.startsWith("http://") || posterUrl.startsWith("https://")) {
    return posterUrl;
  }
  const filename = posterUrl.startsWith("/") ? posterUrl : `/${posterUrl}`;
  return `${TMDB_IMAGE_BASE}${filename}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- Movie detail page ---------------- */

async function loadMovieDetail() {
  const container = document.getElementById("movie-detail");
  if (!container) return;

  const movieId = new URLSearchParams(window.location.search).get("id");

  if (!movieId) {
    container.innerHTML = `<p class="state-msg">No movie selected.</p>`;
    return;
  }

  try {
    // Backend route: GET /movies/{id}
    // Response: film columns + { reviews: [...], cast: [...], genres: [...] }
    const res = await fetch(`${API_BASE}/movies/${encodeURIComponent(movieId)}`);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Request failed with status ${res.status}`);
    }

    const movie = await res.json();
    container.innerHTML = renderMovieDetail(movie);
  } catch (err) {
    console.error("Failed to load movie:", err);
    container.innerHTML = `<p class="state-msg">Couldn't load this movie. ${escapeHtml(err.message || "")}</p>`;
  }
}

function renderMovieDetail(movie) {
  const title = escapeHtml(movie.title || "Untitled");
  const year = movie.release_year || "—";
  const rating = movie.avg_rating != null ? Number(movie.avg_rating).toFixed(1) : "—";
  const posterUrl = resolvePosterUrl(movie.poster_url);

  const posterHtml = posterUrl
    ? `<img src="${escapeHtml(posterUrl)}" alt="${title} poster" />`
    : `<div class="poster-placeholder">No image</div>`;

  const genres = Array.isArray(movie.genres) ? movie.genres : [];
  const genresHtml = genres.length
    ? genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")
    : `<span class="state-msg">No genres listed.</span>`;

  const cast = Array.isArray(movie.cast) ? movie.cast : [];
  const castHtml = cast.length
    ? cast.map(renderCastCard).join("")
    : `<p class="state-msg">No cast information available.</p>`;

  const reviews = Array.isArray(movie.reviews) ? movie.reviews : [];
  const reviewsHtml = reviews.length
    ? reviews.map(renderReviewCard).join("")
    : `<p class="state-msg">No reviews yet.</p>`;

  return `
    <div class="movie-detail-layout">
      <div class="movie-poster-large">${posterHtml}</div>
      <div>
        <h1 class="movie-title">${title}</h1>
        <div class="movie-meta">
          <span>${year}</span>
          <span class="rating-badge">★ ${rating}</span>
        </div>
        <div>${genresHtml}</div>
      </div>
    </div>

    <h2 class="detail-section-title">Cast and crew</h2>
    <div class="cast-grid">${castHtml}</div>

    <h2 class="detail-section-title">Reviews</h2>
    <div>${reviewsHtml}</div>
  `;
}

function renderCastCard(member) {
  const name = escapeHtml(member.name || "Unknown");
  const role = escapeHtml(member.role_name || "");
  const isDirector = role.toLowerCase() === "director";

  return `
    <div class="cast-card">
      <div class="cast-name">${name}</div>
      <div class="cast-role${isDirector ? " is-director" : ""}">${role}</div>
    </div>
  `;
}

function renderReviewCard(review) {
  const username = escapeHtml(review.username || "Anonymous");
  const rating = review.rating != null ? Number(review.rating).toFixed(1) : "—";
  const text = escapeHtml(review.review_text || "");
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString()
    : "";

  return `
    <div class="review-card">
      <div class="review-header">
        <span class="review-username">${username}</span>
        <span class="review-rating">★ ${rating}</span>
      </div>
      ${date ? `<div class="review-date">${escapeHtml(date)}</div>` : ""}
      <p class="review-text">${text}</p>
    </div>
  `;
}

/* ---------------- Login / signup page ---------------- */

function switchTab(mode) {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const loginTab = document.getElementById("tab-login");
  const signupTab = document.getElementById("tab-signup");
  if (!loginForm || !signupForm) return;

  const isLogin = mode === "login";
  loginForm.style.display = isLogin ? "block" : "none";
  signupForm.style.display = isLogin ? "none" : "block";
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.style.display = "none";

    try {
      // Backend route: POST /auth/login  { email, password }
      // Response: { message, token, username }
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Invalid email or password.");
      }

      if (data.token) {
        localStorage.setItem("session_token", data.token);
      }
      if (data.username) {
        localStorage.setItem("username", data.username);
      }
      window.location.href = "/";
    } catch (err) {
      errorEl.textContent = err.message || "Couldn't log in. Try again.";
      errorEl.style.display = "block";
    }
  });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const errorEl = document.getElementById("signup-error");
    errorEl.style.display = "none";

    try {
      // Backend route: POST /auth/register  { username, email, password }
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Couldn't create account.");
      }

      switchTab("login");
    } catch (err) {
      errorEl.textContent = err.message || "Couldn't create account. Try again.";
      errorEl.style.display = "block";
    }
  });
}