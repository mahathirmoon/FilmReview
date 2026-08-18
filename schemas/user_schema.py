from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# 1. Registration Schema (Stays the same)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    username:Optional[str] = None
    email: Optional[EmailStr] = None
    password_hash:Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr  # <-- Changed from username to email
    password: str = Field(..., max_length=72)    