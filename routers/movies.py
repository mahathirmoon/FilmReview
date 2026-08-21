from fastapi import APIRouter,HTTPException,Query,Depends
from typing import Optional
from database import get_db


router = APIRouter(
    prefix="/movies",
    tags=["Movies"]
)

@router.get("/homepage")
def get_homepage_movies(
    # The frontend generates a random integer once, and passes it to every page request
    seed: int = Query(..., description="A seed number to keep the random order consistent across pages"),
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    limit: int = Query(20, description="How many records to return (LIMIT)", le=50),
    conn = Depends(get_db)
    
):
    """
    Feeds the home screen with a randomized list of movies, safely paginated using a seed.
    """
    try:
        cursor = conn.cursor(dictionary=True)

        # Calculate OFFSET from page
        offset = (page - 1) * limit
        

        random_query = """
            SELECT film_id, title, release_year, avg_rating, poster_url 
            FROM Films
            WHERE release_year>=2015
            ORDER BY release_year DESC, RAND(%s)
            LIMIT %s OFFSET %s
        """

        cursor.execute(random_query, (seed, limit, offset))
        random_movies = cursor.fetchall()

        return {
            "page": page,
            "limit": limit,
            "results": random_movies,
            "next_page": f"/homepage?seed={seed}&page={page+1}&limit={limit}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()




@router.get("/search")
def search_movies(
    title: Optional[str] = Query(None, description="Search by movie title"),
    year: Optional[int] = Query(None, description="Filter by release year"),
    genre: Optional[str] = Query(None, description="Filter by genre name"),
    sort_by: str = Query("rating", description="Sort by: title, year, or rating"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    
    page: int = Query(1,ge=1, description="Page Number"),
    limit: int = Query(20, description="How many records to return", le=100),
    conn = Depends(get_db) 
):
    try:
        offset = (page - 1) * limit
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT DISTINCT Films.film_id, Films.title, Films.release_year, Films.avg_rating, Films.poster_url
            FROM Films
        """
        conditions = []
        params = []
        
        if genre:
            query += """
                JOIN Film_Genres ON Films.film_id = Film_Genres.film_id
                JOIN Genres ON Film_Genres.genre_id = Genres.genre_id
            """
            conditions.append("Genres.name = %s")
            params.append(genre)
            
        if title:
            conditions.append("Films.title LIKE %s")
            params.append(f"%{title}%")
            
        if year:
            conditions.append("Films.release_year = %s")
            params.append(year)
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        # --- NEW: SECURE SORTING LOGIC ---
        
        # 1. The Whitelist Dictionary
        allowed_sort_columns = {
            "title": "Films.title",
            "year": "Films.release_year",
            "rating": "Films.avg_rating"
        }
        
        # 2. Get the safe column name (Defaults to rating if the user types something invalid)
        safe_column = allowed_sort_columns.get(sort_by.lower(), "Films.avg_rating")
        
        # 3. Strictly enforce ASC or DESC
        safe_order = "ASC" if sort_order.lower() == "asc" else "DESC"
        
        # 4. Safely format the string because we 100% control the variables now
        query += f" ORDER BY {safe_column} {safe_order} LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        # ---------------------------------
        
        cursor.execute(query, tuple(params))
        movies = cursor.fetchall()

        if not movies:
            movies = ["No Movie Found"]
        
        
        return movies
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()



@router.get("/{id}")
def movie(id:int,conn = Depends(get_db)):
    """
        gets all the details about a single movie
        """
    try:
        cursor = conn.cursor(dictionary=True)
        query = """

            SELECT *
            FROM films
            Where film_id=%s
            """
        cursor.execute(query,(id,))
        movie = cursor.fetchone()

        if not movie:
            raise HTTPException(status_code=404, detail="Movie not found")

        reviews_query = """
           SELECT reviews.review_id, users.username, reviews.rating, reviews.review_text, reviews.created_at
    FROM reviews
    JOIN users ON reviews.user_id = users.user_id
    WHERE reviews.film_id = %s
    ORDER BY reviews.created_at DESC
        """
        cursor.execute(reviews_query,(id,))
        movie["reviews"] = cursor.fetchall()


        cast_q="""

                SELECT people.name ,film_cast.role_name
                From film_cast
                JOIN people ON film_cast.person_id = people.person_id
                WHERE film_cast.film_id = %s
                

                """
        cursor.execute(cast_q,(id,))
        movie["cast"] = cursor.fetchall()

        # 3. Fetch the Genres (The Missing Piece!)
        genre_query = """
            SELECT genres.name 
            FROM film_genres
            JOIN genres ON film_genres.genre_id = genres.genre_id
            WHERE film_genres.film_id = %s
        """
        cursor.execute(genre_query, (id,))

        genres = []
        for g in cursor.fetchall():
            genres.append(g["name"])

        movie["genres"]=genres

        return movie

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()






    
    