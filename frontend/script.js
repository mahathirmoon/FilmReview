// CineVerse Social Platform Application Engine
const API = {
  // Session State
  getToken: () => localStorage.getItem("session_token"),
  getUserId: () => localStorage.getItem("user_id"),
  getUsername: () => localStorage.getItem("username"),
  setSession: (token, userId, username) => {
    localStorage.setItem("session_token", token);
    localStorage.setItem("user_id", userId);
    localStorage.setItem("username", username);
  },
  clearSession: () => {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
  },
  isLoggedIn: () => !!localStorage.getItem("session_token"),

  // Unified Fetch Wrapper
  async fetch(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = API.getToken();
    if (token) {
      headers["x-session-token"] = token;
    }
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }

    options.headers = headers;
    try {
      const response = await fetch(endpoint, options);
      if (response.status === 401) {
        if (!window.location.pathname.includes("/login")) {
          API.clearSession();
          window.location.href = "/login";
        }
      }
      const data = await response.json();
      if (!response.ok) {
        let errorMsg = "An error occurred";
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            errorMsg = data.detail.map(e => {
              let m = e.msg || JSON.stringify(e);
              if (m.includes("String should have at least")) {
                m = m.replace("String", "Password");
              }
              return m;
            }).join(", ");
          } else {
            errorMsg = data.detail;
          }
        } else if (data.message) {
          errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      console.error("API Error:", err);
      throw err;
    }
  }
};

// UI Helpers
function formatPosterUrl(url, size = "w500") {
  if (!url || url === "null" || url === "undefined") {
    return "https://via.placeholder.com/300x450/151d2a/94a3b8?text=No+Poster";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `https://image.tmdb.org/t/p/${size}${cleanPath}`;
}

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Global Seed for Homepage Deterministic Pagination
let CURRENT_SEED = parseInt(sessionStorage.getItem("movie_seed")) || Math.floor(Math.random() * 899999) + 100000;
sessionStorage.setItem("movie_seed", CURRENT_SEED);

// Initialize Navigation & Global Components
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();
  setupGlobalSearch();
  setupReviewModal();

  // Page Specific Inits
  const path = window.location.pathname;
  if (path === "/" || path.endsWith("/home.html")) {
    initHomePage();
  } else if (path === "/feed" || path.endsWith("/feed.html")) {
    initFeedPage();
  } else if (path === "/movie" || path.endsWith("/movie.html")) {
    initMoviePage();
  } else if (path === "/profile" || path.endsWith("/profile.html")) {
    initProfilePage();
  } else if (path === "/suggestions" || path.endsWith("/suggestions.html")) {
    initSuggestionsPage();
  } else if (path === "/login" || path.endsWith("/index.html")) {
    initAuthPage();
  }
});

// Render Dynamic Header Bar
function renderNavbar() {
  const navContainer = document.getElementById("navbar");
  if (!navContainer) return;

  const isLoggedIn = API.isLoggedIn();
  const username = API.getUsername() || "User";

  navContainer.innerHTML = `
    <div class="navbar-container">
      <a href="/" class="brand-logo">
        <i class="fa-solid fa-film"></i>
        <span>CINEVERSE</span>
        <span class="brand-badge">PRO</span>
      </a>

      <div class="search-container">
        <div class="search-input-wrapper">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="global-search-input" class="search-input" placeholder="Search movies, directors, users..." autocomplete="off">
        </div>
        <div id="search-dropdown" class="search-dropdown"></div>
      </div>

      <ul class="nav-links">
        <li><a href="/" class="nav-link ${window.location.pathname === '/' ? 'active' : ''}"><i class="fa-solid fa-compass"></i> Discover</a></li>
        ${isLoggedIn ? `<li><a href="/feed" class="nav-link ${window.location.pathname === '/feed' ? 'active' : ''}"><i class="fa-solid fa-layer-group"></i> Feed</a></li>` : ''}
        ${isLoggedIn ? `<li><a href="/suggestions" class="nav-link ${window.location.pathname === '/suggestions' ? 'active' : ''}"><i class="fa-solid fa-users"></i> Critics</a></li>` : ''}
      </ul>

      <div class="nav-user-actions">
        ${isLoggedIn ? `
          <button class="btn-post-review" onclick="openReviewModal()"><i class="fa-solid fa-plus"></i> Review</button>
          <a href="/profile" class="user-profile-badge">
            <div class="avatar-circle">${username.charAt(0)}</div>
            <span style="font-weight:700; font-size:0.88rem;">${username}</span>
          </a>
          <button class="btn btn-secondary btn-sm" title="Sign Out" onclick="handleLogout()"><i class="fa-solid fa-right-from-bracket"></i></button>
        ` : `
          <a href="/login" class="btn btn-primary btn-sm"><i class="fa-solid fa-user"></i> Sign In</a>
        `}
      </div>
    </div>
  `;
}

function handleLogout() {
  API.clearSession();
  showToast("Logged out successfully", "success");
  window.location.href = "/login";
}

