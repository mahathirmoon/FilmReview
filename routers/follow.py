from fastapi import APIRouter, HTTPException, Depends, Query, status
from database import get_db
from dependencies import get_current_user



router = APIRouter(
    prefix="/follow",
    tags=["follow"]
)


@router.get("/suggestions")
def get_suggested_users(
    limit: int = Query(24, ge=1, le=50),
    current_user=Depends(get_current_user),
    conn=Depends(get_db),
):
    """
    Feature: "people to follow" page. Returns users the current user
    doesn't already follow (and isn't themselves), ranked by how many
    reviews they've written so the most active reviewers surface first.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                u.user_id, u.username, u.created_at,
                COUNT(DISTINCT r.review_id) AS review_count,
                COUNT(DISTINCT f.follower_id) AS follower_count
            FROM users u
            LEFT JOIN reviews r ON r.user_id = u.user_id
            LEFT JOIN follows f ON f.followee_id = u.user_id
            WHERE u.user_id != %s
              AND u.user_id NOT IN (
                  SELECT followee_id FROM follows WHERE follower_id = %s
              )
            GROUP BY u.user_id, u.username, u.created_at
            ORDER BY review_count DESC, follower_count DESC, u.created_at DESC
            LIMIT %s
        """, (current_user["user_id"], current_user["user_id"], limit))
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


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
          "SELECT 1 FROM follows WHERE follower_id = %s AND followee_id = %s",
         (current_user["user_id"], user_id)
            )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Already following this user")

        cursor.execute(
        "INSERT INTO follows (follower_id, followee_id) VALUES (%s, %s)",
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
             "DELETE FROM follows WHERE follower_id = %s AND followee_id = %s",
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


@router.get("/check/{user_id}")
def check_following(user_id: int, current_user=Depends(get_current_user), conn=Depends(get_db)):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT 1 FROM follows WHERE follower_id = %s AND followee_id = %s",
            (current_user["user_id"], user_id)
        )
        is_following = bool(cursor.fetchone())
        return {"is_following": is_following}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()