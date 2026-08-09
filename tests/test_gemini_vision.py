import io
import json
import pytest
from unittest.mock import MagicMock, patch
from PIL import Image

def _make_app_client():
    from app import create_app
    app = create_app()
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret-key"
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["user_id"] = "test_vision_user"
        sess["email"] = "vision@ecosphere.com"
        sess["name"] = "Vision Test User"
    return client

def _minimal_jpeg_bytes():
    buf = io.BytesIO()
    img = Image.new("RGB", (3, 3), color=(100, 150, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()

@pytest.fixture
def mock_classifier():
    with patch("app.services.ai_service._classifier") as mock:
        # Also mock model availability to be True
        with patch("app.services.ai_service._model_available", True):
            yield mock

# ── Valid images mapping tests ───────────────────────────
@pytest.mark.parametrize("model_label,expected_category,expected_item", [
    ("plastic", "Plastic", "Plastic item"),
    ("paper", "Paper/Cardboard", "Paper item"),
    ("cardboard", "Paper/Cardboard", "Cardboard container"),
    ("metal", "Metal", "Metal object"),
    ("green-glass", "Glass", "Green glass bottle/jar"),
    ("biological", "Organic/Wet Waste", "Organic matter"),
    ("batteries", "Hazardous Waste", "Battery / Electronic chemical cell"),
    ("clothes", "Textile", "Clothing fabric"),
])
def test_local_classification_success(mock_classifier, model_label, expected_category, expected_item):
    from app.services.ai_service import analyze_waste_image
    
    # Mock model prediction
    mock_classifier.return_value = [{"label": model_label, "score": 0.85}]
    
    result = analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
    
    assert result["success"] is True
    assert result["category"] == expected_category
    assert result["item"] == expected_item
    assert result["confidence"] == 0.85
    assert result["recyclable"] is not None

# ── Confidence threshold tests ───────────────────────────
def test_local_classification_low_confidence(mock_classifier):
    from app.services.ai_service import analyze_waste_image
    
    # Score 0.45 (< 0.50) -> Rejected
    mock_classifier.return_value = [{"label": "plastic", "score": 0.45}]
    
    result = analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
    assert result["success"] is False
    assert result["error_type"] == "low_confidence"
    
    # Score 0.70 (0.50 - 0.79) -> Accepted but uncertain
    mock_classifier.return_value = [{"label": "plastic", "score": 0.70}]
    result = analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
    assert result["success"] is True
    assert result["is_uncertain"] is True
    assert result["reward_earned"] == 0

# ── Invalid/corrupted image tests ────────────────────────
def test_local_classification_invalid_bytes(mock_classifier):
    from app.services.ai_service import analyze_waste_image
    
    # Empty bytes
    result = analyze_waste_image(b"", "empty.jpg", "image/jpeg")
    assert result["success"] is False
    assert result["error_type"] == "invalid_upload"

    # None input
    result = analyze_waste_image(None, "none.jpg", "image/jpeg")
    assert result["success"] is False
    assert result["error_type"] == "invalid_upload"

    # Corrupt/unsupported format bytes
    result = analyze_waste_image(b"not-an-image-data", "bad.txt", "text/plain")
    assert result["success"] is False
    assert result["error_type"] == "invalid_upload"

# ── API Independence (works without keys) ───────────────
def test_api_independence(mock_classifier):
    # Set environment variables to blank to verify independence
    with patch.dict("os.environ", {"GEMINI_API_KEY": "", "OPENAI_API_KEY": ""}):
        from app.services.ai_service import analyze_waste_image
        mock_classifier.return_value = [{"label": "plastic", "score": 0.90}]
        
        result = analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
        assert result["success"] is True
        assert result["category"] == "Plastic"

# ── Route Integration Tests ──────────────────────────────
def test_scan_route_success(mock_classifier):
    mock_classifier.return_value = [{"label": "plastic", "score": 0.90}]
    client = _make_app_client()
    
    data = {
        "image": (io.BytesIO(_minimal_jpeg_bytes()), "test.jpg", "image/jpeg"),
        "user_id": "test_vision_user"
    }
    response = client.post("/api/scan", data=data, content_type="multipart/form-data")
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["success"] is True
    assert body["scan"]["category"] == "Plastic"
    assert body["scan"]["confidence"] == 0.90
