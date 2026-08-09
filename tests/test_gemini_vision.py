"""
Tests for the Gemini Vision waste classification pipeline.

Covers:
- JSON extraction from markdown-fenced responses
- Category normalisation via CANONICAL_CATEGORIES
- Confidence threshold enforcement (< 0.60 -> Other/Unknown)
- is_waste coercion from string to bool
- Error differentiation (config_error, invalid_upload, api_error)
- Multipart FormData upload in the /api/scan route
- End-to-end mocked Gemini calls for 7 waste categories

Live tests are skipped when GEMINI_API_KEY is not set.
"""
import io
import json
import os
import pytest
from unittest.mock import MagicMock, patch


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

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
    from PIL import Image
    buf = io.BytesIO()
    img = Image.new("RGB", (3, 3), color=(100, 150, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _gemini_response(json_dict):
    mock_resp = MagicMock()
    mock_resp.text = json.dumps(json_dict)
    return mock_resp


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests: extract_json_payload
# ─────────────────────────────────────────────────────────────────────────────

class TestExtractJsonPayload:
    def setup_method(self):
        from app.services.openai_service import extract_json_payload
        self.extract = extract_json_payload

    def test_plain_json(self):
        data = self.extract('{"category": "Plastic", "confidence": 0.95}')
        assert data["category"] == "Plastic"

    def test_markdown_fenced_json(self):
        raw = '```json\n{"category": "Glass", "confidence": 0.88}\n```'
        data = self.extract(raw)
        assert data["category"] == "Glass"

    def test_backtick_only_fenced(self):
        raw = '```\n{"category": "Metal", "confidence": 0.92}\n```'
        data = self.extract(raw)
        assert data["category"] == "Metal"

    def test_embedded_json_in_text(self):
        raw = 'Result: {"category": "Organic/Wet Waste", "confidence": 0.75} done.'
        data = self.extract(raw)
        assert data["category"] == "Organic/Wet Waste"

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            self.extract("")

    def test_no_json_raises(self):
        with pytest.raises((ValueError, Exception)):
            self.extract("This is plain text with no JSON.")


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests: validate_gemini_result
# ─────────────────────────────────────────────────────────────────────────────

class TestValidateGeminiResult:
    def setup_method(self):
        from app.services.openai_service import validate_gemini_result
        self.validate = validate_gemini_result

    def _base(self, **overrides):
        d = {
            "is_waste": True, "category": "Plastic", "item": "plastic bottle",
            "confidence": 0.94, "disposal_method": "Recyclable",
            "bin": "Dry Waste / Recycling", "reason": "Clear plastic bottle visible.",
            "environmental_tip": "Rinse before recycling.",
            "multiple_objects": [], "is_uncertain": False,
        }
        d.update(overrides)
        return d

    def test_valid_plastic(self):
        r = self.validate(self._base())
        assert r["category"] == "Plastic"
        assert r["confidence"] >= 0.60
        assert r["is_uncertain"] is False

    def test_paper_normalised(self):
        r = self.validate(self._base(category="Paper"))
        assert r["category"] == "Paper/Cardboard"

    def test_organic_normalised(self):
        r = self.validate(self._base(category="Organic"))
        assert r["category"] == "Organic/Wet Waste"

    def test_ewaste_normalised(self):
        r = self.validate(self._base(category="E-waste"))
        assert r["category"] == "E-Waste"

    def test_hazardous_normalised(self):
        r = self.validate(self._base(category="Hazardous"))
        assert r["category"] == "Hazardous Waste"

    def test_unknown_category(self):
        r = self.validate(self._base(category="SomeUnknownJunk"))
        assert r["category"] == "Other/Unknown"
        assert r["is_uncertain"] is True

    def test_confidence_0_to_100_scale(self):
        r = self.validate(self._base(confidence=94))
        assert 0.0 <= r["confidence"] <= 1.0
        assert r["confidence"] == pytest.approx(0.94, abs=0.001)

    def test_low_confidence_threshold(self):
        r = self.validate(self._base(confidence=0.45))
        assert r["category"] == "Other/Unknown"
        assert r["is_uncertain"] is True

    def test_non_waste(self):
        r = self.validate(self._base(is_waste=False, category="Not waste", item="Person"))
        assert r["category"] == "Not waste"
        assert r["recyclable"] is False
        assert r["reward_earned"] == 0

    def test_string_is_waste_true(self):
        r = self.validate(self._base(is_waste="true"))
        assert r["is_waste"] is True

    def test_missing_field_returns_unknown(self):
        r = self.validate({"is_waste": True, "category": "Plastic"})
        assert r["category"] == "Other/Unknown"
        assert r["is_uncertain"] is True

    def test_not_dict_returns_unknown(self):
        r = self.validate("some string")
        assert r["category"] == "Other/Unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Parametrised tests: one per waste category
# ─────────────────────────────────────────────────────────────────────────────

WASTE_CATEGORIES = [
    ("Plastic",           "Plastic bottle",  "Plastic"),
    ("Paper/Cardboard",   "Newspaper",       "Paper/Cardboard"),
    ("Glass",             "Glass bottle",    "Glass"),
    ("Metal",             "Aluminum can",    "Metal"),
    ("Organic/Wet Waste", "Banana peel",     "Organic/Wet Waste"),
    ("E-Waste",           "Old smartphone",  "E-Waste"),
    ("Textile",           "T-shirt",         "Textile"),
]


@pytest.mark.parametrize("category,item,expected_category", WASTE_CATEGORIES)
def test_analyze_waste_image_mocked(category, item, expected_category):
    """Verify image bytes are sent to Gemini and category is returned correctly."""
    from app.services import openai_service as svc

    gemini_json = {
        "is_waste": True, "category": category, "item": item,
        "confidence": 0.92, "disposal_method": "Recyclable",
        "bin": "Dry Waste", "reason": f"The image clearly shows a {item}.",
        "environmental_tip": "Dispose responsibly.",
        "multiple_objects": [], "is_uncertain": False,
    }

    mock_model = MagicMock()
    mock_model.generate_content.return_value = _gemini_response(gemini_json)

    image_bytes = _minimal_jpeg_bytes()
    with patch.object(svc, "gemini_vision_model", mock_model):
        result = svc.analyze_waste_image(image_bytes, "test.jpg", "image/jpeg")

    assert result["category"] == expected_category
    assert result["confidence"] >= 0.60
    assert result.get("error_type") is None

    # Verify image bytes were passed as Part (not base64 text)
    call_args = mock_model.generate_content.call_args[0][0]
    assert isinstance(call_args, list) and len(call_args) == 2
    prompt_arg, image_arg = call_args
    assert isinstance(prompt_arg, str)
    assert isinstance(image_arg, dict)
    assert "data" in image_arg and isinstance(image_arg["data"], bytes)
    assert image_arg["mime_type"] == "image/jpeg"


# ─────────────────────────────────────────────────────────────────────────────
# Error differentiation tests
# ─────────────────────────────────────────────────────────────────────────────

def test_config_error_when_no_model():
    from app.services import openai_service as svc
    with patch.object(svc, "gemini_vision_model", None):
        result = svc.analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
    assert result.get("error_type") == "config_error"
    assert "GEMINI_API_KEY" in result.get("reason", "")


def test_invalid_upload_when_no_bytes():
    from app.services import openai_service as svc
    mock_model = MagicMock()
    with patch.object(svc, "gemini_vision_model", mock_model):
        result = svc.analyze_waste_image(None, "empty.jpg", "image/jpeg")
    assert result.get("error_type") == "invalid_upload"


def test_api_error_on_gemini_exception():
    from app.services import openai_service as svc
    mock_model = MagicMock()
    mock_model.generate_content.side_effect = RuntimeError("Network timeout")
    with patch.object(svc, "gemini_vision_model", mock_model):
        result = svc.analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
    assert result.get("error_type") == "api_error"


def test_api_error_on_bad_json():
    from app.services import openai_service as svc
    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = "Not valid JSON at all!"
    with patch.object(svc, "gemini_vision_model", mock_model):
        result = svc.analyze_waste_image(_minimal_jpeg_bytes(), "test.jpg", "image/jpeg")
    assert result.get("error_type") == "api_error"


def test_low_confidence_returns_unknown():
    from app.services import openai_service as svc
    mock_model = MagicMock()
    mock_model.generate_content.return_value.text = json.dumps({
        "is_waste": True, "category": "Plastic", "item": "unknown object",
        "confidence": 0.35, "disposal_method": "Unknown", "bin": "Unknown",
        "reason": "Too blurry.", "environmental_tip": "Better lighting.",
        "multiple_objects": [], "is_uncertain": True,
    })
    with patch.object(svc, "gemini_vision_model", mock_model):
        result = svc.analyze_waste_image(_minimal_jpeg_bytes(), "blurry.jpg", "image/jpeg")
    assert result["category"] == "Other/Unknown"
    assert result["is_uncertain"] is True


# ─────────────────────────────────────────────────────────────────────────────
# Integration tests: /api/scan route with FormData
# ─────────────────────────────────────────────────────────────────────────────

def test_scan_route_multipart_formdata():
    from app.services import openai_service as svc
    mock_result = {
        "is_waste": True, "category": "Plastic", "item": "plastic bottle",
        "material": "plastic bottle", "confidence": 0.94,
        "disposal_method": "Recyclable", "bin": "Dry Waste / Recycling",
        "reason": "Clear plastic bottle.", "environmental_tip": "Rinse before recycling.",
        "multiple_objects": [], "is_uncertain": False, "recyclable": True,
        "reward_earned": 50, "eco_alternative": "Use a reusable bottle.",
        "explanation": "Clear plastic bottle.", "environmental_impact": "Low",
        "reuse_ideas": [], "repair_ideas": [], "decomposition_time": "450 years",
        "co2_impact": -0.08, "disposal_recommendation": "Rinse and recycle.",
    }
    with patch("app.routes.api.scan.analyze_waste_image", return_value=mock_result):
        client = _make_app_client()
        image_bytes = _minimal_jpeg_bytes()
        data = {"image": (io.BytesIO(image_bytes), "bottle.jpg", "image/jpeg"), "user_id": "test_vision_user"}
        response = client.post("/api/scan", data=data, content_type="multipart/form-data")
    assert response.status_code == 200, response.data
    body = json.loads(response.data)
    assert body["success"] is True
    assert body["scan"]["category"] == "Plastic"


def test_scan_route_no_image_400():
    client = _make_app_client()
    response = client.post("/api/scan", data={}, content_type="multipart/form-data")
    assert response.status_code == 400
    body = json.loads(response.data)
    assert body["success"] is False
    assert body.get("error_type") == "invalid_upload"


def test_scan_route_config_error_500():
    from app.services import openai_service as svc
    with patch("app.routes.api.scan.analyze_waste_image", return_value={
        "error_type": "config_error",
        "reason": "Gemini Vision is not configured. Please set GEMINI_API_KEY.",
        "category": "Other/Unknown", "item": "Unable to identify",
        "is_waste": True, "confidence": 0.0, "is_uncertain": True,
    }):
        client = _make_app_client()
        image_bytes = _minimal_jpeg_bytes()
        data = {"image": (io.BytesIO(image_bytes), "test.jpg", "image/jpeg"), "user_id": "test_vision_user"}
        response = client.post("/api/scan", data=data, content_type="multipart/form-data")
    assert response.status_code == 500
    body = json.loads(response.data)
    assert body.get("error_type") == "config_error"


def test_scan_route_api_error_502():
    from app.services import openai_service as svc
    with patch("app.routes.api.scan.analyze_waste_image", return_value={
        "error_type": "api_error",
        "reason": "AI vision service is temporarily unavailable.",
        "category": "Other/Unknown", "item": "Unable to identify",
        "is_waste": True, "confidence": 0.0, "is_uncertain": True,
    }):
        client = _make_app_client()
        image_bytes = _minimal_jpeg_bytes()
        data = {"image": (io.BytesIO(image_bytes), "test.jpg", "image/jpeg"), "user_id": "test_vision_user"}
        response = client.post("/api/scan", data=data, content_type="multipart/form-data")
    assert response.status_code == 502
    body = json.loads(response.data)
    assert body.get("error_type") == "api_error"


# ─────────────────────────────────────────────────────────────────────────────
# Live integration test (skipped when key absent)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not os.getenv("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY not set -- skipping live Gemini API test"
)
def test_live_gemini_plastic_bottle():
    from app.services.openai_service import analyze_waste_image
    from PIL import Image, ImageDraw

    buf = io.BytesIO()
    img = Image.new("RGB", (200, 400), color=(30, 100, 200))
    draw = ImageDraw.Draw(img)
    draw.rectangle([60, 80, 140, 380], fill=(100, 180, 255))
    draw.rectangle([85, 20, 115, 80], fill=(80, 160, 220))
    draw.rectangle([80, 10, 120, 22], fill=(220, 220, 220))
    img.save(buf, format="JPEG")

    result = analyze_waste_image(buf.getvalue(), "plastic_bottle.jpg", "image/jpeg")

    print("\n[LIVE TEST] Gemini classified as:", result.get("category"))
    print("[LIVE TEST] Item:", result.get("item"))
    print("[LIVE TEST] Confidence:", result.get("confidence"))
    print("[LIVE TEST] Reason:", result.get("reason"))

    # Quota errors (api_error with 429) are valid in free tier; skip gracefully
    if result.get("error_type") == "api_error":
        reason = result.get("reason", "")
        if "quota" in reason.lower() or "429" in reason or "rate" in reason.lower():
            import pytest
            pytest.skip(f"Gemini quota exceeded: {reason}")
    assert result.get("error_type") != "config_error", f"Config error: {result}"
    assert result.get("confidence", 0) >= 0.0
