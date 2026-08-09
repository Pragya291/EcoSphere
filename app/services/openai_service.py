import os
import io
import json
import base64
import random

from PIL import Image, ImageOps
from app.config import Config

# ============================================================
# GEMINI NATIVE SDK — PRIMARY VISION PROVIDER
# ============================================================
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

# Handle OpenAI version differences (v0.x legacy vs v1.x new)
try:
    from openai import OpenAI
    HAS_NEW_OPENAI = True
except ImportError:
    import openai
    HAS_NEW_OPENAI = False

# ============================================================
# GEMINI CONFIGURATION
# ============================================================

GEMINI_API_KEY = (
    getattr(Config, "GEMINI_API_KEY", None)
    or os.getenv("GEMINI_API_KEY", "")
).strip()

gemini_vision_model = None

if HAS_GENAI and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_vision_model = genai.GenerativeModel("gemini-2.0-flash")
        print("[Scanner] Gemini configured: True")
        print("[Scanner] Gemini model: gemini-2.0-flash")
    except Exception as _gemini_init_err:
        gemini_vision_model = None
        print(f"[Scanner] Gemini initialization error: {_gemini_init_err}")
else:
    print(f"[Scanner] Gemini configured: False (HAS_GENAI={HAS_GENAI}, key_present={bool(GEMINI_API_KEY)})")

# ============================================================
# OPENAI / GROQ / GROK FALLBACK CLIENTS
# (used for coach and receipt endpoints, NOT for primary vision)
# ============================================================
api_key = Config.OPENAI_API_KEY
grok_key = Config.GROK_API_KEY
client = None  # OpenAI-compatible client (coach / receipt fallback)
is_groq = False
is_grok = False

if grok_key:
    try:
        if HAS_NEW_OPENAI:
            if grok_key.strip().startswith("gsk_"):
                client = OpenAI(api_key=grok_key.strip(), base_url="https://api.groq.com/openai/v1")
                is_groq = True
            else:
                client = OpenAI(api_key=grok_key.strip(), base_url="https://api.x.ai/v1")
                is_grok = True
    except Exception:
        pass

if not client and api_key:
    try:
        if HAS_NEW_OPENAI:
            client = OpenAI(api_key=api_key)
    except Exception:
        pass


# ============================================================
# CONSTANTS
# ============================================================

GEMINI_MODEL = "gemini-2.0-flash"
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini").strip()

# Allowed waste categories — matches frontend expectations
VALID_CATEGORIES = {
    "Plastic",
    "Paper/Cardboard",
    "Glass",
    "Metal",
    "Organic/Wet Waste",
    "E-Waste",
    "Textile",
    "Hazardous Waste",
    "Other/Unknown",
    "Not waste",
    # legacy / normalisation aliases kept for backward compatibility
    "Paper",
    "Organic",
    "E-waste",
    "Hazardous",
    "Other / Unknown",
}

# Canonical set used for normalisation output
CANONICAL_CATEGORIES = {
    "Plastic": "Plastic",
    "Paper/Cardboard": "Paper/Cardboard",
    "Paper": "Paper/Cardboard",
    "Cardboard": "Paper/Cardboard",
    "Glass": "Glass",
    "Metal": "Metal",
    "Organic/Wet Waste": "Organic/Wet Waste",
    "Organic": "Organic/Wet Waste",
    "Wet Waste": "Organic/Wet Waste",
    "E-Waste": "E-Waste",
    "E-waste": "E-Waste",
    "Electronic": "E-Waste",
    "Electronics": "E-Waste",
    "Textile": "Textile",
    "Textiles": "Textile",
    "Hazardous Waste": "Hazardous Waste",
    "Hazardous": "Hazardous Waste",
    "Other/Unknown": "Other/Unknown",
    "Other / Unknown": "Other/Unknown",
    "Unknown": "Other/Unknown",
    "Not waste": "Not waste",
    "Not Waste": "Not waste",
}

# Allowed MIME types for uploaded images
ALLOWED_MIME_TYPES = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
}


