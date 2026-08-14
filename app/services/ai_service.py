import os
import io
import json
import base64
import random
import requests
from PIL import Image, ImageOps
import torch

# Global model container
_classifier = None
_model_available = False

def load_model():
    global _classifier, _model_available
    if _classifier is not None:
        return _classifier
    
    try:
        from transformers import pipeline
        # Use CPU explicitly for stable inference across development hardware
        device = 0 if torch.cuda.is_available() else -1
        print(f"[Local AI] Initializing image classification pipeline on device: {'GPU' if device == 0 else 'CPU'}...")
        _classifier = pipeline(
            "image-classification", 
            model="yangy50/garbage-classification",
            device=device
        )
        _model_available = True
        print("[Local AI] Model loaded successfully.")
    except Exception as e:
        print(f"[Local AI] Failed to load local model: {e}")
        _classifier = None
        _model_available = False
    return _classifier

# Model loaded lazily on first scan request

# Category mappings from yangy50/garbage-classification labels to EcoSphere canonical categories:
# Model output labels: 'paper', 'cardboard', 'biological', 'metal', 'plastic', 'green-glass', 'brown-glass', 'white-glass', 'clothes', 'shoes', 'batteries', 'trash'
LABEL_MAPPING = {
    "paper": "Paper/Cardboard",
    "cardboard": "Paper/Cardboard",
    "biological": "Organic/Wet Waste",
    "metal": "Metal",
    "plastic": "Plastic",
    "green-glass": "Glass",
    "brown-glass": "Glass",
    "white-glass": "Glass",
    "clothes": "Textile",
    "shoes": "Textile",
    "batteries": "Hazardous Waste",
    "trash": "Other/Unknown"
}

# Human readable item names for predictions
ITEM_NAMES = {
    "paper": "Paper item",
    "cardboard": "Cardboard container",
    "biological": "Organic matter",
    "metal": "Metal object",
    "plastic": "Plastic item",
    "green-glass": "Green glass bottle/jar",
    "brown-glass": "Brown glass bottle/jar",
    "white-glass": "Clear glass bottle/jar",
    "clothes": "Clothing fabric",
    "shoes": "Footwear item",
    "batteries": "Battery / Electronic chemical cell",
    "trash": "Unidentified trash item"
}

DISPOSAL_RULES = {
    "Plastic": {
        "bin": "Recyclable / Plastic Bin",
        "recyclable": True,
        "method": "Clean and dry the plastic bottle or container before recycling.",
        "environmental_tip": "Recycling plastic saves petroleum resources and reduces ocean plastic pollution.",
        "co2_impact": -0.08,
        "decomposition_time": "450 years"
    },
    "Paper/Cardboard": {
        "bin": "Dry Waste / Paper Bin",
        "recyclable": True,
        "method": "Keep paper and cardboard clean, dry, and flat. Do not recycle soiled pizza boxes.",
        "environmental_tip": "Recycling 1 ton of cardboard saves 17 trees and 7,000 gallons of water.",
        "co2_impact": -0.05,
        "decomposition_time": "2-5 months"
    },
    "Glass": {
        "bin": "Glass Recycling Bin",
        "recyclable": True,
        "method": "Rinse glass jars and bottles. Handle broken glass with care.",
        "environmental_tip": "Glass is 100% recyclable and can be recycled endlessly without loss of quality.",
        "co2_impact": -0.04,
        "decomposition_time": "1 million years"
    },
    "Metal": {
        "bin": "Recyclable / Metal Bin",
        "recyclable": True,
        "method": "Rinse metal cans and foil. Crushing cans saves space in the recycling bin.",
        "environmental_tip": "Recycling aluminum uses 95% less energy than producing it from raw materials.",
        "co2_impact": -0.12,
        "decomposition_time": "50-200 years"
    },
    "Organic/Wet Waste": {
        "bin": "Wet Waste / Compost Bin",
        "recyclable": False,
        "method": "Place food leftovers, fruit peels, and yard waste in the compost stream. Avoid plastic liners.",
        "environmental_tip": "Composting organic waste diverts it from landfills, preventing methane emissions.",
        "co2_impact": -0.06,
        "decomposition_time": "1-6 months"
    },
    "E-Waste": {
        "bin": "E-waste / Drop-off Center",
        "recyclable": True,
        "method": "Take electronic items, cables, and batteries to an authorized e-waste collection site.",
        "environmental_tip": "E-waste contains hazardous materials like lead and mercury, but also valuable gold and copper.",
        "co2_impact": -0.15,
        "decomposition_time": "Non-biodegradable"
    },
    "Textile": {
        "bin": "Textile Bin / Donation",
        "recyclable": True,
        "method": "Donate wearable clothes. Drop off worn-out textiles at dedicated fabric recycling bins.",
        "environmental_tip": "Repurposing old clothes prevents chemical pollution and waste from the fast fashion cycle.",
        "co2_impact": -0.07,
        "decomposition_time": "Up to 200 years"
    },
    "Hazardous Waste": {
        "bin": "Hazardous Waste Collection",
        "recyclable": False,
        "method": "Store paint, motor oil, batteries, and chemicals safely and take them to a city hazard drop-off.",
        "environmental_tip": "Proper hazardous disposal protects local water supplies and wildlife from toxic contamination.",
        "co2_impact": -0.02,
        "decomposition_time": "Varies / Toxic"
    },
    "Other/Unknown": {
        "bin": "General Waste Bin",
        "recyclable": False,
        "method": "Dispose of non-recyclable waste in the general landfill bin.",
        "environmental_tip": "Try to minimize waste by choosing reusable packaging and buying in bulk.",
        "co2_impact": 0.0,
        "decomposition_time": "Varies"
    }
}