// Global Search
function setupGlobalSearch() {
  const input = document.getElementById("global-search-input");
  const dropdown = document.getElementById("search-dropdown");
  if (!input || !dropdown) return;

  let debounceTimer;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = e.target.value.trim();
      if (query.length > 0) {
        window.location.href = `/?search=${encodeURIComponent(query)}`;
      }
    }
  });

  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    if (query.length < 2) {
      dropdown.classList.remove("active");
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const [movies, users] = await Promise.all([
          API.fetch(`/movies/search?title=${encodeURIComponent(query)}&limit=5`).catch(() => []),
          API.fetch(`/users/search?username=${encodeURIComponent(query)}`).catch(() => [])
        ]);

        let html = "";
        const movieResults = Array.isArray(movies) ? movies.filter(m => typeof m === "object") : [];
        if (movieResults.length > 0) {
          html += `<div style="padding:0.5rem 0.85rem; font-size:0.75rem; font-weight:800; color:var(--accent-purple-light); text-transform:uppercase; letter-spacing:0.5px;">Movies</div>`;
          movieResults.forEach(m => {
            html += `
              <div class="search-result-item" onclick="window.location.href='/movie?id=${m.film_id}'">
                <img src="${formatPosterUrl(m.poster_url, 'w92')}" alt="${m.title}">
                <div class="search-result-info">
                  <div class="search-result-title">${m.title}</div>
                  <div class="search-result-meta">${m.release_year || ''} • ★ ${m.avg_rating || 'N/A'}</div>
                </div>
              </div>
            `;
          });
        }

        if (users.length > 0) {
          html += `<div style="padding:0.5rem 0.85rem; font-size:0.75rem; font-weight:800; color:var(--accent-cyan); text-transform:uppercase; letter-spacing:0.5px;">Users</div>`;
          users.forEach(u => {
            html += `
              <div class="search-result-item" onclick="window.location.href='/profile?id=${u.user_id}'">
                <div class="avatar-circle" style="width:34px; height:34px; font-size:0.85rem;">${u.username.charAt(0)}</div>
                <div class="search-result-info">
                  <div class="search-result-title">@${u.username}</div>
                  <div class="search-result-meta">Film Critic</div>
                </div>
              </div>
            `;
          });
        }

        if (!html) {
          html = `<div style="padding:1rem; text-align:center; color:var(--text-dim); font-size:0.88rem;">No results found</div>`;
        }

        dropdown.innerHTML = html;
        dropdown.classList.add("active");
      } catch (err) {
        console.error(err);
      }
    }, 300);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      dropdown.classList.remove("active");
    }
  });
}

// Global Review Modal Setup
let selectedStarRating = 5;
function setupReviewModal() {
  const modalHTML = `
    <div id="review-modal" class="modal-backdrop">
      <div class="modal-card" style="overflow:visible;">
        <div class="modal-header">
          <h3 class="modal-title" style="font-family:var(--font-heading); color:#fff; font-size:1.3rem;"><i class="fa-solid fa-pen-to-square" style="color:var(--accent-purple);"></i> Write a Review</h3>
          <button class="btn-close-modal" onclick="closeReviewModal()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="review-form" onsubmit="handleReviewSubmit(event)">
          <input type="hidden" id="modal-film-id" required>

          <div class="form-group" style="position:relative;">
            <label class="form-label">Select Movie</label>
            <div id="selected-movie-container" style="display:none; background:rgba(255,255,255,0.06); border:1px solid var(--border-accent); padding:0.75rem 1rem; border-radius:var(--radius-sm); align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:0.8rem;">
                <img id="selected-movie-poster" src="" style="width:36px; height:50px; object-fit:cover; border-radius:4px;" alt="Poster">
                <div>
                  <div id="selected-movie-title" style="font-weight:700; color:#fff; font-size:0.95rem;"></div>
                  <div id="selected-movie-year" style="font-size:0.78rem; color:var(--text-muted);"></div>
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="clearModalSelectedMovie()"><i class="fa-solid fa-arrows-rotate"></i> Change</button>
            </div>

            <div id="modal-search-box">
              <input type="text" id="modal-film-search-input" class="form-input" placeholder="Type movie title (e.g. Inception)..." autocomplete="off">
              <div id="modal-film-results" class="search-dropdown" style="width:100%; top:100%;"></div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Rating</label>
            <div class="star-rating-picker" id="star-picker">
              <i class="fa-solid fa-star active" data-value="1"></i>
              <i class="fa-solid fa-star active" data-value="2"></i>
              <i class="fa-solid fa-star active" data-value="3"></i>
              <i class="fa-solid fa-star active" data-value="4"></i>
              <i class="fa-solid fa-star active" data-value="5"></i>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Your Review</label>
            <textarea id="modal-review-text" class="form-textarea" rows="4" placeholder="Share your thoughts on cinematography, plot, or acting..." required></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" class="btn btn-secondary" onclick="closeReviewModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Publish Review</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const stars = document.querySelectorAll("#star-picker i");
  stars.forEach(star => {
    star.addEventListener("click", () => {
      selectedStarRating = parseInt(star.dataset.value);
      stars.forEach((s, idx) => {
        if (idx < selectedStarRating) {
          s.classList.add("active");
        } else {
          s.classList.remove("active");
        }
      });
    });
  });

  const searchInput = document.getElementById("modal-film-search-input");
  const searchResults = document.getElementById("modal-film-results");

  let searchTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    if (query.length < 1) {
      searchResults.classList.remove("active");
      return;
    }

    searchTimer = setTimeout(async () => {
      try {
        const data = await API.fetch(`/movies/search?title=${encodeURIComponent(query)}&limit=8`);
        const movies = Array.isArray(data) ? data.filter(m => typeof m === "object") : [];

        if (movies.length === 0) {
          searchResults.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-dim); font-size:0.85rem;">No movie found</div>`;
        } else {
          searchResults.innerHTML = movies.map(m => `
            <div class="search-result-item" onclick="selectMovieInModal(${m.film_id}, '${m.title.replace(/'/g, "\\'")}', '${m.release_year || ''}', '${m.poster_url || ''}')">
              <img src="${formatPosterUrl(m.poster_url, 'w92')}" alt="${m.title}">
              <div class="search-result-info">
                <div class="search-result-title">${m.title}</div>
                <div class="search-result-meta">${m.release_year || ''} • ★ ${m.avg_rating || 'N/A'}</div>
              </div>
            </div>
          `).join("");
        }
        searchResults.classList.add("active");
      } catch (err) {
        searchResults.classList.remove("active");
      }
    }, 250);
  });
}

function selectMovieInModal(id, title, year, posterUrl) {
  document.getElementById("modal-film-id").value = id;
  document.getElementById("selected-movie-title").textContent = title;
  document.getElementById("selected-movie-year").textContent = year ? `(${year})` : '';
  document.getElementById("selected-movie-poster").src = formatPosterUrl(posterUrl, 'w92');

  document.getElementById("selected-movie-container").style.display = "flex";
  document.getElementById("modal-search-box").style.display = "none";
  document.getElementById("modal-film-results").classList.remove("active");
}

