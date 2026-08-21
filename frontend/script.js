// Frontend is served by FastAPI itself (StaticFiles), so requests are
// same-origin — no need to hardcode a host/port here.
const API_BASE = "";

/* ---------------- Shared auth helper ---------------- */

// Builds the x-session-token header your backend expects on protected routes.
// Returns {} if not logged in, so callers can spread it safely either way.
function getAuthHeaders() {
  const token = localStorage.getItem("session_token");
  return token ? { "x-session-token": token } : {};
}

function isLoggedIn() {
  return Boolean(localStorage.getItem("session_token"));
}

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

// Wires up the navbar search box to /movies/search, falling back to the
// default randomized /movies/homepage feed when the search box is cleared.
// searchBtnId is optional — pass null when there's no separate button (live search).
function setupMovieSearch(inputId, searchBtnId, clearBtnId, gridId, headingId) {
  const input = document.getElementById(inputId);
  const searchBtn = searchBtnId ? document.getElementById(searchBtnId) : null;
  const clearBtn = document.getElementById(clearBtnId);
  const grid = document.getElementById(gridId);
  const heading = document.getElementById(headingId);
  if (!input || !grid) return;

  let debounceTimer = null;

  async function runSearch() {
    const query = input.value.trim();

    if (!query) {
      clearBtn.style.display = "none";
      if (heading) heading.textContent = "Discover";
      loadPosterSection(gridId);
      return;
    }

    if (heading) heading.textContent = `Results for "${query}"`;
    clearBtn.style.display = "inline-block";
    grid.innerHTML = `<p class="state-msg">Searching…</p>`;

    try {
      // Backend route: GET /movies/search?title=&page=&limit=
      const res = await fetch(
        `${API_BASE}/movies/search?title=${encodeURIComponent(query)}&page=1&limit=40`
      );

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const movies = await res.json();

      if (!Array.isArray(movies) || movies.length === 0 || movies[0] === "No Movie Found") {
        grid.innerHTML = `<p class="state-msg">No movies found for "${escapeHtml(query)}".</p>`;
        return;
      }

      grid.innerHTML = movies.map(renderPosterCard).join("");
    } catch (err) {
      console.error("Movie search failed:", err);
      grid.innerHTML = `<p class="state-msg">Couldn't search movies right now.</p>`;
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 350);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(debounceTimer);
      runSearch();
    }
  });

  if (searchBtn) searchBtn.addEventListener("click", runSearch);

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.style.display = "none";
    if (heading) heading.textContent = "Discover";
    loadPosterSection(gridId);
  });
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
    setupReviewForm(movieId);
  } catch (err) {
    console.error("Failed to load movie:", err);
    container.innerHTML = `<p class="state-msg">Couldn't load this movie. ${escapeHtml(err.message || "")}</p>`;
  }
}

function setupReviewForm(movieId) {
  const formContainer = document.getElementById("review-form-container");
  if (!formContainer) return;

  if (!isLoggedIn()) {
    formContainer.innerHTML = `
      <p class="state-msg">
        <a href="/login" style="color:#e63946;">Log in</a> to write a review.
      </p>
    `;
    return;
  }

  renderAddReviewButton(formContainer, movieId);
}

function renderAddReviewButton(formContainer, movieId) {
  formContainer.innerHTML = `
    <button type="button" class="btn btn-primary" id="add-review-btn" style="margin-bottom:20px;">Add your review</button>
  `;

  document.getElementById("add-review-btn").addEventListener("click", () => {
    renderReviewForm(formContainer, movieId);
  });
}

