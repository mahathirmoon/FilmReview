from fastapi import APIRouter, HTTPException, Depends,status
from passlib.context import CryptContext
import secrets  
from database import get_db
from dependencies import get_current_user



router = APIRouter(
    prefix="/social",
    tags=["social"]
)

@router.get("/me/feed")
def get_activity_feed(
    current_user=Depends(get_current_user),
    conn=Depends(get_db),
    page: int = 1,
    limit: int = 20,
):
    """
    Feature 5: chronological feed of reviews written by people the current user follows.
    """
    if page < 1:
        page = 1
    if limit < 1 or limit > 50:
        limit = 20
    offset = (page - 1) * limit

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                users.user_id, users.username,
                reviews.review_id, reviews.film_id, films.title, films.poster_url,
                reviews.rating, reviews.review_text, reviews.created_at, reviews.like_count
            FROM reviews
            JOIN follows ON follows.followee_id = reviews.user_id
            JOIN users ON users.user_id = reviews.user_id
            JOIN films ON films.film_id = reviews.film_id
            WHERE follows.follower_id = %s
            ORDER BY reviews.created_at DESC
            LIMIT %s OFFSET %s
        """, (current_user["user_id"], limit, offset))

        feed = cursor.fetchall()

        return {
            "page": page,
            "limit": limit,
            "results": feed,
            "next_page": f"/users/me/feed?page={page + 1}&limit={limit}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.get("/{user_id}")
def get_public_profile(user_id: int, conn=Depends(get_db)):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT user_id, username, created_at FROM users WHERE user_id = %s",
            (user_id,)
        )
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute("SELECT COUNT(*) AS count FROM reviews WHERE user_id = %s", (user_id,))
        user["review_count"] = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) AS count FROM follows WHERE followee_id = %s", (user_id,))
        user["follower_count"] = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) AS count FROM follows WHERE follower_id = %s", (user_id,))
        user["following_count"] = cursor.fetchone()["count"]

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
@router.get("/{user_id}/reviews")
def get_user_reviews(user_id: int, conn=Depends(get_db)):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT reviews.review_id, reviews.film_id, films.title, films.poster_url,
                   reviews.rating, reviews.review_text, reviews.created_at, reviews.like_count
            FROM reviews
            JOIN films ON reviews.film_id = films.film_id
            WHERE reviews.user_id = %s
            ORDER BY reviews.created_at DESC
        """, (user_id,))
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.get("/{user_id}/playlist")
def get_user_playlist(user_id: int, conn=Depends(get_db)):
    
    """
    to be added
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT films.film_id, films.title, films.poster_url, watchlist.added_at
            FROM watchlist
            JOIN films ON watchlist.film_id = films.film_id
            WHERE watchlist.user_id = %s
            ORDER BY watchlist.added_at DESC
        """, (user_id,))
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
