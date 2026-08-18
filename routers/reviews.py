from fastapi import APIRouter,HTTPException,Query,Depends
from typing import Optional
from schemas.review_schema import postReview 
from database import get_db
from dependencies import get_current_user


router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
    dependencies=[Depends(get_current_user)]
)


@router.post("/")
def create_review(review:postReview,conn = Depends(get_db),current_user=Depends(get_current_user)):
    try:
        cursor=conn.cursor()

        insert_query = """INSERT INTO Reviews(user_id,film_id,rating,review_text)
                           VALUES(%s,%s,%s,%s) """

        cursor.execute(insert_query, (
            current_user['user_id'],  # <-- Extracted from the token!
            review.film_id,
            review.rating,
            review.review_text
        ))
        conn.commit()
        return {"messeage":"Review posted"}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500,detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()