function clearModalSelectedMovie() {
  document.getElementById("modal-film-id").value = "";
  document.getElementById("selected-movie-container").style.display = "none";
  document.getElementById("modal-search-box").style.display = "block";
  document.getElementById("modal-film-search-input").value = "";
  document.getElementById("modal-film-search-input").focus();
}

async function openReviewModal(presetFilmId = null) {
  if (!API.isLoggedIn()) {
    showToast("Please sign in to write a review", "error");
    window.location.href = "/login";
    return;
  }

  const modal = document.getElementById("review-modal");
  modal.classList.add("active");

  if (presetFilmId) {
    try {
      const movie = await API.fetch(`/movies/${presetFilmId}`);
      selectMovieInModal(movie.film_id, movie.title, movie.release_year, movie.poster_url);
    } catch (err) {
      clearModalSelectedMovie();
    }
  } else {
    clearModalSelectedMovie();
  }
}

function closeReviewModal() {
  document.getElementById("review-modal").classList.remove("active");
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  const filmId = document.getElementById("modal-film-id").value;
  const text = document.getElementById("modal-review-text").value;

  if (!filmId) {
    showToast("Please select a movie", "error");
    return;
  }

  try {
    await API.fetch("/reviews/", {
      method: "POST",
      body: {
        film_id: parseInt(filmId),
        rating: selectedStarRating,
        review_text: text
      }
    });
    showToast("Review published!", "success");
    closeReviewModal();
    document.getElementById("modal-review-text").value = "";

    if (window.location.pathname.includes("/feed")) {
      initFeedPage();
    } else if (window.location.pathname.includes("/movie")) {
      initMoviePage();
    }
  } catch (err) {
    showToast(err.message || "Failed to post review", "error");
  }
}

// Watchlist toggle
async function toggleWatchlist(filmId, btnElement) {
  if (!API.isLoggedIn()) {
    showToast("Please sign in to manage your watchlist", "error");
    return;
  }

  const isActive = btnElement.classList.contains("active");
  try {
    if (isActive) {
      await API.fetch(`/watchlist/me/${filmId}`, { method: "DELETE" });
      btnElement.classList.remove("active");
      showToast("Removed from watchlist", "info");
    } else {
      await API.fetch(`/watchlist/me/${filmId}`, { method: "POST" });
      btnElement.classList.add("active");
      showToast("Added to watchlist!", "success");
    }
  } catch (err) {
    showToast(err.message || "Watchlist action failed", "error");
  }
}

// Review Like toggle
async function toggleReviewLike(reviewId, btnElement) {
  if (!API.isLoggedIn()) {
    showToast("Please sign in to like reviews", "error");
    return;
  }

  const isLiked = btnElement.classList.contains("active");
  const countSpan = btnElement.querySelector(".like-count");
  let currentCount = parseInt(countSpan.textContent) || 0;

  try {
    if (isLiked) {
      await API.fetch(`/reviews/${reviewId}/like`, { method: "DELETE" });
      btnElement.classList.remove("active");
      countSpan.textContent = Math.max(0, currentCount - 1);
    } else {
      await API.fetch(`/reviews/${reviewId}/like`, { method: "POST" });
      btnElement.classList.add("active");
      countSpan.textContent = currentCount + 1;
    }
  } catch (err) {
    showToast("Like action failed", "error");
  }
}

async function deleteReview(reviewId) {
  if (!confirm("Are you sure you want to delete this review?")) return;
  try {
    await API.fetch(`/reviews/${reviewId}`, { method: "DELETE" });
    showToast("Review deleted successfully", "success");
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    showToast(err.message || "Failed to delete review", "error");
  }
}

function renderStars(rating) {
  const full = Math.floor(rating);
  let stars = "";
  for (let i = 0; i < 5; i++) {
    if (i < full) stars += `<i class="fa-solid fa-star" style="color:var(--accent-gold);"></i>`;
    else if (i < rating) stars += `<i class="fa-solid fa-star-half-stroke" style="color:var(--accent-gold);"></i>`;
    else stars += `<i class="fa-regular fa-star" style="color:var(--text-dim);"></i>`;
  }
  return stars;
}

// ==========================================================================
// PAGE INITIALIZERS
// ==========================================================================

