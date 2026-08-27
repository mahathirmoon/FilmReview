from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import get_db

from routers import movies
from routers import auth
from routers import users
from routers import watchlist
from routers import social
from routers import reviews
from routers import follow


app = FastAPI(title="Film Review API")


app.include_router(movies.router)
app.include_router(auth.router)
app.include_router(follow.router)
app.include_router(reviews.router)
app.include_router(users.router)
app.include_router(social.router)
app.include_router(watchlist.router)


app.mount(
    "/static",
    StaticFiles(directory="frontend"),
    name="static"
)


@app.get("/login")
def login_page():
    return FileResponse("frontend/index.html")


@app.get("/")
def home_page():
    return FileResponse("frontend/home.html")


@app.get("/feed")
def feed_page():
    return FileResponse("frontend/feed.html")


@app.get("/profile")
def profile_page():
    return FileResponse("frontend/profile.html")


@app.get("/movie")
def movie_page():
    return FileResponse("frontend/movie.html")


@app.get("/suggestions-page")
@app.get("/suggestions")
def suggestions_page():
    return FileResponse("frontend/suggestions.html")


@app.get("/test-db")
def test_database_connection():
    conn = get_db()

    if conn and conn.is_connected():
        conn.close()

        return {
            "status": "success",
            "message": "Successfully connected to MariaDB!"
        }

    raise HTTPException(
        status_code=500,
        detail="Database connection failed"
    )