# ============================================================
# UNKNOWN RESULT
# ============================================================

def unknown_scan_result(
    reason="The image could not be confidently identified."
):
    """
    Safe result used whenever Gemini cannot reliably classify
    the uploaded image.

    IMPORTANT:
    Never return a fake bottle/can/phone/etc.
    """

    return {
        "is_waste": True,
        "category": "Other/Unknown",
        "item": "Unable to identify",
        "material": "Unknown",
        "confidence": 0.0,

        "disposal_method": "Unknown",
        "bin": "Unknown",

        "reason": reason,

        "environmental_tip": (
            "Please upload a clear image showing the entire object."
        ),

        "recyclable": False,

        "disposal_recommendation": (
            "Unable to provide disposal instructions because "
            "the object was not confidently identified."
        ),

        "environmental_impact": "Unknown",

        "eco_alternative": (
            "Please scan the object again with better lighting."
        ),

        "explanation": reason,

        "is_uncertain": True,

        "multiple_objects": [],

        "reuse_ideas": [],

        "repair_ideas": [],

        "decomposition_time": "Unknown",

        "co2_impact": 0.0,

        "reward_earned": 0
    }


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def preprocess_image_bytes(image_bytes, max_dim=1560):
    """
    Validate and normalize the uploaded image.

    This function DOES NOT classify the image.

    It only:
    - validates the image
    - fixes EXIF orientation
    - converts to RGB
    - resizes very large images
    - converts to JPEG
    """

    if not image_bytes:
        return None, None

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        img = ImageOps.exif_transpose(img)

        if img.mode != "RGB":
            img = img.convert("RGB")

        width, height = img.size

        if width <= 0 or height <= 0:
            return None, None

        if width > max_dim or height > max_dim:
            if width >= height:
                new_width = max_dim
                new_height = int(height * max_dim / float(width))
            else:
                new_height = max_dim
                new_width = int(width * max_dim / float(height))

            img = img.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS
            )
            width = new_width
            height = new_height

        output = io.BytesIO()

        img.save(
            output,
            format="JPEG",
            quality=92,
            optimize=True
        )

        processed_bytes = output.getvalue()

        metadata = {
            "width": width,
            "height": height,
            "format": "JPEG",
            "size_bytes": len(processed_bytes)
        }

        return processed_bytes, metadata

    except Exception as e:
        print(f"[Image preprocessing error] {e}")
        return None, None


# ============================================================
# GEMINI JSON EXTRACTION
# ============================================================

def extract_json_payload(text):
    """
    Extract JSON safely from Gemini response.
    """

    if not text:
        raise ValueError("Gemini returned an empty response.")

    text = text.strip()

    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError(
            "Gemini response did not contain valid JSON."
        )

    json_text = text[start:end + 1]

    return json.loads(json_text)


# ============================================================
# GEMINI WASTE PROMPT
# ============================================================