// 1. HOME PAGE
let currentPage = 1;
async function initHomePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get("search");

  if (searchQuery) {
    const hero = document.getElementById("hero-banner");
    const carousels = document.getElementById("home-carousels");
    const gridTitle = document.getElementById("movies-grid-title");
    const searchInput = document.getElementById("global-search-input");
    
    if (hero) hero.style.display = "none";
    if (carousels) carousels.style.display = "none";
    if (gridTitle) gridTitle.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search Results for '${searchQuery}'`;
    if (searchInput) searchInput.value = searchQuery;

    filterMovies();
  } else {
    loadTrendingHero();
    loadTrendingSection();
    loadTopRatedSection();
    loadLatestReleasesSection();
    loadMoviesFeed(1);
  }

  loadSidebarSuggestions();
  loadSidebarWatchlistGlance();
  loadCommunityHubChart();

  const genreFilter = document.getElementById("genre-filter");
  const sortFilter = document.getElementById("sort-filter");
  if (genreFilter) genreFilter.addEventListener("change", () => filterMovies());
  if (sortFilter) sortFilter.addEventListener("change", () => filterMovies());
}

function scrollCarousel(carouselId, direction) {
  const container = document.getElementById(carouselId);
  if (!container) return;
  const scrollAmount = container.clientWidth * 0.75 * direction;
  container.scrollBy({ left: scrollAmount, behavior: "smooth" });
}

function setupCarouselInteractions() {
  document.querySelectorAll(".modern-carousel").forEach(carousel => {
    if (carousel.dataset.dragEnabled) return;
    carousel.dataset.dragEnabled = "true";

    carousel.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        carousel.scrollLeft += e.deltaY * 1.8;
      }
    }, { passive: false });

    let isDown = false;
    let startX;
    let scrollLeft;

    carousel.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener("mouseleave", () => { isDown = false; });
    carousel.addEventListener("mouseup", () => { isDown = false; });

    carousel.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2.2;
      carousel.scrollLeft = scrollLeft - walk;
    });
  });
}

async function loadTrendingSection() {
  const row = document.getElementById("trending-row");
  if (!row) return;
  try {
    const data = await API.fetch("/movies/trending?limit=15");
    const movies = data.results || [];
    renderMovieCardRow(row, movies);
  } catch (err) {
    row.innerHTML = `<div style="color:var(--text-dim); padding:1rem;">Failed to load trending movies</div>`;
  }
}

async function loadTopRatedSection() {
  const row = document.getElementById("top-rated-row");
  if (!row) return;
  try {
    const data = await API.fetch("/movies/top-rated?limit=15&minimum_rating=4.0");
    const movies = data.results || [];
    renderMovieCardRow(row, movies);
  } catch (err) {
    row.innerHTML = `<div style="color:var(--text-dim); padding:1rem;">Failed to load top rated movies</div>`;
  }
}

async function loadLatestReleasesSection() {
  const row = document.getElementById("latest-row");
  if (!row) return;
  try {
    const data = await API.fetch("/movies/search?sort_by=year&sort_order=desc&limit=15");
    const movies = Array.isArray(data) ? data : data.results || [];
    renderMovieCardRow(row, movies);
  } catch (err) {
    row.innerHTML = `<div style="color:var(--text-dim); padding:1rem;">Failed to load latest releases</div>`;
  }
}

function renderMovieCardRow(rowElement, movies) {
  if (!movies || movies.length === 0 || movies[0] === "No Movie Found") {
    rowElement.innerHTML = `<div style="color:var(--text-dim); padding:1rem;">No movies available</div>`;
    return;
  }
  rowElement.innerHTML = movies.map(m => `
    <div class="movie-card" onclick="window.location.href='/movie?id=${m.film_id}'">
      <div class="movie-poster-wrapper">
        <img src="${formatPosterUrl(m.poster_url, 'w500')}" class="movie-poster" alt="${m.title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450/151d2a/94a3b8?text=No+Poster';">
        <div class="movie-poster-overlay">
          <div class="rating-badge"><i class="fa-solid fa-star"></i> ${m.avg_rating || 'N/A'}</div>
          <button class="quick-watchlist-btn" title="Add to Watchlist" onclick="event.stopPropagation(); toggleWatchlist(${m.film_id}, this)">
            <i class="fa-solid fa-bookmark"></i>
          </button>
        </div>
      </div>
      <div class="movie-info">
        <div class="movie-title">${m.title}</div>
        <div class="movie-meta">
          <span>${m.release_year || 'N/A'}</span>
          <span style="color:var(--accent-gold); font-weight:700;"><i class="fa-solid fa-star"></i> ${m.avg_rating || 'N/A'}</span>
        </div>
      </div>
    </div>
  `).join("");
  setTimeout(setupCarouselInteractions, 100);
}

async function loadTrendingHero() {
  const heroContainer = document.getElementById("hero-banner");
  if (!heroContainer) return;

  try {
    const data = await API.fetch("/movies/trending?limit=3");
    const movies = data.results || [];
    if (movies.length === 0) return;

    const featured = movies[0];
    const posterUrl = formatPosterUrl(featured.poster_url, "w500");
    heroContainer.innerHTML = `
      <img src="${posterUrl}" class="hero-backdrop-img" alt="${featured.title}">
      <div class="hero-content-wrapper">
        <div class="hero-text-col">
          <span class="hero-tag"><i class="fa-solid fa-fire"></i> Trending #1 Highlight</span>
          <h1 class="hero-title">${featured.title}</h1>
          <p class="hero-desc">${featured.description || 'Join the conversation on this top discussed film in the CineVerse community.'}</p>
          <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
            <a href="/movie?id=${featured.film_id}" class="btn btn-primary"><i class="fa-solid fa-circle-info"></i> View Details</a>
            <button class="btn btn-secondary" onclick="openReviewModal(${featured.film_id})"><i class="fa-solid fa-star"></i> Write Review</button>
          </div>
        </div>
        <div class="hero-poster-col">
          <a href="/movie?id=${featured.film_id}">
            <img src="${posterUrl}" class="hero-featured-poster" alt="${featured.title}" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450/151d2a/94a3b8?text=No+Poster';">
          </a>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Hero failed:", err);
  }
}

async function filterMovies() {
  const genre = document.getElementById("genre-filter").value;
  const sort = document.getElementById("sort-filter").value;
  const grid = document.getElementById("movies-grid");
  
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get("search");

  grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-purple);"></i></div>`;

  try {
    let url = `/movies/search?page=1&limit=20&sort_by=${sort}`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    if (searchQuery) url += `&title=${encodeURIComponent(searchQuery)}`;

    const data = await API.fetch(url);
    renderMoviesGrid(Array.isArray(data) ? data : data.results || []);
  } catch (err) {
    showToast("Failed to filter movies", "error");
  }
}

async function loadMoviesFeed(page = 1) {
  currentPage = page;
  const grid = document.getElementById("movies-grid");
  if (!grid) return;

  grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-purple);"></i></div>`;

  try {
    const data = await API.fetch(`/movies/homepage?seed=${CURRENT_SEED}&page=${page}&limit=18`);
    renderMoviesGrid(data.results || []);

    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = (data.results || []).length < 18;
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--accent-red);">Failed to load movies</div>`;
  }
}

