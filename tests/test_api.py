import pytest
import json
from app import create_app
from app.services.firebase import db

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess['user_id'] = 'test_suite_user'
            sess['email'] = 'test@ecosphere.com'
            sess['name'] = 'Test Suite User'
        yield client

def test_index_page(client):
    """Test landing page renders successfully."""
    response = client.get('/')
    assert response.status_code == 200

def test_score_endpoints(client):
    """Test retrieving and updating green scores."""
    # Test GET
    response = client.get('/api/score?user_id=test_suite_user')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'score' in data
    
    # Test POST
    response = client.post('/api/score', json={'user_id': 'test_suite_user', 'points': 50})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'new_score' in data

def test_challenges_endpoints(client):
    """Test retrieving and completing daily challenges."""
    # Test GET
    response = client.get('/api/challenges?user_id=test_suite_user')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'challenges' in data
    assert len(data['challenges']) > 0

    # Test POST complete
    response = client.post('/api/challenges/complete', json={
        'user_id': 'test_suite_user',
        'challenge_id': 'water_conservation'
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'profile' in data

def test_tips_and_log_endpoints(client):
    """Test listing tips and logging manual eco activities."""
    # Test GET tips
    response = client.get('/api/tips')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'habits' in data

    # Test POST log action
    response = client.post('/api/tips/log', json={
        'user_id': 'test_suite_user',
        'activity_type': 'bike_or_walk',
        'quantity': 5.0
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'savings' in data
    assert data['savings']['co2'] > 0

def test_mentor_chat(client):
    """Test chat queries with the Eco Coach assistant."""
    response = client.post('/api/mentor', json={
        'user_id': 'test_suite_user',
        'message': 'Tell me about solar energy optimizations',
        'history': []
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'response' in data
    assert len(data['response']) > 0

def test_passport_and_redeem(client):
    """Test passport profiles, leaderboards and marketplace redemptions."""
    # Test GET passport
    response = client.get('/api/passport?user_id=test_suite_user')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'profile' in data
    assert 'leaderboard_global' in data
    assert 'marketplace_items' in data

    # Give user coins first so they can redeem
    client.post('/api/score', json={'user_id': 'test_suite_user', 'points': 500})
    
    # Test POST redeem
    response = client.post('/api/passport/redeem', json={
        'user_id': 'test_suite_user',
        'item_id': 'plant_tree'
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'success' in data

def test_timeline_forecast(client):
    """Test Twin predictions forecasting."""
    response = client.get('/api/timeline')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'forecast' in data
    assert 'milestones' in data

def test_scan_waste(client):
    """Test scanning image files."""
    response = client.post('/api/scan', json={
        'user_id': 'test_suite_user',
        'image': 'data:image/jpeg;base64,dGVzdGltYWdl',  # dummy base64
        'filename': 'plastic_bottle.jpg'
      })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert data['scan']['material'] == "PET Plastic Bottle"

def test_scan_receipt(client):
    """Test scanning a grocery receipt."""
    response = client.post('/api/scan/receipt', json={
        'user_id': 'test_suite_user',
        'image': 'data:image/jpeg;base64,dGVzdHJlY2VpcHQ=',  # dummy base64
        'filename': 'grocery_receipt.jpg'
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'result' in data
    assert 'items' in data['result']
    assert len(data['result']['items']) > 0
    assert 'total_carbon' in data['result']

