from pydantic import BaseModel, Field, EmailStr
from typing import Optional

# 1. Registration Schema (Stays the same)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

# 2. Login Schema (Stays the same)
class UserLogin(BaseModel):
    email: EmailStr  # <-- Changed from username to email
    password: str = Field(..., max_length=72)

# 3. UPDATED: Review Schema
class ReviewCreate(BaseModel):  
    film_id: int
    rating: int = Field(..., ge=1, le=5, description="Star rating from 1 to 5")
    review_text: str