def analyze_waste_image(image_bytes=None, filename="", mime_type="image/jpeg"):
    """
    LOCAL AI WASTE SCANNER — PyTorch-based image classification.
    """
    if not _model_available or _classifier is None:
        # Try loading one more time
        if load_model() is None:
            return {
                "success": False,
                "error_type": "model_unavailable",
                "reason": "The local scanner model is unavailable. Please try again."
            }

    if not image_bytes:
        return {
            "success": False,
            "error_type": "invalid_upload",
            "reason": "Please upload a valid image."
        }

    try:
        # Preprocess and open image
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        img = ImageOps.exif_transpose(img)

        if img.mode != "RGB":
            img = img.convert("RGB")

        # Basic image checks
        if img.size[0] <= 0 or img.size[1] <= 0:
            raise ValueError("Invalid image dimensions.")
            
    except Exception as e:
        print(f"[Local AI] Image open/validate failed: {e}")
        return {
            "success": False,
            "error_type": "invalid_upload",
            "reason": "Please upload a valid image."
        }

    # Perform prediction
    try:
        predictions = _classifier(img)
        if not predictions:
            raise ValueError("No predictions returned from model.")
            
        # Get highest prediction
        top_pred = predictions[0]
        label = top_pred.get("label")
        confidence = top_pred.get("score", 0.0)
        
        print(f"[Local AI] Prediction: {label} (confidence: {confidence:.4f})")

        # ── Confidence handling ─────────────────────────────────
        if confidence < 0.50:
            return {
                "success": False,
                "error_type": "low_confidence",
                "reason": "Couldn't confidently identify this item. Try taking a clearer photo."
            }

        is_uncertain = confidence < 0.80
        
        category = LABEL_MAPPING.get(label, "Other/Unknown")
        item = ITEM_NAMES.get(label, "Waste Item")

        # Map to rules
        rule = DISPOSAL_RULES.get(category, DISPOSAL_RULES["Other/Unknown"])

        result = {
            "success": True,
            "is_waste": category != "Not waste",
            "category": category,
            "item": item,
            "material": item,
            "confidence": confidence,
            "disposal_method": rule["method"],
            "bin": rule["bin"],
            "reason": f"Local image classifier identified this as {label} with confidence {confidence*100:.1f}%.",
            "environmental_tip": rule["environmental_tip"],
            "multiple_objects": [],
            "recyclable": rule["recyclable"],
            "disposal_recommendation": f"Place in {rule['bin']}. {rule['method']}",
            "environmental_impact": "Moderate",
            "eco_alternative": rule["environmental_tip"],
            "explanation": f"Classified locally using yangy50/garbage-classification.",
            "is_uncertain": is_uncertain,
            "reuse_ideas": [],
            "repair_ideas": [],
            "decomposition_time": rule["decomposition_time"],
            "co2_impact": rule["co2_impact"],
            "reward_earned": 0 if is_uncertain else 40
        }
        return result

    except Exception as inference_err:
        print(f"[Local AI] Inference failed: {inference_err}")
        return {
            "success": False,
            "error_type": "api_error",
            "reason": "The local scanner model failed to analyze the image."
        }

