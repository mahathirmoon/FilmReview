from fastapi import APIRouter, HTTPException, Depends,status
from passlib.context import CryptContext
import secrets  
from database import get_db

from dependencies import get_current_user



router = APIRouter(
    prefix="/watchlist",
    tags=["watchlist"]
)










@router.post("/me/watchlist/{film_id}", status_code=status.HTTP_201_CREATED)
def add_to_watchlist(film_id: int, current_user=Depends(get_current_user), conn=Depends(get_db)):
    cursor = conn.cursor(dictionary=True)
    try:
        # Check if film exists
        cursor.execute("SELECT film_id, title FROM films WHERE film_id = %s", (film_id,))
        movie = cursor.fetchone()
        if not movie:
            raise HTTPException(status_code=404, detail="Film not found")

        # Check if already in watchlist
        cursor.execute(
            "SELECT * FROM watchlist WHERE user_id = %s AND film_id = %s",
            (current_user["user_id"], film_id)
        )
        existing = cursor.fetchone()
        if existing:
            return {
                "message": "Already in watchlist",
                "title": movie["title"]
            }

        # Insert new entry
        cursor.execute(
            "INSERT INTO watchlist (user_id, film_id) VALUES (%s, %s)",
            (current_user["user_id"], film_id)
        )
        conn.commit()
        return {
            "message": "Added to watchlist",
            "title": movie["title"]
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()



@router.delete("/me/watchlist/{film_id}")
def remove_from_watchlist(film_id: int, current_user=Depends(get_current_user), conn=Depends(get_db)):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "DELETE FROM watchlist WHERE user_id = %s AND film_id = %s",
            (current_user["user_id"], film_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Film not in watchlist")
        return {"message": "Removed from watchlist"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()