from pydantic import BaseModel, EmailStr, Field
from typing import Optional



# 1. Registration Schema (Stays the same)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password:str = Field(..., min_length=6, max_length=12, description="Password must be between 6-12 characters long")

class UserProfileUpdate(BaseModel):
    username:Optional[str] = None
    email: Optional[EmailStr] = None
    password_hash:Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr  # <-- Changed from username to email
    password: str = Field(..., max_length=12)    