function renderMoviesGrid(movies) {
  const grid = document.getElementById("movies-grid");
  if (!grid) return;

  if (!movies || movies.length === 0 || movies[0] === "No Movie Found") {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-dim); padding:3rem;">No movies found</div>`;
    return;
  }

  grid.innerHTML = movies.map(m => `
    <div class="movie-card" onclick="window.location.href='/movie?id=${m.film_id}'">
      <div class="movie-poster-wrapper">
        <img src="${formatPosterUrl(m.poster_url, 'w500')}" class="movie-poster" alt="${m.title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450/151d2a/94a3b8?text=No+Poster';">
        <div class="movie-poster-overlay">
          <div class="rating-badge"><i class="fa-solid fa-star"></i> ${m.avg_rating || 'N/A'}</div>
          <button class="quick-watchlist-btn" title="Add to Watchlist" onclick="event.stopPropagation(); toggleWatchlist(${m.film_id}, this)">
            <i class="fa-solid fa-bookmark"></i>
          </button>
        </div>
      </div>
      <div class="movie-info">
        <div class="movie-title">${m.title}</div>
        <div class="movie-meta">
          <span>${m.release_year || 'N/A'}</span>
          <span style="color:var(--accent-gold); font-weight:700;"><i class="fa-solid fa-star"></i> ${m.avg_rating || 'N/A'}</span>
        </div>
      </div>
    </div>
  `).join("");
}