function renderReviewForm(formContainer, movieId) {
  formContainer.innerHTML = `
    <form id="review-form" class="compact-form">
      <div class="field">
        <label for="review-rating">Your rating (1–10)</label>
        <input type="number" id="review-rating" min="1" max="10" step="0.1" required />
      </div>
      <div class="field">
        <label for="review-text">Your review</label>
        <textarea id="review-text" rows="3" required></textarea>
      </div>
      <p class="error-text" id="review-error"></p>
      <div style="display:flex; gap:8px;">
        <button type="submit" class="btn btn-primary">Post review</button>
        <button type="button" class="btn" id="cancel-review-btn">Cancel</button>
      </div>
    </form>
  `;

  document.getElementById("cancel-review-btn").addEventListener("click", () => {
    renderAddReviewButton(formContainer, movieId);
  });

  document.getElementById("review-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const rating = parseFloat(document.getElementById("review-rating").value);
    const reviewText = document.getElementById("review-text").value.trim();
    const errorEl = document.getElementById("review-error");
    errorEl.style.display = "none";

    try {
      // Backend route: POST /reviews/  { film_id, rating, review_text }
      // Requires x-session-token header
      const res = await fetch(`${API_BASE}/reviews/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          film_id: Number(movieId),
          rating: rating,
          review_text: reviewText,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Couldn't post review.");
      }

      // Reload the whole detail view so the new review and updated rating show up
      loadMovieDetail();
    } catch (err) {
      errorEl.textContent = err.message || "Couldn't post review. Try again.";
      errorEl.style.display = "block";
    }
  });
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
    <div id="review-form-container"></div>
    <div id="reviews-list">${reviewsHtml}</div>
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

  const isOwnReview =
    review.username && review.username === localStorage.getItem("username");

  const actionsHtml =
    isOwnReview && review.review_id
      ? `
        <div style="display:flex; gap:10px; margin-top:8px;">
          <button class="btn" style="padding:4px 10px; font-size:12px;" onclick="startEditReview(${review.review_id}, ${review.rating}, '${escapeJs(review.review_text || "")}')">Edit</button>
          <button class="btn" style="padding:4px 10px; font-size:12px;" onclick="deleteReview(${review.review_id})">Delete</button>
        </div>
      `
      : "";

  return `
    <div class="review-card" id="review-${review.review_id || ""}">
      <div class="review-header">
        <span class="review-username">${username}</span>
        <span class="review-rating">★ ${rating}</span>
      </div>
      ${date ? `<div class="review-date">${escapeHtml(date)}</div>` : ""}
      <p class="review-text">${text}</p>
      ${actionsHtml}
    </div>
  `;
}

// Escapes a string for safe embedding inside a single-quoted JS string
// within an inline onclick="" attribute.
function escapeJs(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
}

async function deleteReview(reviewId) {
  if (!confirm("Delete this review?")) return;

  try {
    // Backend route: DELETE /reviews/{review_id}  (requires x-session-token header)
    const res = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || "Couldn't delete review.");
    }

    loadMovieDetail();
  } catch (err) {
    alert(err.message || "Couldn't delete review.");
  }
}

function startEditReview(reviewId, currentRating, currentText) {
  const card = document.getElementById(`review-${reviewId}`);
  if (!card) return;

  card.innerHTML = `
    <div class="compact-form" style="margin:0;">
      <div class="field">
        <label>Rating (1–10)</label>
        <input type="number" id="edit-rating-${reviewId}" min="1" max="10" step="0.1" value="${currentRating}" />
      </div>
      <div class="field">
        <label>Review</label>
        <textarea id="edit-text-${reviewId}" rows="3">${currentText}</textarea>
      </div>
      <p class="error-text" id="edit-error-${reviewId}"></p>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" style="padding:4px 10px; font-size:12px;" onclick="submitEditReview(${reviewId})">Save</button>
        <button class="btn" style="padding:4px 10px; font-size:12px;" onclick="loadMovieDetail()">Cancel</button>
      </div>
    </div>
  `;
}

async function submitEditReview(reviewId) {
  const rating = document.getElementById(`edit-rating-${reviewId}`).value;
  const reviewText = document.getElementById(`edit-text-${reviewId}`).value.trim();
  const errorEl = document.getElementById(`edit-error-${reviewId}`);

  try {
    // Backend route: PUT /reviews/{review_id}?rating=&review_text=
    // rating/review_text are plain function params (not a Pydantic body),
    // so FastAPI expects them as query params here, not JSON.
    const params = new URLSearchParams({ rating, review_text: reviewText });
    const res = await fetch(`${API_BASE}/reviews/${reviewId}?${params.toString()}`, {
      method: "PUT",
      headers: getAuthHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || "Couldn't update review.");
    }

    loadMovieDetail();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Couldn't update review.";
      errorEl.style.display = "block";
    }
  }
}

/* ---------------- Activity feed page ---------------- */

async function loadActivityFeed() {
  const container = document.getElementById("feed-list");
  if (!container) return;

  if (!isLoggedIn()) {
    container.innerHTML = `
      <p class="state-msg">
        <a href="/login" style="color:#e63946;">Log in</a> to see reviews from people you follow.
      </p>
    `;
    return;
  }

  try {
    // Backend route: GET /social/me/feed  (requires x-session-token header)
    // Response: { page, limit, results: [...], next_page }
    const res = await fetch(`${API_BASE}/social/me/feed`, {
      headers: getAuthHeaders(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || `Request failed with status ${res.status}`);
    }

    const items = data.results;

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `<p class="state-msg">No activity yet. Follow other users to see their reviews here.</p>`;
      return;
    }

    container.innerHTML = items.map(renderFeedItem).join("");
  } catch (err) {
    console.error("Failed to load activity feed:", err);
    container.innerHTML = `<p class="state-msg">Couldn't load the feed. ${escapeHtml(err.message || "")}</p>`;
  }
}

function renderFeedItem(item) {
  const username = escapeHtml(item.username || "Someone");
  const title = escapeHtml(item.title || "Untitled");
  const rating = item.rating != null ? Number(item.rating).toFixed(1) : "—";
  const text = escapeHtml(item.review_text || "");
  const date = item.created_at ? new Date(item.created_at).toLocaleDateString() : "";
  const posterUrl = resolvePosterUrl(item.poster_url);

  const posterHtml = posterUrl
    ? `<img src="${escapeHtml(posterUrl)}" alt="${title} poster" style="width:60px; height:90px; object-fit:cover; border-radius:6px;" />`
    : `<div class="poster-placeholder" style="width:60px; height:90px; border-radius:6px; flex-shrink:0;">No image</div>`;

  return `
    <div class="review-card" style="display:flex; gap:14px;">
      <a href="/static/movie.html?id=${item.film_id}">${posterHtml}</a>
      <div style="flex:1;">
        <div class="review-header">
          <span class="review-username">${username} reviewed
            <a href="/static/movie.html?id=${item.film_id}" style="color:#f2f2f2;">${title}</a>
          </span>
          <span class="review-rating">★ ${rating}</span>
        </div>
        ${date ? `<div class="review-date">${escapeHtml(date)}</div>` : ""}
        <p class="review-text">${text}</p>
      </div>
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