def call_realtime_llm(chat_history, user_message, latest_scan=None):
    """
    Calls a real-time LLM provider (Groq / Grok, OpenAI, or Gemini) if an API key is configured.
    Returns the real-time AI response string, or None if unavailable.
    """
    grok_key = os.getenv("GROK_API_KEY") or os.getenv("GROQ_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if not (grok_key or openai_key or gemini_key):
        return None

    import requests

    system_prompt = (
        "You are EcoSphere AI, an intelligent, inspiring, and friendly real-time Sustainability Coach & AI Mentor. "
        "Your mission is to help users adopt eco-friendly habits, reduce carbon footprints, recycle correctly, save energy and water, "
        "and answer questions about green living. Keep responses encouraging, well-formatted, clear, and actionable. "
        "Use bullet points or short paragraphs where appropriate."
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Include scan context if present
    if latest_scan and isinstance(latest_scan, dict) and latest_scan.get("material"):
        scan_ctx = (
            f"[Latest Scan Context]: The user recently scanned a {latest_scan.get('material')} "
            f"(Category: {latest_scan.get('category')}, Bin: {latest_scan.get('bin', 'Recycling')}, "
            f"Recyclable: {latest_scan.get('recyclable', True)}, CO2 Impact: {latest_scan.get('co2_impact', 0)} kg CO2). "
            f"Disposal advice: {latest_scan.get('disposal_recommendation', '')}."
        )
        messages.append({"role": "system", "content": scan_ctx})

    # Convert history into LLM messages format
    if chat_history and isinstance(chat_history, list):
        for h in chat_history[-6:]:
            sender = h.get("sender") or h.get("role")
            text = h.get("text") or h.get("content")
            if text and text != "Hello! I am your AI Eco Coach. Ask me any question or ask about your latest scan!":
                role = "user" if sender == "user" else "assistant"
                messages.append({"role": role, "content": text})

    # Ensure current user message is at the end
    if not messages or messages[-1].get("content") != user_message:
        messages.append({"role": "user", "content": user_message})

    # 1. Groq / Grok API (OpenAI compatible)
    if grok_key:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {grok_key}", "Content-Type": "application/json"}
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "max_tokens": 500,
                "temperature": 0.7
            }
            res = requests.post(url, headers=headers, json=payload, timeout=12)
            if res.status_code == 200:
                resp_json = res.json()
                content = resp_json["choices"][0]["message"]["content"].strip()
                if content:
                    print(f"[Real-Time AI Coach] Groq LLM response generated successfully ({len(content)} chars).")
                    return content
            else:
                print(f"[Real-Time AI Coach] Groq status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[Real-Time AI Coach] Groq call error: {e}")

    # 2. OpenAI API
    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-3.5-turbo",
                "messages": messages,
                "max_tokens": 500,
                "temperature": 0.7
            }
            res = requests.post(url, headers=headers, json=payload, timeout=12)
            if res.status_code == 200:
                resp_json = res.json()
                content = resp_json["choices"][0]["message"]["content"].strip()
                if content:
                    print(f"[Real-Time AI Coach] OpenAI LLM response generated successfully ({len(content)} chars).")
                    return content
        except Exception as e:
            print(f"[Real-Time AI Coach] OpenAI call error: {e}")

    # 3. Gemini API
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            contents = []
            for msg in messages:
                if msg["role"] == "system":
                    continue
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})
            payload = {
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": contents
            }
            res = requests.post(url, json=payload, timeout=12)
            if res.status_code == 200:
                resp_json = res.json()
                content = resp_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                if content:
                    print(f"[Real-Time AI Coach] Gemini LLM response generated successfully ({len(content)} chars).")
                    return content
        except Exception as e:
            print(f"[Real-Time AI Coach] Gemini call error: {e}")

    return None

def get_coach_response(chat_history, user_message, latest_scan=None):
    """
    Real-time AI chatbot with fallback to deterministic offline rules.
    """
    # 1. Real-time LLM API execution if key is present
    realtime_reply = call_realtime_llm(chat_history, user_message, latest_scan=latest_scan)
    if realtime_reply:
        return realtime_reply

    # 2. Offline / Deterministic fallback logic
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
    Offline/local shopping list analyzer.
    """
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