// 2. FEED PAGE
async function initFeedPage() {
  const stream = document.getElementById("feed-stream");
  if (!stream) return;

  stream.innerHTML = `<div style="text-align:center; padding:4rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-purple);"></i></div>`;

  try {
    const data = await API.fetch("/social/me/feed?page=1&limit=20");
    const reviews = data.results || [];

    if (reviews.length === 0) {
      stream.innerHTML = `
        <div class="sidebar-widget" style="text-align:center; padding:3rem;">
          <i class="fa-solid fa-user-plus fa-3x" style="color:var(--accent-purple); margin-bottom:1rem;"></i>
          <h3 style="font-family:var(--font-heading); font-size:1.3rem;">Your feed is empty!</h3>
          <p style="color:var(--text-muted); font-size:0.9rem; margin:0.5rem 0 1.5rem 0;">Follow other film critics to see their latest reviews and ratings here.</p>
          <a href="/suggestions" class="btn btn-primary"><i class="fa-solid fa-compass"></i> Discover People to Follow</a>
        </div>
      `;
      return;
    }

    stream.innerHTML = reviews.map(r => `
      <div class="review-card">
        <div class="review-header" style="align-items: flex-start;">
          <div class="review-author">
            <div class="avatar-circle">${(r.username || 'U').charAt(0)}</div>
            <div>
              <a href="/profile?id=${r.user_id}" style="font-weight:700; color:#fff; text-decoration:none; font-size:0.95rem;">@${r.username}</a>
              <div style="font-size:0.78rem; color:var(--text-muted);">${new Date(r.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center; text-align:right;">
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
              <a href="/movie?id=${r.film_id}" style="font-family:var(--font-heading); font-weight:700; color:#fff; text-decoration:none; font-size:1rem; margin-bottom:0.2rem;">${r.title}</a>
              <div>${renderStars(r.rating)}</div>
            </div>
            <img src="${formatPosterUrl(r.poster_url, 'w185')}" style="cursor:pointer; width:45px; height:65px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.1);" onclick="window.location.href='/movie?id=${r.film_id}'" alt="${r.title}">
          </div>
        </div>

        <p class="review-text">${r.review_text}</p>

        <div class="review-actions">
          <button class="action-btn" onclick="toggleReviewLike(${r.review_id}, this)">
            <i class="fa-solid fa-heart"></i> <span class="like-count">${r.like_count || 0}</span>
          </button>
          ${API.getUserId() == r.user_id ? `
            <button class="action-btn" style="color:var(--accent-red); margin-left: 10px;" onclick="deleteReview(${r.review_id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join("");
  } catch (err) {
    stream.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:3rem;">Failed to load feed. Please sign in.</div>`;
  }

  loadSidebarSuggestions();
}

// 3. MOVIE DETAIL PAGE
async function initMoviePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const filmId = urlParams.get("id");

  if (!filmId) {
    window.location.href = "/";
    return;
  }

  const container = document.getElementById("movie-detail-container");
  if (!container) return;

  try {
    const movie = await API.fetch(`/movies/${filmId}`);

    document.title = `${movie.title} • CineVerse`;

    container.innerHTML = `
      <div class="movie-detail-hero">
        <img src="${formatPosterUrl(movie.poster_url, 'original')}" class="movie-backdrop" alt="${movie.title}">
        <div class="movie-backdrop-overlay"></div>
        <div class="movie-detail-content">
          <div>
            <img src="${formatPosterUrl(movie.poster_url, 'w500')}" class="movie-poster-large" alt="${movie.title}">
          </div>
          <div class="movie-header-info">
            <div class="movie-pills-row">
              <span class="meta-pill"><i class="fa-regular fa-calendar"></i> ${movie.release_year || 'N/A'}</span>
              <span class="meta-pill gold"><i class="fa-solid fa-star"></i> ${movie.avg_rating || 'N/A'}</span>
              ${(movie.genres || []).map(g => `<span class="meta-pill">${g}</span>`).join("")}
            </div>
            <h1 class="movie-detail-title">${movie.title}</h1>
            <p class="synopsis-box">${movie.description || 'No plot synopsis available for this film.'}</p>
            <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.5rem;">
              <button class="btn btn-primary" onclick="openReviewModal(${movie.film_id})"><i class="fa-solid fa-star"></i> Rate & Review</button>
              <button class="btn btn-secondary" onclick="toggleWatchlist(${movie.film_id}, this)"><i class="fa-solid fa-bookmark"></i> Watchlist</button>
            </div>
          </div>
        </div>
      </div>

      <div class="social-grid-layout">
        <div>
          <div class="section-header" style="margin-top:0;">
            <h3 class="section-title"><i class="fa-solid fa-comments" style="color:var(--accent-purple);"></i> Community Reviews (${(movie.reviews || []).length})</h3>
          </div>
          <div class="feed-stream">
            ${(movie.reviews || []).length === 0 ? `
              <div class="sidebar-widget" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                Be the first film critic to post a review for ${movie.title}!
              </div>
            ` : movie.reviews.map(r => `
              <div class="review-card">
                <div class="review-header">
                  <div class="review-author">
                    <div class="avatar-circle">${r.username.charAt(0)}</div>
                    <div>
                      <a href="/profile?id=${r.user_id}" style="font-weight:700; color:#fff; text-decoration:none;">@${r.username}</a>
                      <div style="font-size:0.78rem; color:var(--text-muted);">${new Date(r.created_at || Date.now()).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div>${renderStars(r.rating)}</div>
                </div>
                <p class="review-text">${r.review_text}</p>
                <div class="review-actions">
                  <button class="action-btn" onclick="toggleReviewLike(${r.review_id}, this)">
                    <i class="fa-solid fa-heart"></i> <span class="like-count">${r.like_count || 0}</span>
                  </button>
                  ${API.getUserId() == r.user_id ? `
                    <button class="action-btn" style="color:var(--accent-red); margin-left: 10px;" onclick="deleteReview(${r.review_id})">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div>
          <div class="sidebar-widget">
            <h4 class="widget-title"><i class="fa-solid fa-users" style="color:var(--accent-cyan);"></i> Cast & Crew</h4>
            <div style="display:flex; flex-direction:column; gap:0.65rem;">
              ${(movie.cast || []).length === 0 ? `<span style="color:var(--text-dim); font-size:0.85rem;">No cast details</span>` :
                movie.cast.map(c => `
                  <div style="display:flex; justify-content:space-between; font-size:0.88rem; padding-bottom:0.45rem; border-bottom:1px solid rgba(255,255,255,0.04);">
                    <a href="/cast?id=${c.person_id}" style="font-weight:600; color:var(--accent-purple-light); text-decoration:none;">${c.name}</a>
                    <span style="color:var(--text-muted); font-size:0.8rem;">${c.role_name || 'Cast'}</span>
                  </div>
                `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:4rem;">Movie details failed to load.</div>`;
  }
}

// 4. SUGGESTIONS PAGE
async function initSuggestionsPage() {
  const container = document.getElementById("suggestions-grid");
  if (!container) return;

  container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-purple);"></i></div>`;

  try {
    const users = await API.fetch("/follow/suggestions?limit=24");
    if (!users || users.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;">No user suggestions at this time.</div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="sidebar-widget" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:1.75rem;">
        <div class="avatar-circle" style="width:64px; height:64px; font-size:1.6rem; margin-bottom:0.85rem;">${u.username.charAt(0)}</div>
        <a href="/profile?id=${u.user_id}" style="font-weight:700; color:#fff; text-decoration:none; font-size:1.1rem; margin-bottom:0.25rem;">@${u.username}</a>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.1rem;">
          ${u.review_count || 0} reviews • ${u.follower_count || 0} followers
        </div>
        <button class="btn btn-primary btn-sm btn-full" onclick="handleFollowUser(${u.user_id}, this)">
          <i class="fa-solid fa-user-plus"></i> Follow Critic
        </button>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--accent-red);">Please sign in to see suggestions</div>`;
  }
}

async function handleFollowUser(targetUserId, btnElement) {
  if (!API.isLoggedIn()) {
    showToast("Please sign in to follow users", "error");
    return;
  }

  const isFollowing = btnElement.classList.contains("btn-secondary");
  try {
    if (isFollowing) {
      await API.fetch(`/follow/${targetUserId}`, { method: "DELETE" });
      btnElement.classList.remove("btn-secondary");
      btnElement.classList.add("btn-primary");
      btnElement.innerHTML = `<i class="fa-solid fa-user-plus"></i> Follow`;
      showToast("Unfollowed user", "info");
    } else {
      await API.fetch(`/follow/${targetUserId}`, { method: "POST" });
      btnElement.classList.remove("btn-primary");
      btnElement.classList.add("btn-secondary");
      btnElement.innerHTML = `<i class="fa-solid fa-user-check"></i> Following`;
      showToast("Following user!", "success");
    }
  } catch (err) {
    showToast(err.message || "Follow failed", "error");
  }
}

// 5. PROFILE PAGE
async function initProfilePage() {
  const urlParams = new URLSearchParams(window.location.search);
  let userId = urlParams.get("id") || API.getUserId();

  if (!userId) {
    window.location.href = "/login";
    return;
  }

  const header = document.getElementById("profile-header");
  const isMe = String(userId) === String(API.getUserId());

  try {
    const profile = await API.fetch(`/social/${userId}`);
    let isFollowing = false;
    if (API.isLoggedIn() && !isMe) {
      try {
        const followCheck = await API.fetch(`/follow/check/${userId}`);
        isFollowing = followCheck.is_following;
      } catch (err) {
        console.error("Failed to check follow status", err);
      }
    }
    
    header.innerHTML = `
      <div class="profile-hero">
        <div style="display:flex; align-items:center; gap:2rem; flex-wrap:wrap;">
          <div class="profile-avatar-large">${profile.username.charAt(0)}</div>
          <div style="flex:1;">
            <h2 style="font-family:var(--font-heading); font-size:2rem; font-weight:800; color:#fff;">@${profile.username}</h2>
            <div style="color:var(--text-muted); font-size:0.85rem; margin-top:0.25rem;"><i class="fa-regular fa-calendar"></i> Member since ${new Date(profile.created_at || Date.now()).toLocaleDateString()}</div>
            <div class="profile-stats" style="margin-top:1.25rem;">
              <div class="stat-box">
                <span class="stat-number">${profile.review_count || 0}</span>
                <span class="stat-label">Reviews</span>
              </div>
              <div class="stat-box">
                <span class="stat-number">${profile.follower_count || 0}</span>
                <span class="stat-label">Followers</span>
              </div>
              <div class="stat-box">
                <span class="stat-number">${profile.following_count || 0}</span>
                <span class="stat-label">Following</span>
              </div>
            </div>
          </div>
          ${!isMe ? (isFollowing ? `
            <button class="btn btn-secondary" onclick="handleFollowUser(${profile.user_id}, this)">
              <i class="fa-solid fa-user-check"></i> Following
            </button>
          ` : `
            <button class="btn btn-primary" onclick="handleFollowUser(${profile.user_id}, this)">
              <i class="fa-solid fa-user-plus"></i> Follow Critic
            </button>
          `) : ''}
        </div>
      </div>
    `;

    loadUserReviewsTab(userId);
    loadUserWatchlistTab(userId);
  } catch (err) {
    header.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:3rem;">Failed to load profile</div>`;
  }
}

async function loadUserReviewsTab(userId) {
  const container = document.getElementById("user-reviews-tab");
  if (!container) return;

  try {
    const reviews = await API.fetch(`/social/${userId}/reviews`);
    if (reviews.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:2rem;">No reviews posted yet</div>`;
      return;
    }

    container.innerHTML = reviews.map(r => `
      <div class="review-card" style="margin-bottom:1rem;">
        <div class="review-header" style="align-items: flex-start;">
          <div class="review-author">
             <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-calendar"></i> ${new Date(r.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center; text-align:right;">
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
              <a href="/movie?id=${r.film_id}" style="font-family:var(--font-heading); font-weight:700; color:#fff; text-decoration:none; font-size:1rem; margin-bottom:0.2rem;">${r.title}</a>
              <div>${renderStars(r.rating)}</div>
            </div>
            <img src="${formatPosterUrl(r.poster_url, 'w185')}" style="cursor:pointer; width:45px; height:65px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.1);" onclick="window.location.href='/movie?id=${r.film_id}'" alt="${r.title}">
          </div>
        </div>
        <p class="review-text">${r.review_text}</p>
        <div class="review-actions" style="margin-top: 10px;">
          <button class="action-btn" onclick="toggleReviewLike(${r.review_id}, this)">
            <i class="fa-solid fa-heart"></i> <span class="like-count">${r.like_count || 0}</span>
          </button>
          ${API.getUserId() == userId ? `
            <button class="action-btn" style="color:var(--accent-red); margin-left: 10px;" onclick="deleteReview(${r.review_id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-red);">Failed to load user reviews</div>`;
  }
}

async function loadUserWatchlistTab(userId) {
  const container = document.getElementById("user-watchlist-tab");
  if (!container) return;

  try {
    const movies = await API.fetch(`/social/${userId}/playlist`);
    if (movies.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:2rem;">Watchlist is empty</div>`;
      return;
    }

    container.innerHTML = `
      <div class="movies-grid">
        ${movies.map(m => `
          <div class="movie-card" onclick="window.location.href='/movie?id=${m.film_id}'">
            <div class="movie-poster-wrapper">
              <img src="${formatPosterUrl(m.poster_url, 'w500')}" class="movie-poster" alt="${m.title}">
            </div>
            <div class="movie-info">
              <div class="movie-title">${m.title}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-red);">Failed to load watchlist</div>`;
  }
}

