import pytest
import json
import uuid
from app import create_app
from app.services.firebase import db

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    with app.test_client() as client:
        yield client

@pytest.fixture(autouse=True)
def clear_db():
    try:
        db.collection('users').document('mock_alex_mercer_ecosphere_com').delete()
        db.collection('users').document('mock_oauth_google').delete()
        db.collection('users').document('mock_google_user_ecosphere_com').delete()
        db.collection('users').document('test_suite_user').delete()
    except Exception:
        pass


def test_auth_flow(client):
    """Test full registration, login, session check, and logout cycle."""
    
    # 1. Initially user should not be logged in
    res = client.get('/api/auth/me')
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['logged_in'] is False

    # 2. Register a new user with a unique email so repeated test runs do not collide
    random_id = uuid.uuid4().hex[:8]
    user_payload = {
        "name": "Alex Mercer",
        "email": f"alex.mercer+{random_id}@ecosphere.com",
        "password": "securepassword123"
    }
    res = client.post('/api/auth/register', json=user_payload)
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['success'] is True

    # 3. Registering again with same email should fail
    res = client.post('/api/auth/register', json=user_payload)
    assert res.status_code == 400
    data = json.loads(res.data)
    assert data['success'] is False

    # 4. Login with incorrect password should fail
    login_fail_payload = {
        "email": "alex.mercer@ecosphere.com",
        "password": "wrongpassword"
    }
    res = client.post('/api/auth/login', json=login_fail_payload)
    assert res.status_code == 401
    data = json.loads(res.data)
    assert data['success'] is False

    # 5. Login with correct password should pass and set session
    login_success_payload = {
        "email": "alex.mercer@ecosphere.com",
        "password": "securepassword123"
    }
    res = client.post('/api/auth/login', json=login_success_payload)
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['success'] is True
    assert data['user']['email'] == "alex.mercer@ecosphere.com"

    # 6. Current user should be logged in now
    res = client.get('/api/auth/me')
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['logged_in'] is True
    assert data['user']['email'] == "alex.mercer@ecosphere.com"

    # 7. Logout should clear session
    res = client.post('/api/auth/logout')
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['success'] is True

    # 8. Should be logged out
    res = client.get('/api/auth/me')
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['logged_in'] is False

def test_oauth_session(client):
    """Test token verification session generation."""
    # Test POSTing a mock oauth token
    token = "mock-token-google-google_user@ecosphere.com-Google Champion"
    res = client.post('/api/auth/session', json={"id_token": token})
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['success'] is True
    assert data['user']['email'] == "google_user@ecosphere.com"
    assert data['user']['name'] == "Google Champion"

    # Verify session is active
    res = client.get('/api/auth/me')
    data = json.loads(res.data)
    assert data['logged_in'] is True
    assert data['user']['email'] == "google_user@ecosphere.com"

def test_reset_password(client):
    """Test requesting a password reset email."""
    res = client.post('/api/auth/reset', json={"email": "user@ecosphere.com"})
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data['success'] is True

