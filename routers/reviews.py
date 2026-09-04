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


@router.get("/{review_id}/likes")
def get_review_likes(review_id: int, conn=Depends(get_db)):
    """Return the total like count stored on the review itself."""
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT review_id, like_count FROM Reviews WHERE review_id = %s",
            (review_id,)
        )
        review = cursor.fetchone()

        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        return {
            "review_id": review_id,
            "like_count": review["like_count"],
            "liked_by_me": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()


@router.post("/{review_id}/like")
def like_review(review_id: int, conn=Depends(get_db), current_user=Depends(get_current_user)):
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT review_id, like_count FROM Reviews WHERE review_id = %s",
            (review_id,)
        )
        review = cursor.fetchone()

        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        new_like_count = (review["like_count"] or 0) + 1
        cursor.execute(
            "UPDATE Reviews SET like_count = %s WHERE review_id = %s",
            (new_like_count, review_id)
        )
        conn.commit()

        return {
            "message": "Review liked",
            "review_id": review_id,
            "like_count": new_like_count,
            "liked_by_me": True,
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()


@router.delete("/{review_id}/like")
def unlike_review(review_id: int, conn=Depends(get_db), current_user=Depends(get_current_user)):
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT review_id, like_count FROM Reviews WHERE review_id = %s",
            (review_id,)
        )
        review = cursor.fetchone()

        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        new_like_count = max(0, (review["like_count"] or 0) - 1)
        cursor.execute(
            "UPDATE Reviews SET like_count = %s WHERE review_id = %s",
            (new_like_count, review_id)
        )
        conn.commit()

        return {
            "message": "Review like removed",
            "review_id": review_id,
            "like_count": new_like_count,
            "liked_by_me": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()


@router.post("/")
def create_review(review:postReview,conn = Depends(get_db),current_user=Depends(get_current_user)):
    try:
        cursor=conn.cursor()

        # Check if the user has already reviewed this film
        cursor.execute(
            "SELECT review_id FROM Reviews WHERE user_id = %s AND film_id = %s",
            (current_user['user_id'], review.film_id)
        )
        existing_review = cursor.fetchone()
        
        if existing_review:
            raise HTTPException(status_code=400, detail="You have already reviewed this film")

        insert_query = """INSERT INTO Reviews(user_id,film_id,rating,review_text)
                           VALUES(%s,%s,%s,%s) """

        cursor.execute(insert_query, (
            current_user['user_id'],  
            review.film_id,
            review.rating,
            review.review_text
        ))
        conn.commit()
        sum_query=""" SELECT AVG(rating) FROM reviews WHERE film_id=%s"""
        cursor.execute(sum_query,(review.film_id,))
        avg = cursor.fetchone()[0]
        cursor.execute("SELECT avg_rating FROM films Where film_id=%s",(review.film_id,))
        r_avg=cursor.fetchone()[0]
        if r_avg==0:
            cursor.execute("UPDATE films SET avg_rating=%s Where film_id=%s",(avg,review.film_id))
        elif r_avg:    
         avg_rating=float((avg+r_avg)/2)
         cursor.execute("UPDATE films SET avg_rating=%s Where film_id=%s",(avg_rating,review.film_id))

        conn.commit()




        return {"messeage":"Review posted"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500,detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()

@router.delete('/{review_id}')
def delete_review(review_id:int ,conn=Depends(get_db),current_user=Depends(get_current_user)):
     try:
        cursor = conn.cursor(dictionary=True)

       
        cursor.execute("SELECT user_id FROM Reviews WHERE review_id = %s", (review_id,))
        review = cursor.fetchone()

        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        if review["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="You can't delete someone else's review")

        cursor.execute("DELETE FROM Reviews WHERE review_id = %s", (review_id,))
        conn.commit()
        return {"message": "Review deleted"}
     except HTTPException:
        raise
     except Exception as e:
       conn.rollback()
       raise HTTPException(status_code=500, detail=str(e))
     finally:
         if 'cursor' in locals():
             cursor.close()  
@router.put('/{review_id}')
def update_review(review_id:int,rating:float,review_text:str,conn=Depends(get_db),current_user=Depends(get_current_user)):
    try:
        cursor=conn.cursor(dictionary=True)
        cursor.execute("SELECT user_id FROM Reviews WHERE review_id=%s",(review_id,))
        review=cursor.fetchone()
        if not review:
                raise HTTPException(status_code=404, detail="Review not found")
    
        if review["user_id"] != current_user["user_id"]:
                raise HTTPException(status_code=403, detail="You can't update someone else's review")
        cursor.execute("UPDATE Reviews SET rating=%s,review_text=%s WHERE review_id =%s ",(rating, review_text, review_id))
        conn.commit()
        return{"message":"Review has been updated"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
             if 'cursor' in locals():
                 cursor.close()