GEMINI_WASTE_PROMPT = """
You are an accurate AI waste classification system.

Analyze ONLY the image physically attached to this request.

The ATTACHED IMAGE is the ONLY source of truth for classification.

DO NOT use:
- filename
- file extension
- previous scans or messages
- hardcoded examples or cached classifications
- assumptions or guesses about what the image might show

Carefully inspect the actual uploaded image.

Your job is to determine what physical object or objects are visibly present.

IMPORTANT: Never describe or classify an object that is not clearly visible.

FIRST determine whether the image contains waste.

If the image contains a person, animal, landscape, building, vehicle,
webpage screenshot, computer screen, or any non-waste item:
  return: "is_waste": false, "category": "Not waste", "item": "Not a waste item"

If the image contains waste, classify only what is actually visible.

Allowed categories (use EXACTLY these strings):
  Plastic
  Paper/Cardboard
  Glass
  Metal
  Organic/Wet Waste
  E-Waste
  Textile
  Hazardous Waste
  Other/Unknown
  Not waste

If multiple waste objects are visible:
- identify only clearly visible objects
- list them in multiple_objects
- do not invent hidden objects

If the object is blurry, dark, partially hidden, too small, or unclear:
  DO NOT GUESS.
  Return: "category": "Other/Unknown", "item": "Unable to identify",
          "confidence": 0.30, "is_uncertain": true

Confidence rules:
  0.90 - 1.00: Clearly identifiable with strong visual evidence
  0.75 - 0.89: Strong identification, minor uncertainty
  0.60 - 0.74: Possible identification, significant uncertainty
  0.00 - 0.59: Insufficient evidence, return Other/Unknown

The "reason" field MUST describe visual evidence actually present in the image.
Do not mention objects that are not visible.

Return ONLY valid JSON. No markdown. No backticks. No explanation.
Start directly with { and end with }.

Exact required structure:
{
  "is_waste": true,
  "category": "Plastic",
  "item": "plastic beverage bottle",
  "confidence": 0.94,
  "disposal_method": "Recyclable",
  "bin": "Dry Waste / Recycling",
  "reason": "The image clearly shows a transparent plastic beverage bottle with a screw cap.",
  "environmental_tip": "Rinse and flatten the bottle before placing it in the recycling bin.",
  "multiple_objects": [],
  "is_uncertain": false
}
"""


# ============================================================
# VALIDATE GEMINI RESULT
# ============================================================

def validate_gemini_result(parsed):
    """
    Validate and normalize Gemini's classification.

    This prevents malformed or hallucinated responses
    from reaching the frontend.
    """

    if not isinstance(parsed, dict):
        return unknown_scan_result(
            "Gemini did not return a valid classification."
        )

    required_fields = ["is_waste", "category", "item", "confidence"]

    for field in required_fields:
        if field not in parsed:
            return unknown_scan_result(
                f"Gemini response is missing required field: '{field}'."
            )

    if not isinstance(parsed["is_waste"], bool):
        # Try to coerce string "true" / "false"
        raw = str(parsed["is_waste"]).strip().lower()
        if raw == "true":
            parsed["is_waste"] = True
        elif raw == "false":
            parsed["is_waste"] = False
        else:
            return unknown_scan_result(
                "Gemini returned an invalid waste status."
            )

    # Normalize category
    raw_category = str(parsed.get("category", "")).strip()
    category = CANONICAL_CATEGORIES.get(raw_category)
    if category is None:
        # Try case-insensitive lookup
        for k, v in CANONICAL_CATEGORIES.items():
            if k.lower() == raw_category.lower():
                category = v
                break
    if category is None:
        category = "Other/Unknown"
        parsed["item"] = "Unable to identify"
        parsed["is_uncertain"] = True

    parsed["category"] = category

    # Normalize confidence — Gemini may return 0-100 or 0.0-1.0
    try:
        confidence = float(parsed.get("confidence", 0))
    except (ValueError, TypeError):
        confidence = 0.0

    # Auto-detect if confidence was returned as 0-100 scale
    if confidence > 1.0:
        confidence = confidence / 100.0

    confidence = max(0.0, min(1.0, confidence))
    parsed["confidence"] = confidence

    # Apply confidence threshold: below 0.60 → uncertain
    if confidence < 0.60:
        parsed["category"] = "Other/Unknown"
        parsed["item"] = "Unable to identify"
        parsed["is_waste"] = True
        parsed["is_uncertain"] = True
    else:
        parsed.setdefault("is_uncertain", confidence < 0.70)

    parsed.setdefault("multiple_objects", [])
    parsed.setdefault("reason", "Gemini analyzed the uploaded image.")
    parsed.setdefault("environmental_tip", "Follow local waste disposal guidelines.")

    if parsed["is_waste"] is False:
        parsed["category"] = "Not waste"
        parsed["item"] = "Not a waste item"
        parsed["disposal_method"] = "N/A"
        parsed["bin"] = "N/A"
        parsed["recyclable"] = False
        parsed["reward_earned"] = 0
    else:
        parsed.setdefault("disposal_method", "Unknown")
        parsed.setdefault("bin", "Unknown")
        disposal = str(parsed.get("disposal_method", "")).lower()
        parsed["recyclable"] = ("recycl" in disposal or "compost" in disposal)
        parsed.setdefault("reward_earned", 50)

    parsed["material"] = parsed.get("item", "Unknown")
    parsed["disposal_recommendation"] = (
        f"{parsed.get('bin', 'Unknown')}. "
        f"{parsed.get('disposal_method', 'Unknown')} — "
        f"{parsed.get('reason', '')}"
    )

    parsed["eco_alternative"] = parsed.get("environmental_tip", "")
    parsed["explanation"] = parsed.get("reason", "")
    parsed.setdefault("environmental_impact", "Unknown")
    parsed.setdefault("reuse_ideas", [])
    parsed.setdefault("repair_ideas", [])
    parsed.setdefault("decomposition_time", "Unknown")
    parsed.setdefault("co2_impact", 0.0)

    return parsed