// 6. AUTH PAGE
function initAuthPage() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      try {
        const data = await API.fetch("/auth/login", {
          method: "POST",
          body: { email, password }
        });
        API.setSession(data.token, data.user_id, data.username);
        showToast("Login successful!", "success");
        window.location.href = "/";
      } catch (err) {
        showToast(err.message || "Invalid credentials", "error");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("register-username").value;
      const email = document.getElementById("register-email").value;
      const password = document.getElementById("register-password").value;

      try {
        await API.fetch("/auth/register", {
          method: "POST",
          body: { username, email, password }
        });
        showToast("Account created! Please sign in.", "success");
        switchAuthTab("login");
      } catch (err) {
        showToast(err.message || "Registration failed", "error");
      }
    });
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const btnLogin = document.getElementById("tab-btn-login");
  const btnRegister = document.getElementById("tab-btn-register");

  if (tab === 'login') {
    if (btnLogin) btnLogin.classList.add("active");
    if (btnRegister) btnRegister.classList.remove("active");
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
  } else {
    if (btnRegister) btnRegister.classList.add("active");
    if (btnLogin) btnLogin.classList.remove("active");
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
  }
}

async function loadSidebarSuggestions() {
  const container = document.getElementById("sidebar-suggestions");
  if (!container) return;

  if (!API.isLoggedIn()) {
    container.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim);">Sign in to see recommended critics</div>`;
    return;
  }

  container.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;

  try {
    const users = await API.fetch("/follow/suggestions?limit=5");
    if (!users || users.length === 0) {
      container.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim);">No suggested critics at the moment.</div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="critic-item">
        <div class="critic-user-info">
          <div class="avatar-circle" style="width:34px; height:34px; font-size:0.85rem;">${u.username.charAt(0).toUpperCase()}</div>
          <div>
            <a href="/profile?id=${u.user_id}" style="font-weight:700; color:#fff; text-decoration:none; font-size:0.88rem; display:block;">@${u.username}</a>
            <div style="font-size:0.75rem; color:var(--text-muted);">${u.review_count || 0} reviews</div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="handleFollowUser(${u.user_id}, this)">Follow</button>
      </div>
    `).join("");
  } catch (err) {
    console.error("Sidebar suggestions failed", err);
  }
}

// --------------------------------------------------------------------------
// SIDEBAR INTERACTIVE HELPERS
// --------------------------------------------------------------------------

// 1. Movie Roulette Handler
async function triggerMovieRoulette() {
  showToast("🎲 Rolling for a random film...", "info");
  try {
    const randomSeed = Math.floor(Math.random() * 899999) + 100000;
    const data = await API.fetch(`/movies/homepage?seed=${randomSeed}&page=1&limit=20`);
    const movies = data.results || [];
    if (movies.length > 0) {
      const picked = movies[Math.floor(Math.random() * movies.length)];
      showToast(`🎲 Picked: ${picked.title}!`, "success");
      setTimeout(() => {
        window.location.href = `/movie?id=${picked.film_id}`;
      }, 700);
    } else {
      showToast("Roulette failed, try again", "error");
    }
  } catch (err) {
    showToast("Roulette action failed", "error");
  }
}

// 2. Quick Select Genre Handler
function quickSelectGenre(genreName) {
  const genreFilter = document.getElementById("genre-filter");
  if (genreFilter) {
    genreFilter.value = genreName;
    filterMovies();
    genreFilter.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.location.href = `/?genre=${encodeURIComponent(genreName)}`;
  }
}

// 3. Sidebar Watchlist Glance Loader
async function loadSidebarWatchlistGlance() {
  const container = document.getElementById("sidebar-watchlist-glance");
  if (!container) return;

  if (!API.isLoggedIn()) {
    container.innerHTML = `
      <div style="font-size:0.85rem; color:var(--text-dim); text-align:center; padding:0.5rem 0;">
        <i class="fa-solid fa-bookmark" style="color:var(--accent-gold); margin-bottom:0.4rem; font-size:1.2rem; display:block;"></i>
        <div><a href="/login" style="color:var(--accent-purple-light); font-weight:700; text-decoration:none;">Sign in</a> to view saved movies</div>
      </div>
    `;
    return;
  }

  try {
    const watchlist = await API.fetch("/watchlist/me");
    if (!watchlist || watchlist.length === 0) {
      container.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-dim); padding:0.4rem 0;">
          No films saved yet. Click <i class="fa-solid fa-bookmark" style="color:var(--accent-pink);"></i> on any movie card to save it!
        </div>
      `;
      return;
    }

    const glanceItems = watchlist.slice(0, 3);
    container.innerHTML = glanceItems.map(item => `
      <a href="/movie?id=${item.film_id}" class="watchlist-glance-item">
        <img src="${formatPosterUrl(item.poster_url, 'w92')}" class="glance-poster" alt="${item.title}" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450/151d2a/94a3b8?text=No+Poster';">
        <div class="glance-info">
          <div class="glance-title">${item.title}</div>
          <div class="glance-meta">
            <span>${item.release_year || 'N/A'}</span>
          </div>
        </div>
      </a>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div style="font-size:0.82rem; color:var(--text-dim);">Unable to load watchlist</div>`;
  }
}

