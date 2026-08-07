import os
import firebase_admin
from firebase_admin import credentials, firestore, auth

def init_firebase():
    """Initialize Firebase Admin SDK and return Firestore client."""
    cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', 'serviceAccountKey.json')
    
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            'projectId': os.getenv('FIREBASE_PROJECT_ID'),
        })
    
    return firestore.client()

# Singleton Firestore client
db = init_firebase()

def get_user_score(user_id):
    doc = db.collection('users').document(user_id).get()
    if doc.exists:
        return doc.to_dict().get('green_score', 0)
    return 0

def update_user_score(user_id, new_score):
    db.collection('users').document(user_id).set({
        'green_score': new_score,
        'updated_at': firestore.SERVER_TIMESTAMP
    }, merge=True)
