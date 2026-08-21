from pydantic import BaseModel,Field

class postReview(BaseModel):
    film_id:int
    rating:float = Field(...,ge=1,le=5,description="Star rating from 1 to 5")
    review_text:str


    