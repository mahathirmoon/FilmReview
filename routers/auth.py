from fastapi import APIRouter, HTTPException, Depends
from passlib.context import CryptContext
import secrets

from database import get_db
from schemas.user_schema import UserCreate, UserLogin


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


@router.post("/register")
def register_user(
    user: UserCreate,
    conn=Depends(get_db)
):
    cursor = None

    try:
        cursor = conn.cursor(dictionary=True)

        if len(user.password.encode("utf-8")) > 72:
            raise HTTPException(
                status_code=400,
                detail="Password cannot be longer than 72 bytes"
            )

        cursor.execute(
            """
            SELECT user_id
            FROM Users
            WHERE username = %s OR email = %s
            """,
            (user.username, user.email)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username or email already exists"
            )

        hashed_password = pwd_context.hash(user.password)

        cursor.execute(
            """
            INSERT INTO Users
            (username, email, password_hash)
            VALUES (%s, %s, %s)
            """,
            (
                user.username,
                user.email,
                hashed_password
            )
        )

        conn.commit()

        return {
            "message": "User account created successfully!"
        }

    except HTTPException:
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if cursor:
            cursor.close()


@router.post("/login")
def login_user(
    user_credentials: UserLogin,
    conn=Depends(get_db)
):
    cursor = None

    try:
        cursor = conn.cursor(dictionary=True)

        if len(user_credentials.password.encode("utf-8")) > 72:
            raise HTTPException(
                status_code=400,
                detail="Password cannot be longer than 72 bytes"
            )

        cursor.execute(
            """
            SELECT user_id, username, email, password_hash
            FROM Users
            WHERE email = %s
            """,
            (user_credentials.email,)
        )

        user = cursor.fetchone()

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        password_correct = pwd_context.verify(
            user_credentials.password,
            user["password_hash"]
        )

        if not password_correct:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        secure_token = secrets.token_hex(16)

        cursor.execute(
            """
            UPDATE Users
            SET session_token = %s
            WHERE user_id = %s
            """,
            (
                secure_token,
                user["user_id"]
            )
        )

        conn.commit()

        return {
            "message": "Login successful!",
            "token": secure_token,
            "username": user["username"]
        }

    except HTTPException:
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if cursor:
            cursor.close()