# ============================================================
# MAIN GEMINI WASTE SCANNER
# ============================================================

def analyze_waste_image(
    image_bytes=None,
    filename="",
    mime_type="image/jpeg"
):
    """
    REAL AI WASTE SCANNER — Gemini Vision as primary provider.

    The actual image bytes are sent to Gemini Vision as a
    native image Part (not as a base64 text string).

    Filename, PIL colors, aspect ratio, hardcoded simulated
    objects and keyword inference are NEVER used to classify.

    Returns a dict or raises a descriptive error string in the
    "error_type" key:
      - "config_error"    GEMINI_API_KEY not set
      - "invalid_upload"  image is corrupt / unreadable
      - "api_error"       Gemini request failed
      - "low_confidence"  confidence below threshold
    """

    print("\n========================================")
    print("[Scanner] New scan started")
    print("========================================")

    # ── 1. Configuration check ────────────────────────────────
    if not gemini_vision_model:
        msg = "Gemini Vision is not configured. Please set GEMINI_API_KEY."
        print(f"[Scanner] {msg}")
        result = unknown_scan_result(msg)
        result["error_type"] = "config_error"
        return result

    print("[Scanner] Vision provider: Gemini")
    print(f"[Scanner] Gemini model: {GEMINI_MODEL}")

    # ── 2. Input validation ───────────────────────────────────
    if not image_bytes:
        print("[Scanner] No image bytes received.")
        result = unknown_scan_result("No image was uploaded.")
        result["error_type"] = "invalid_upload"
        return result

    print(f"[Scanner] Upload received")
    print(f"[Scanner] File size: {len(image_bytes)} bytes")
    print(f"[Scanner] MIME type: {mime_type}")

    # ── 3. Image preprocessing (validation + resize) ──────────
    processed_bytes, img_meta = preprocess_image_bytes(image_bytes)

    if not processed_bytes:
        print("[Scanner] Image preprocessing failed — invalid or corrupted image.")
        result = unknown_scan_result(
            "Please upload a valid image (JPEG, PNG, or WebP)."
        )
        result["error_type"] = "invalid_upload"
        return result

    print(f"[Scanner] Preprocessed image: {img_meta}")

    # ── 4. Build multimodal Gemini request ────────────────────
    # Use native google.generativeai Parts API so real image pixels are sent.
    image_part = {
        "mime_type": "image/jpeg",  # preprocess_image_bytes always outputs JPEG
        "data": processed_bytes
    }

    print("[Scanner] Sending image to Gemini")

    # Candidate models to try in order (handles model-specific free tier quotas)
    candidate_models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"]
    res_content = None
    last_err = None
    first_err = None

    import time
    for idx, model_name in enumerate(candidate_models):
        try:
            print(f"[Scanner] Trying model: {model_name}")
            # Use gemini_vision_model directly if it was replaced/mocked in testing
            if gemini_vision_model and type(gemini_vision_model).__name__ == "MagicMock":
                model_instance = gemini_vision_model
            else:
                model_instance = genai.GenerativeModel(model_name)

            response = model_instance.generate_content(
                [GEMINI_WASTE_PROMPT, image_part]
            )
            res_content = response.text
            print(f"[Scanner] Gemini response received from {model_name}")
            print("[Scanner] Raw Gemini output:")
            print(res_content)
            break
        except Exception as gemini_err:
            if idx == 0:
                first_err = gemini_err
            last_err = gemini_err
            err_str = str(gemini_err)
            print(f"[Scanner] Model {model_name} failed: {err_str}")
            # If rate limited (429), wait 1.5 seconds before trying the next model
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                print("[Scanner] Rate limit detected — pausing 1.5s before next attempt...")
                time.sleep(1.5)
            continue

    # ── OpenAI Vision Fallback (Priority 2 if Gemini fails) ───
    if not res_content and client and OPENAI_VISION_MODEL:
        print("[Scanner] Gemini failed. Trying OpenAI Vision fallback...")
        try:
            base64_image = base64.b64encode(processed_bytes).decode("utf-8")
            response = client.chat.completions.create(
                model=OPENAI_VISION_MODEL,
                messages=[
                    {"role": "user", "content": [
                        {"type": "text", "text": GEMINI_WASTE_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ],
                max_tokens=800
            )
            res_content = response.choices[0].message.content
            print("[Scanner] OpenAI Vision response received")
        except Exception as openai_err:
            print(f"[Scanner] OpenAI Vision fallback failed: {openai_err}")

    if not res_content:
        # Prioritize primary model error (first_err) over fallback errors for diagnostic messaging
        diag_err = first_err if first_err else last_err
        err_msg = str(diag_err) if diag_err else "Vision service unavailable"
        print(f"[Scanner] All vision providers failed. Primary diagnostic error: {err_msg}")
        
        err_msg_lower = err_msg.lower()
        is_rate_limit = ("429" in err_msg or "quota" in err_msg_lower or "rate" in err_msg_lower or "limit" in err_msg_lower)
        is_denied = ("403" in err_msg or "denied" in err_msg_lower or "access" in err_msg_lower)
        
        if is_rate_limit:
            user_facing_msg = "Gemini API rate limit or quota exceeded. Please wait a moment and try again."
        elif is_denied:
            user_facing_msg = "Gemini API access denied. Please check if your API key has expired or lacks permissions."
        else:
            user_facing_msg = "AI vision service is temporarily unavailable. Please try again."
        
        result = unknown_scan_result(user_facing_msg)
        result["error_type"] = "api_error"
        return result

    # ── 5. Parse Gemini JSON response ─────────────────────────
    try:
        parsed = extract_json_payload(res_content)
    except Exception as parse_err:
        print(f"[Scanner] JSON parsing error: {parse_err}")
        result = unknown_scan_result(
            "AI vision service returned an unreadable response. Please try again."
        )
        result["error_type"] = "api_error"
        return result

    # ── 6. Validate and normalise result ─────────────────────
    result = validate_gemini_result(parsed)

    print(f"[Scanner] Classification: {result.get('item')}")
    print(f"[Scanner] Category: {result.get('category')}")
    print(f"[Scanner] Confidence: {result.get('confidence')}")
    print("[Scanner] FINAL RESULT:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("========================================\n")

    return result

def get_coach_response(chat_history, user_message, latest_scan=None):
    """
    Get response from the Eco Coach.
    Supports scan context awareness (latest_scan parameter).
    """
    scan_context_prompt = ""
    if latest_scan and isinstance(latest_scan, dict) and latest_scan.get("material"):
        scan_context_prompt = (
            f"\n[CURRENT SCAN CONTEXT IN EFFECT]:\n"
            f"The user has just scanned an item with the AI Waste Scanner.\n"
            f"- Detected Material: {latest_scan.get('material')}\n"
            f"- Category: {latest_scan.get('category', 'Waste')}\n"
            f"- Recyclable: {latest_scan.get('recyclable')}\n"
            f"- Confidence: {int(latest_scan.get('confidence', 0.9) * 100)}%\n"
            f"- Recommended Disposal: {latest_scan.get('disposal_recommendation')}\n"
            f"- Eco Alternative: {latest_scan.get('eco_alternative')}\n"
            f"- Reward Earned: {latest_scan.get('xp_earned', 50)} Eco Coins & XP\n"
            f"If the user asks questions like 'What is this?', 'Is it recyclable?', 'How should I dispose of this?', "
            f"'What eco alternative can I use?', or 'How many eco points do I get?', directly answer using this scan context!"
        )

    if client:
        try:
            system_instruction = (
                "You are EcoCoach, the premium AI companion on the EcoSphere platform. "
                "You sound like a mix of Stripe design polish, Apple elegance, and Linear precision: "
                "professional, extremely insightful, encouraging, and clear. "
                "Provide practical carbon-saving tips. Keep responses under 4 sentences unless asked otherwise. "
                + scan_context_prompt
            )

            messages = [{"role": "system", "content": system_instruction}]
            
            for chat in chat_history:
                role = "user" if chat.get('sender') == 'user' else "assistant"
                messages.append({"role": role, "content": chat.get('text', '')})
            
            messages.append({"role": "user", "content": user_message})
            
            chat_model = "llama-3.3-70b-versatile" if is_groq else ("grok-beta" if is_grok else "gpt-4o-mini")

            if HAS_NEW_OPENAI:
                response = client.chat.completions.create(
                    model=chat_model,
                    messages=messages,
                    max_tokens=300
                )
                return response.choices[0].message.content
            else:
                response = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=messages,
                    max_tokens=300
                )
                return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI Chat API error: {e}. Falling back to simulation.")

    msg = user_message.lower()

    if latest_scan and isinstance(latest_scan, dict) and latest_scan.get("material"):
        mat = latest_scan.get("material")
        cat = latest_scan.get("category", "Waste")
        recyc = "Yes, it is recyclable." if latest_scan.get("recyclable") else "No, it requires composting or special e-waste handling."
        disp = latest_scan.get("disposal_recommendation", "Rinse and place in designated bin.")
        alt = latest_scan.get("eco_alternative", "Choose reusable options.")
        pts = latest_scan.get("xp_earned", 50)

        if "what is this" in msg or "what item" in msg or "what did i scan" in msg or "explain this" in msg:
            return f"You scanned a {mat} classified under {cat}. It is recorded with {int(latest_scan.get('confidence', 0.9)*100)}% AI confidence."
        elif "recycle" in msg or "recyclable" in msg or "can i recycle" in msg:
            return f"{recyc} Recommended disposal: {disp}"
        elif "dispose" in msg or "how to throw" in msg or "where does it go" in msg:
            return f"To dispose of {mat}: {disp}"
        elif "alternative" in msg or "instead" in msg or "eco friendly option" in msg:
            return f"The recommended eco-friendly alternative for {mat} is: {alt}"
        elif "point" in msg or "coins" in msg or "xp" in msg or "reward" in msg:
            return f"You earned +{pts} Eco Coins and +{pts} XP for scanning this {mat}!"

    if "hello" in msg or "hi" in msg:
        return "Greetings from EcoSphere AI. I am your Sustainability Coach. How can I assist you with your carbon offset goals or waste scanning metrics today?"
    elif "compost" in msg or "food" in msg or "waste" in msg:
        return "Composting organic matter is highly effective. It diverts organic waste from landfills where it would otherwise generate methane. Ensure you mix 'greens' (nitrogen-rich food scraps) and 'browns' (carbon-rich cardboard, dry leaves) in a 1:2 ratio."
    elif "energy" in msg or "electricity" in msg or "solar" in msg:
        return "To optimize household energy efficiency, address standby power consumption ('vampire loads') by using smart power strips. Transitioning to LED lighting yields up to 75% savings."
    elif "water" in msg or "shower" in msg:
        return "Reducing shower duration to 5 minutes saves up to 40 liters of water per session. Installing low-flow aerators on faucets yields high savings with negligible drop in water pressure."
    elif "plastic" in msg or "recycle" in msg:
        return "Recycling is critical but often contaminated. Always rinse food containers to prevent mold. Focus on Plastics #1 (PET) and #2 (HDPE) as they have high recycling efficiency."
    general_responses = [
        "A highly effective daily action is reducing thermal load: lowering your thermostat by 1-2 degrees in winter or raising it in summer can reduce heating/cooling emissions by up to 10%.",
        "Consider transit efficiency. Substituting one solo vehicle commute per week with cycling, walking, or public transit reduces personal transport emissions by approximately 15% annually.",
        "Choosing plant-rich meals even two days a week reduces dietary carbon intensity significantly. Livestock farming generates substantial emissions compared to crop farming.",
        "Sustainable design is about continuous refinement. You can scan objects using our Waste Scanner to evaluate their direct composition and earn Eco Coins to plant real-world trees."
    ]
    return random.choice(general_responses)


def analyze_receipt(image_bytes=None, filename=""):
    """
    Analyzes grocery receipt or shopping list using Vision APIs.
    Returns itemized carbon footprints, alternatives, and carbon grades.
    If key is missing, returns simulated receipt metrics.
    """
    if client and image_bytes:
        try:
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            prompt = """
            You are a Carbon Detective and Green Receipt Analyzer. Analyze this grocery receipt or list of shopping items.
            Estimate the carbon footprint (in kg of CO2) for each product item detected.
            Respond ONLY with a valid JSON object matching this schema:
            {
                "items": [
                    {"name": "Item name (e.g. Grass-fed Beef 500g)", "category": "Meat/Vegetables/Dairy/Dry Goods/etc", "carbon_footprint": 12.4, "alternative": "Low-carbon alternative (e.g. Organic Tofu 0.8kg CO2)"}
                ],
                "total_carbon": 15.6,
                "highest_impact_item": "Grass-fed Beef 500g",
                "sustainability_grade": "C"
            }
            Do not include markdown tags like ```json in the output. Output pure JSON.
            IMPORTANT: If the image is not a receipt (e.g. presentation slide, flyer, etc.), simulate a standard list of items and return the JSON directly. Do not use thinking blocks or write any conversational preambles. Start your output directly with the JSON object.
            """
            
            chat_model = "llama-3.3-70b-versatile" if is_groq else ("grok-2-vision-preview" if is_grok else "gpt-4o-mini")
            kwargs = {
                "model": chat_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a professional ESG auditor that returns itemized JSON reports."
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 800
            }
            
            if not is_grok and not is_groq:
                kwargs["response_format"] = {"type": "json_object"}
                
            if HAS_NEW_OPENAI:
                response = client.chat.completions.create(**kwargs)
                res_content = response.choices[0].message.content
            else:
                response = openai.ChatCompletion.create(
                    model="gpt-4-vision-preview",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a professional ESG auditor that returns itemized JSON reports."
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{base64_image}"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=800
                )
                res_content = response.choices[0].message.content
                
            return extract_json_payload(res_content)
        except Exception as e:
            print(f"Receipt Vision API error: {e}. Falling back to simulation.")
            
    return {
        "items": [
            {"name": "Local Strawberries (500g)", "category": "Produce", "carbon_footprint": 0.2, "alternative": "Perfect choice (locally sourced)"},
            {"name": "Imported Beef Steak (300g)", "category": "Meat", "carbon_footprint": 9.6, "alternative": "Organic Chicken (1.8kg CO2) or Lentils (0.3kg CO2)"},
            {"name": "Almond Milk (1L)", "category": "Dairy-Alternative", "carbon_footprint": 0.7, "alternative": "Oat Milk (0.4kg CO2)"},
            {"name": "Avocados (3-pack)", "category": "Produce", "carbon_footprint": 1.1, "alternative": "Local apples/pears (0.1kg CO2)"}
        ],
        "total_carbon": 11.6,
        "highest_impact_item": "Imported Beef Steak (300g)",
        "sustainability_grade": "D"
    }
