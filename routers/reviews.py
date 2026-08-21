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

