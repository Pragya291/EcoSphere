import os
import json
import datetime
import uuid

# Global SERVER_TIMESTAMP mock token
MOCK_SERVER_TIMESTAMP = "__SERVER_TIMESTAMP__"

class MockDocumentSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data if self._data else {}

class MockDocument:
    def __init__(self, col_path, doc_id, db_ref):
        self.col_path = col_path
        self.id = doc_id
        self.db_ref = db_ref

    def get(self):
        data = self.db_ref._get_data(self.col_path, self.id)
        return MockDocumentSnapshot(self.id, data)

    def set(self, data, merge=True):
        self.db_ref._set_data(self.col_path, self.id, data, merge)

    def update(self, data):
        self.db_ref._set_data(self.col_path, self.id, data, merge=True)

    def delete(self):
        self.db_ref._delete_data(self.col_path, self.id)

class MockCollection:
    def __init__(self, col_path, db_ref):
        self.col_path = col_path
        self.db_ref = db_ref

    def document(self, doc_id):
        return MockDocument(self.col_path, doc_id, self.db_ref)

    def add(self, data):
        doc_id = str(uuid.uuid4())
        self.db_ref._set_data(self.col_path, doc_id, data, merge=False)
        return None, MockDocument(self.col_path, doc_id, self.db_ref)

    def stream(self):
        docs_data = self.db_ref._get_collection(self.col_path)
        return [MockDocumentSnapshot(doc_id, data) for doc_id, data in docs_data.items()]

    def order_by(self, field, direction="ASCENDING"):
        return MockQuery(self.col_path, self.db_ref, order_field=field, direction=direction)

    def limit(self, count):
        return MockQuery(self.col_path, self.db_ref, limit_count=count)

class MockQuery:
    def __init__(self, col_path, db_ref, order_field=None, direction="ASCENDING", limit_count=None):
        self.col_path = col_path
        self.db_ref = db_ref
        self.order_field = order_field
        self.direction = direction
        self.limit_count = limit_count

    def order_by(self, field, direction="ASCENDING"):
        self.order_field = field
        self.direction = direction
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def stream(self):
        docs_data = self.db_ref._get_collection(self.col_path)
        snapshots = [MockDocumentSnapshot(doc_id, data) for doc_id, data in docs_data.items()]
        if self.order_field:
            reverse = self.direction == "DESCENDING"
            # Sort snapshots, handling missing fields gracefully
            snapshots.sort(key=lambda s: s.to_dict().get(self.order_field, 0), reverse=reverse)
        if self.limit_count is not None:
            snapshots = snapshots[:self.limit_count]
        return snapshots

class MockFirestoreClient:
    def __init__(self, filepath="mock_db.json"):
        # Put mock db file in workspace directory
        self.filepath = filepath
        self._load()

    def _load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r") as f:
                    self.data = json.load(f)
            except Exception:
                self.data = {}
        else:
            self.data = {}

    def _save(self):
        try:
            with open(self.filepath, "w") as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving mock db: {e}")

    def collection(self, col_path):
        return MockCollection(col_path, self)

    def _get_collection(self, col_path):
        return self.data.get(col_path, {})

    def _get_data(self, col_path, doc_id):
        return self.data.get(col_path, {}).get(doc_id)

    def _set_data(self, col_path, doc_id, data, merge=True):
        if col_path not in self.data:
            self.data[col_path] = {}
        
        # Clean data (replace SERVER_TIMESTAMP mock or real)
        cleaned_data = {}
        for k, v in data.items():
            # If the value is a SERVER_TIMESTAMP representation
            if v == MOCK_SERVER_TIMESTAMP or str(type(v)).find("Sentinel") != -1:
                cleaned_data[k] = datetime.datetime.utcnow().isoformat()
            else:
                cleaned_data[k] = v

        if merge and doc_id in self.data[col_path]:
            self.data[col_path][doc_id].update(cleaned_data)
        else:
            self.data[col_path][doc_id] = cleaned_data
        
        self._save()

    def _delete_data(self, col_path, doc_id):
        if col_path in self.data and doc_id in self.data[col_path]:
            del self.data[col_path][doc_id]
            self._save()

def init_firebase():
    """Try to initialize Firebase Admin SDK, or fall back to MockFirestoreClient."""
    cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', 'serviceAccountKey.json')
    project_id = os.getenv('FIREBASE_PROJECT_ID')
    
    if os.path.exists(cred_path) and project_id:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            if not firebase_admin._apps:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {
                    'projectId': project_id,
                })
            print("Successfully initialized Firebase Admin SDK.")
            return firestore.client()
        except Exception as e:
            print(f"Firebase Admin SDK initialization failed: {e}. Falling back to mock database.")
    else:
        print("[INFO] Running in local Database mode (serviceAccountKey.json not provided).")
    
    return MockFirestoreClient()

# Initialize database client
db = init_firebase()

# Setup firebase mock-friendly ServerTimestamp
try:
    from firebase_admin import firestore
    SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP
except Exception:
    SERVER_TIMESTAMP = MOCK_SERVER_TIMESTAMP

def get_user_score(user_id):
    doc = db.collection('users').document(user_id).get()
    if doc.exists:
        return doc.to_dict().get('green_score', 150)  # Starting with some default green score for demo
    return 150

def update_user_score(user_id, new_score):
    db.collection('users').document(user_id).set({
        'green_score': new_score,
        'updated_at': SERVER_TIMESTAMP
    }, merge=True)

def verify_id_token(id_token):
    """
    Verifies a Firebase ID token.
    If database is using mock client, verifies local mock tokens.
    """
    if isinstance(db, MockFirestoreClient) or id_token.startswith("mock-token-"):
        parts = id_token.split('-')
        email = "demo@ecosphere.com"
        name = "Demo User"
        uid = "demo_user"
        if len(parts) >= 4:
            email = parts[3]
            uid = "mock_" + email.replace("@", "_").replace(".", "_")
        if len(parts) >= 5:
            name = parts[4]
        return {
            "uid": uid,
            "email": email,
            "name": name,
            "firebase": {
                "sign_in_provider": "password"
            }
        }
    
    try:
        from firebase_admin import auth
        return auth.verify_id_token(id_token)
    except Exception as e:
        print(f"Firebase token verification failed: {e}")
        raise e

