from fastapi import Header, HTTPException, Depends
from database import get_db

# This is our Security Guard function
def get_current_user(x_session_token: str = Header(...), conn = Depends(get_db)):
    """
    Intercepts the request, looks for 'x-session-token' in the headers,
    and checks if it exists in the database.
    """
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Check who owns this token
        cursor.execute("SELECT user_id,email,username FROM Users WHERE session_token = %s", (x_session_token,))
        user = cursor.fetchone()
        
        if not user:
            # If the token is fake or expired, kick them out immediately
            raise HTTPException(status_code=401, detail="Invalid or missing session token.")
            
        # If they pass the check, hand the user's data to the actual route!
        return user
        
    finally:
        cursor.close()