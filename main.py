from fastapi import FastAPI, HTTPException
from database import get_db

# 1. Import your new router
from routers import movies 
from routers import auth

app = FastAPI(title="Film Review API")

# 2. Tell the main app to include all the routes from movies.py
app.include_router(movies.router)
app.include_router(auth.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Film Review API!"}

@app.get("/test-db")
def test_database_connection():
    conn = get_db()
    if conn and conn.is_connected():
        conn.close()
        return {"status": "success", "message": "Successfully connected to MariaDB!"}
    else:
        raise HTTPException(status_code=500, detail="Database connection failed")