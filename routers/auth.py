from fastapi import APIRouter, HTTPException, Depends
from passlib.context import CryptContext
import secrets  
from database import get_db
from schemas.user_schema import UserCreate, UserLogin

router = APIRouter(prefix="/auth", tags=["Authentication"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/register")
def register_user(user: UserCreate, conn = Depends(get_db)):
    try:
        cursor = conn.cursor(dictionary=True)
        
        checkin = "SELECT * FROM Users WHERE username=%s OR email = %s"
        # FIXED: Variables must be passed as a tuple inside ( ) 
        cursor.execute(checkin, (user.username, user.email))
        
        # FIXED: Added () to fetchone to actually call the function
        if cursor.fetchone():
            # FIXED: 'detail' instead of 'details'
            raise HTTPException(status_code=400, detail="Given Username or Email already exists, silly")

        # FIXED: Typo in user.password
        hashed_pass = pwd_context.hash(user.password)
        
        instertion_query = "INSERT INTO Users (username, email, password_hash) VALUES (%s, %s, %s)"
        # FIXED: Variables passed as a tuple inside ( )
        cursor.execute(instertion_query, (user.username, user.email, hashed_pass))
        
        conn.commit()
        return {"message": "User account created successfully!"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()

@router.post("/login")
def login_user(user_credentials: UserLogin, conn = Depends(get_db)):
    """
    Verifies credentials by EMAIL, generates a secure session token, and saves it to the DB.
    """
    try:
        cursor = conn.cursor(dictionary=True)
        
        # 1. Look up the user by their EMAIL instead of username
        cursor.execute("SELECT * FROM Users WHERE email = %s", (user_credentials.email,))
        user = cursor.fetchone()
        
        # 2. Update the error message so it says "email" instead of "username"
        if not user or not pwd_context.verify(user_credentials.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        # 3. Generate the Session Token
        secure_token = secrets.token_hex(16)
        
        # 4. Save the token in the database
        update_query = "UPDATE Users SET session_token = %s WHERE user_id = %s"
        cursor.execute(update_query, (secure_token, user['user_id']))
        conn.commit() 
        
        # 5. Success! 
        # We can still return their username in the response to say hello on the front-end!
        return {
            "message": "Login successful!",
            "token": secure_token,
            "username": user['username'] 
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()