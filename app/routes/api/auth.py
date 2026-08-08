import os
import requests
from flask import request, jsonify, session
from app.routes.api import api_bp
from app.services.firebase import db, verify_id_token
from app.services.gamification import get_user_profile
import hashlib
import uuid
import datetime

def hash_password(password):
    """Secure SHA256 password hashing for mock database."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@api_bp.route('/auth/register', methods=['POST'])
def register():
    """Register a new user in Firebase Auth or local Mock database."""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters."}), 400

    # Determine if we are running in mock database mode or real Firebase Admin
    from app.services.firebase import MockFirestoreClient
    is_mock = isinstance(db, MockFirestoreClient)

    if not is_mock:
        try:
            from firebase_admin import auth
            # Create user in Firebase Auth
            user_record = auth.create_user(
                email=email,
                password=password,
                display_name=name
            )
            uid = user_record.uid
            
            # Setup user profile in Firestore
            user_profile = {
                "name": name,
                "email": email,
                "green_score": 745,
                "xp": 3820,
                "coins": 450,
                "streak": 6,
                "rank": 4,
                "completed_challenges": [],
                "inventory": [],
                "created_at": datetime.datetime.utcnow().isoformat()
            }
            db.collection('users').document(uid).set(user_profile)
            
            return jsonify({
                "success": True, 
                "message": "User registered successfully! Redirecting to login..."
            })
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 400
    else:
        # Mock registration process
        doc_id = "mock_" + email.replace("@", "_").replace(".", "_")
        doc_ref = db.collection('users').document(doc_id)
        doc = doc_ref.get()

        if doc.exists:
            return jsonify({"success": False, "message": "A user with this email already exists."}), 400

        user_profile = {
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "green_score": 745,
            "xp": 3820,
            "coins": 450,
            "streak": 6,
            "rank": 4,
            "completed_challenges": [],
            "inventory": [],
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        doc_ref.set(user_profile)

        return jsonify({
            "success": True, 
            "message": "User registered successfully in local database! Redirecting to login..."
        })

@api_bp.route('/auth/login', methods=['POST'])
def login():
    """Manual password verification primarily for Mock development database."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    from app.services.firebase import MockFirestoreClient
    is_mock = isinstance(db, MockFirestoreClient)

    if not is_mock:
        api_key = os.getenv('FIREBASE_API_KEY')
        if not api_key:
            return jsonify({"success": False, "message": "Firebase API Key not configured."}), 500

        try:
            url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
            payload = {
                "email": email,
                "password": password,
                "returnSecureToken": True
            }
            resp = requests.post(url, json=payload)
            resp_data = resp.json()

            if "error" in resp_data:
                return jsonify({"success": False, "message": "Invalid email or password."}), 401
            
            uid = resp_data["localId"]
            
            # Write session details
            session['user_id'] = uid
            session['email'] = email
            
            doc = db.collection('users').document(uid).get()
            name = "User"
            if doc.exists:
                name = doc.to_dict().get('name', 'User')
            
            session['name'] = name

            return jsonify({
                "success": True,
                "message": "Log in successful.",
                "user": {
                    "uid": uid,
                    "email": email,
                    "name": name
                }
            })
        except Exception as e:
            return jsonify({"success": False, "message": f"Login failed: {str(e)}"}), 500

    doc_id = "mock_" + email.replace("@", "_").replace(".", "_")
    doc_ref = db.collection('users').document(doc_id)
    doc = doc_ref.get()

    if not doc.exists:
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    user_data = doc.to_dict()
    saved_hash = user_data.get("password_hash")

    if not saved_hash or saved_hash != hash_password(password):
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    # Write session details
    session['user_id'] = doc_id
    session['email'] = email
    session['name'] = user_data.get('name', 'User')

    return jsonify({
        "success": True,
        "message": "Log in successful.",
        "user": {
            "uid": doc_id,
            "email": email,
            "name": user_data.get('name')
        }
    })

@api_bp.route('/auth/session', methods=['POST'])
def create_session():
    """Receive Firebase client token, verify it, and save Flask cookie session."""
    data = request.get_json() or {}
    id_token = data.get('id_token')

    if not id_token:
        return jsonify({"success": False, "message": "Missing ID token."}), 400

    try:
        decoded_token = verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email')
        name = decoded_token.get('name', 'User')

        # Keep session synchronized
        session['user_id'] = uid
        session['email'] = email
        session['name'] = name

        # Ensure user document is initialized in database
        profile = get_user_profile(uid)
        if profile.get('name') != name:
            db.collection('users').document(uid).update({"name": name})

        return jsonify({
            "success": True,
            "message": "Session created successfully.",
            "user": {
                "uid": uid,
                "email": email,
                "name": name
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"Verification failed: {str(e)}"}), 401

@api_bp.route('/auth/logout', methods=['POST'])
def logout():
    """Clear cookies and end session."""
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully."})

@api_bp.route('/auth/me', methods=['GET'])
def get_current_user():
    """Retrieve logged in user information."""
    user_id = session.get('user_id')
    if user_id:
        return jsonify({
            "logged_in": True,
            "user": {
                "user_id": user_id,
                "email": session.get('email'),
                "name": session.get('name')
            }
        })
    return jsonify({"logged_in": False})

@api_bp.route('/auth/reset', methods=['POST'])
def reset_password():
    """Send reset password email (Mock request)."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400
        
    return jsonify({
        "success": True,
        "message": f"Password reset email dispatched to {email}."
    })

