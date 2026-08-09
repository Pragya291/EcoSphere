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
    """Test landing page renders successfully with dynamic firebase_config."""
    response = client.get('/')
    assert response.status_code == 200
    html = response.data.decode('utf-8')
    assert 'const firebaseConfig =' in html


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
    """Test scanning image files via FormData multipart upload."""
    import io
    from unittest.mock import patch
    from app.services import ai_service as svc
    from PIL import Image as PILImage

    buf = io.BytesIO()
    PILImage.new("RGB", (10, 10), color=(200, 100, 50)).save(buf, format="JPEG")
    buf.seek(0)

    mock_result = {
        "is_waste": True, "category": "Plastic", "item": "plastic bottle",
        "material": "plastic bottle", "confidence": 0.94,
        "disposal_method": "Recyclable", "bin": "Dry Waste / Recycling",
        "reason": "Clear plastic bottle.", "environmental_tip": "Rinse before recycling.",
        "multiple_objects": [], "is_uncertain": False, "recyclable": True,
        "reward_earned": 50, "eco_alternative": "Use reusable bottle.",
        "explanation": "Clear plastic bottle.", "environmental_impact": "Low",
        "reuse_ideas": [], "repair_ideas": [], "decomposition_time": "450 years",
        "co2_impact": -0.08, "disposal_recommendation": "Rinse and recycle.",
    }

    with patch("app.routes.api.scan.analyze_waste_image", return_value=mock_result):
        response = client.post(
            '/api/scan',
            data={
                "image": (buf, "plastic_bottle.jpg", "image/jpeg"),
                "user_id": "test_suite_user",
                "scan_id": "test_scan_001",
            },
            content_type="multipart/form-data"
        )

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert data['scan_id'] == 'test_scan_001'
    assert 'item' in data['scan']
    assert 'category' in data['scan']
    assert 'bin' in data['scan']
    assert 'confidence' in data['scan']


def test_scan_waste_structured_schema(client):
    """Test that scan route returns all required structured vision classification fields."""
    import io
    from unittest.mock import patch
    from app.services import ai_service as svc
    from PIL import Image as PILImage

    buf = io.BytesIO()
    PILImage.new("RGB", (10, 10), color=(180, 180, 180)).save(buf, format="JPEG")
    buf.seek(0)

    mock_result = {
        "is_waste": True, "category": "Metal", "item": "aluminum can",
        "material": "aluminum can", "confidence": 0.91,
        "disposal_method": "Recyclable", "bin": "Dry Waste / Recycling",
        "reason": "Aluminum can visible.", "environmental_tip": "Crush and recycle.",
        "multiple_objects": [], "is_uncertain": False, "recyclable": True,
        "reward_earned": 50, "eco_alternative": "Refillable bottle.",
        "explanation": "Aluminum can visible.", "environmental_impact": "Low",
        "reuse_ideas": [], "repair_ideas": [], "decomposition_time": "80-200 years",
        "co2_impact": -0.1, "disposal_recommendation": "Crush and put in recycle bin.",
    }

    with patch("app.routes.api.scan.analyze_waste_image", return_value=mock_result):
        response = client.post(
            '/api/scan',
            data={
                "image": (buf, "aluminum_can.jpg", "image/jpeg"),
                "user_id": "test_suite_user",
                "scan_id": "test_scan_003",
            },
            content_type="multipart/form-data"
        )

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    scan = data['scan']
    assert 'is_waste' in scan
    assert 'category' in scan
    assert 'item' in scan
    assert 'confidence' in scan
    assert 'disposal_method' in scan
    assert 'bin' in scan
    assert 'reason' in scan
    assert 'environmental_tip' in scan
    assert 'multiple_objects' in scan

def test_scan_empty_image_validation(client):
    """Test that empty or missing image payload returns 400 error."""
    response = client.post('/api/scan', json={
        'user_id': 'test_suite_user',
        'scan_id': 'test_scan_004',
        'filename': 'empty.jpg'
    })
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['success'] is False
    assert 'error' in data

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
