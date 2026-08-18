from fastapi import APIRouter, HTTPException, Depends,status
from passlib.context import CryptContext
import secrets  
from database import get_db
from schemas.user_schema  import UserProfileUpdate
from dependencies import get_current_user



router = APIRouter(
    prefix="/users",
    tags=["User"]
)

@router.get("/me")
def get_my_profile(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me")
def update_my_profile(update: UserProfileUpdate, current_user=Depends(get_current_user), conn=Depends(get_db)):
    fields = update.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    cursor = conn.cursor(dictionary=True)
    try:
        set_clause = ", ".join(f"{key} = %s" for key in fields)
        params = list(fields.values()) + [current_user["user_id"]]
        cursor.execute(f"UPDATE users SET {set_clause} WHERE user_id = %s", params)
        conn.commit()

        cursor.execute(
            "SELECT user_id, username, email, created_at FROM users WHERE user_id = %s",
            (current_user["user_id"],)
        )
        return cursor.fetchone()

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()




@router.get("/{user_id}/followers")
def get_followers(user_id: int, conn=Depends(get_db)):
    """Users who follow this user."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT users.user_id, users.username
            FROM follows
            JOIN users ON follows.follower_id = users.user_id
            WHERE follows.followee_id = %s
        """, (user_id,))
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.get("/{user_id}/following")
def get_following(user_id: int, conn=Depends(get_db)):
    """Users that this user follows."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT users.user_id, users.username
            FROM follows
            JOIN users ON follows.followee_id = users.user_id
            WHERE follows.follower_id = %s
        """, (user_id,))
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()



