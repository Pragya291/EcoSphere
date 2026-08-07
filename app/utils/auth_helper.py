from functools import wraps
from flask import session, jsonify

def login_required(f):
    """
    Flask decorator to protect REST API routes.
    Verifies that 'user_id' exists in the Flask session cookie.
    Returns 401 Unauthorized if not logged in.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({
                "success": False,
                "message": "Authentication required. Please log in to continue."
            }), 401
        return f(*args, **kwargs)
    return decorated_function