// 7. CAST PAGE
async function initCastPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const personId = urlParams.get("id");

  if (!personId) {
    window.location.href = "/";
    return;
  }

  const container = document.getElementById("cast-filmography-grid");
  const header = document.getElementById("cast-header");
  if (!container || !header) return;

  try {
    const films = await API.fetch(`/movies/cast/${personId}/films`);
    
    if (films.length === 0) {
      header.innerHTML = `<h1 style="color:#fff;">Cast Member Not Found</h1>`;
      return;
    }

    const personName = films[0].person_name || "Cast Member";
    document.title = `${personName} Filmography • CineVerse`;

    header.innerHTML = `
      <div style="padding:3rem 1rem; text-align:center;">
        <div style="width:100px; height:100px; border-radius:50%; background:var(--accent-purple); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; font-size:3rem; font-weight:bold; color:#fff;">
          ${personName.charAt(0)}
        </div>
        <h1 style="font-family:var(--font-heading); color:#fff; font-size:2.2rem; margin-bottom:0.5rem;">${personName}</h1>
        <p style="color:var(--text-muted);">${films.length} film(s)</p>
      </div>
    `;

    container.innerHTML = films.map(f => `
      <div class="movie-card" onclick="window.location.href='/movie?id=${f.film_id}'">
        <div class="movie-poster-wrapper">
          <img src="${formatPosterUrl(f.poster_url, 'w500')}" class="movie-poster" alt="${f.title}" loading="lazy">
          <div class="movie-rating"><i class="fa-solid fa-star"></i> ${f.avg_rating || 'N/A'}</div>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${f.title} <span class="movie-year">(${f.release_year || 'N/A'})</span></h3>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.3rem;"><i class="fa-solid fa-user"></i> ${f.role_name || 'Cast'}</p>
        </div>
      </div>
    `).join("");

  } catch (err) {
    header.innerHTML = `<div style="text-align:center; color:var(--accent-red); padding:3rem;">Failed to load filmography</div>`;
  }
}

async function loadCommunityHubChart() {
  const container = document.getElementById("community-hub-chart-container");
  if (!container) return;

  try {
    const data = await API.fetch("/movies/top-rated?limit=20&minimum_rating=0");
    const movies = Array.isArray(data) ? data : data.results || [];
    
    if (movies.length === 0) {
      container.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim);">No data available.</div>`;
      return;
    }

    const decadeCounts = {};
    movies.forEach(m => {
      if (m.release_year) {
        const decade = Math.floor(m.release_year / 10) * 10;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
      }
    });

    const sortedDecades = Object.keys(decadeCounts).sort((a, b) => a - b);
    let maxCount = 0;
    sortedDecades.forEach(d => { if (decadeCounts[d] > maxCount) maxCount = decadeCounts[d]; });

    let chartHTML = `
      <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.85rem; line-height: 1.4;">
        A breakdown of the Top 20 rated films by release decade.
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;

    sortedDecades.forEach(decade => {
      const count = decadeCounts[decade];
      const widthPercent = (count / maxCount) * 100;
      chartHTML += `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem;">
          <div style="width: 35px; color: var(--text-dim); font-weight: bold;">${decade}s</div>
          <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 4px; height: 12px; overflow: hidden; position: relative;">
            <div style="width: ${widthPercent}%; background: linear-gradient(90deg, var(--accent-purple), var(--accent-pink)); height: 100%; border-radius: 4px;"></div>
          </div>
          <div style="width: 25px; text-align: right; font-weight: bold; color: #fff;">${count}</div>
        </div>
      `;
    });

    chartHTML += `</div>`;
    container.innerHTML = chartHTML;

  } catch (err) {
    container.innerHTML = `<div style="font-size:0.85rem; color:var(--accent-red);">Failed to load stats.</div>`;
  }
}