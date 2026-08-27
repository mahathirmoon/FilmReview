import os
import dotenv
import mysql.connector.pooling
from fastapi import Depends

dotenv.load_dotenv()

# Create a pool of reusable connections
db_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="film_pool",
    pool_size=10,   # adjust based on traffic & DB limits
    host=os.getenv("DB_HOST"),
    
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)

# FastAPI dependency
def get_db():
    conn = db_pool.get_connection()
    try:
        yield conn
    finally:
        if conn.is_connected():
            conn.close()  # returns connection to pool