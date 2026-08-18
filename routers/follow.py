from fastapi import APIRouter, HTTPException, Depends,status
from database import get_db
from dependencies import get_current_user



router = APIRouter(
    prefix="/follow",
    tags=["follow"]
)


@router.post("/{user_id}", status_code=status.HTTP_201_CREATED)
def follow_user(user_id: int, current_user=Depends(get_current_user), conn=Depends(get_db)):
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute(
            "SELECT 1 FROM follows WHERE followee_id = %s AND followee_id = %s",
            (current_user["user_id"], user_id)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Already following this user")

        cursor.execute(
            "INSERT INTO follows (followee_id, followee_id) VALUES (%s, %s)",
            (current_user["user_id"], user_id)
        )
        conn.commit()
        return {"message": f"You are now following user {user_id}"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.delete("/{user_id}")
def unfollow_user(user_id: int, current_user=Depends(get_current_user), conn=Depends(get_db)):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "DELETE FROM follows WHERE followee_id = %s AND followee_id = %s",
            (current_user["user_id"], user_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="You are not following this user")
        return {"message": f"You have unfollowed user {user_id}"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()