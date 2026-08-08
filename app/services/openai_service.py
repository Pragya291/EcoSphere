import os
import json
import base64
import random
from app.config import Config

# Handle OpenAI version differences (v0.x legacy vs v1.x new)
try:
    from openai import OpenAI
    HAS_NEW_OPENAI = True
except ImportError:
    import openai
    HAS_NEW_OPENAI = False

# Initialize OpenAI Client, Grok Client, or Groq Client
api_key = Config.OPENAI_API_KEY
grok_key = Config.GROK_API_KEY

def extract_json_payload(text):
    """Robust helper to extract JSON dictionary wherever it resides in model output."""
    clean_text = text.strip()
    
    # Strip reasoning/thinking block if present
    if "</think>" in clean_text:
        parts = clean_text.split("</think>")
        if len(parts) > 1:
            clean_text = parts[1].strip()
            
    try:
        start_idx = clean_text.find('{')
        end_idx = clean_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_block = clean_text[start_idx:end_idx+1]
            return json.loads(json_block)
    except Exception:
        pass
        
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]
    clean_text = clean_text.strip()
    return json.loads(clean_text)


def infer_material_from_text(text):
    """Infer a likely waste item from raw model text when strict JSON parsing fails."""
    if not isinstance(text, str):
        return None
    lower = text.lower()
    if "plastic bottle" in lower or "water bottle" in lower or ("bottle" in lower and "plastic" in lower):
        item = SIMULATED_ITEMS[0].copy()
        item["confidence"] = 0.72
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "aluminum can" in lower or "soda can" in lower or "metal can" in lower or "can" in lower:
        item = SIMULATED_ITEMS[1].copy()
        item["confidence"] = 0.75
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "banana peel" in lower or "apple core" in lower or "food waste" in lower or "organic" in lower:
        item = SIMULATED_ITEMS[2].copy()
        item["confidence"] = 0.78
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "cardboard" in lower or "shipping box" in lower or "paper" in lower:
        item = SIMULATED_ITEMS[3].copy()
        item["confidence"] = 0.77
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "glass jar" in lower or "glass bottle" in lower or "glass" in lower:
        item = SIMULATED_ITEMS[4].copy()
        item["confidence"] = 0.76
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "smartphone" in lower or "phone" in lower or "electronic waste" in lower or "battery" in lower:
        item = SIMULATED_ITEMS[5].copy()
        item["confidence"] = 0.72
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "reusable" in lower or "steel water bottle" in lower or "stainless steel" in lower:
        item = SIMULATED_ITEMS[6].copy()
        item["confidence"] = 0.76
        item["explanation"] = item["explanation"] + " (Inference used when raw model text could not be parsed as JSON.)"
        return item
    if "unknown" in lower or "could not" in lower or "cannot identify" in lower or "unidentifiable" in lower:
        return {
            "material": "Unknown Waste Item",
            "category": "Unknown",
            "confidence": 0.45,
            "recyclable": False,
            "disposal_recommendation": "The item could not be confidently identified. Please retake the photo with better lighting and a clear view, or consult local sorting guidelines.",
            "environmental_impact": "Unknown - unclear item classification.",
            "eco_alternative": "Choose reusable, durable, and low-waste products where possible.",
            "explanation": "The scanner could not confidently classify this object from the provided image.",
            "is_uncertain": True,
            "reuse_ideas": [
                "Retake the photo using a clear background and good lighting.",
                "Compare the item with local recycling categories.",
                "Bring the item to a nearby recycling center for expert sorting advice."
            ],
            "repair_ideas": [
                "If the item is damaged, consider repairing or repurposing it rather than discarding it."
            ],
            "decomposition_time": "Unknown",
            "co2_impact": 0.0,
            "reward_earned": 25
        }
    return None

client = None
is_grok = False
is_groq = False

if grok_key:
    try:
        if HAS_NEW_OPENAI:
            if grok_key.strip().startswith("gsk_"):
                # Groq LPU Endpoint
                client = OpenAI(api_key=grok_key.strip(), base_url="https://api.groq.com/openai/v1")
                is_groq = True
                print("Initialized Groq LPU API client.")
            else:
                # xAI Grok Endpoint
                client = OpenAI(api_key=grok_key.strip(), base_url="https://api.x.ai/v1")
                is_grok = True
                print("Initialized xAI Grok API client.")
    except Exception as e:
        print(f"Failed to initialize Grok/Groq client: {e}")

if not client and api_key:
    try:
        if HAS_NEW_OPENAI:
            client = OpenAI(api_key=api_key)
            print("Initialized OpenAI client.")
        else:
            openai.api_key = api_key
            client = "legacy"
    except Exception as e:
        print(f"Failed to initialize OpenAI client: {e}")

# Preset simulated waste scan items for robust offline demo
SIMULATED_ITEMS = [
    {
        "material": "PET Plastic Bottle",
        "category": "Plastic Packaging",
        "confidence": 0.95,
        "recyclable": True,
        "disposal_recommendation": "Empty, rinse and place in the plastic recycling bin.",
        "environmental_impact": "Moderate (450 yrs breakdown)",
        "eco_alternative": "Switch to a reusable stainless steel water bottle.",
        "explanation": "PET (#1) is highly recyclable into polyester fibers and new bottles.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Cut in half to use as a seedling starter pot",
            "Create a self-watering planter container",
            "Clean and reuse for storing dry grains or craft supplies"
        ],
        "repair_ideas": [
            "Not recommended for repair. Recycle or upcycle instead."
        ],
        "decomposition_time": "450 years",
        "co2_impact": -0.083,  # savings in kg of CO2 by recycling vs landfill
        "reward_earned": 50
    },
    {
        "material": "Aluminum Beverage Can",
        "category": "Metal Can",
        "confidence": 0.98,
        "recyclable": True,
        "disposal_recommendation": "Rinse out liquids and drop in metal/can recycling bin.",
        "environmental_impact": "High energy impact (recycling saves 95% energy)",
        "eco_alternative": "Choose bulk fountain drinks or reusable flasks.",
        "explanation": "Infinitely recyclable metal. Remelting saves 95% of raw production energy.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Pencil holder for your desk",
            "Crush and use in drainage layer for potted plants",
            "Construct a soda-can tab chain decoration"
        ],
        "repair_ideas": [
            "Highly recyclable metal; recycling is preferred."
        ],
        "decomposition_time": "200-500 years",
        "co2_impact": -0.160,
        "reward_earned": 60
    },
    {
        "material": "Organic Food Waste (Banana Peel)",
        "category": "Organic Waste",
        "confidence": 0.99,
        "recyclable": False,
        "disposal_recommendation": "Place in organic compost bin or backyard garden soil.",
        "environmental_impact": "Low (Generates methane if landfilled, rich fertilizer if composted)",
        "eco_alternative": "Use fruit scraps to brew natural home fertilizer tea.",
        "explanation": "Decomposes rapidly into nutrient-rich humus for garden plants.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Add to backyard compost bin to enrich soil nutrients",
            "Boil in water to create nutrient-rich liquid fertilizer for houseplants",
            "Rub inside of peel on plant leaves to clean and polish them"
        ],
        "repair_ideas": [
            "Natural organic scrap. Composting is optimal."
        ],
        "decomposition_time": "2-10 days",
        "co2_impact": -0.020,
        "reward_earned": 40
    },
    {
        "material": "Cardboard Shipping Box",
        "category": "Cardboard / Paper",
        "confidence": 0.94,
        "recyclable": True,
        "disposal_recommendation": "Flatten box, remove plastic tape, place in paper/cardboard recycling.",
        "environmental_impact": "Moderate (Requires forest wood fiber)",
        "eco_alternative": "Use reusable tote bags or plastic storage totes.",
        "explanation": "Cardboard fibers can be recycled 5-7 times into new packaging.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Use as storage boxes for home organization",
            "Lay down as weed barrier under garden mulch",
            "Repurpose for packaging future shipments"
        ],
        "repair_ideas": [
            "Reinforce torn seams with paper tape if reusing."
        ],
        "decomposition_time": "2 months",
        "co2_impact": -0.110,
        "reward_earned": 35
    },
    {
        "material": "Glass Jar Container",
        "category": "Glass",
        "confidence": 0.97,
        "recyclable": True,
        "disposal_recommendation": "Rinse jar, remove lid, drop in glass recycling bottle bank.",
        "environmental_impact": "Low chemical toxicity (1 million yrs breakdown)",
        "eco_alternative": "Reusable glass food containers (which this is!).",
        "explanation": "100% infinitely recyclable without quality loss.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Store kitchen bulk ingredients like rice, lentils, or spices",
            "Use as a drinking glass or smoothie container",
            "Build a stylish candle holder or miniature terrarium"
        ],
        "repair_ideas": [
            "If chipped, do not use for food. Upcycle into decorative vase."
        ],
        "decomposition_time": "1 million years",
        "co2_impact": -0.125,
        "reward_earned": 45
    },
    {
        "material": "E-Waste: Disused Smartphone",
        "category": "Electronic Waste",
        "confidence": 0.91,
        "recyclable": True,
        "disposal_recommendation": "Do NOT trash. Bring to certified electronic waste drop-off facility.",
        "environmental_impact": "Very High (Precious metals, lithium battery hazards)",
        "eco_alternative": "Repair existing phone or buy refurbished electronics.",
        "explanation": "Contains gold, copper, cobalt & rare earth elements requiring specialized recovery.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Use as a dedicated smart home controller or desk clock",
            "Donate to community organization if functional",
            "Repurpose as an offline music player or dash cam"
        ],
        "repair_ideas": [
            "Replace battery or screen through certified local technician."
        ],
        "decomposition_time": "1,000+ years",
        "co2_impact": -15.0,
        "reward_earned": 120
    },
    {
        "material": "Reusable Stainless Steel Water Bottle",
        "category": "Eco-friendly product",
        "confidence": 0.96,
        "recyclable": True,
        "disposal_recommendation": "Keep using! Stainless steel is durable for 10+ years.",
        "environmental_impact": "Very High Savings (Replaces 1,000+ single-use plastic bottles)",
        "eco_alternative": "You are already using the best eco alternative!",
        "explanation": "High durability zero-waste product. Eliminates single-use plastic waste stream.",
        "is_uncertain": False,
        "reuse_ideas": [
            "Daily hydration companion for office, gym, and travel",
            "Insulated thermos for hot tea or cold beverages"
        ],
        "repair_ideas": [
            "Replace rubber lid seal ring if leaking."
        ],
        "decomposition_time": "500+ years",
        "co2_impact": -2.50,
        "reward_earned": 75
    }
]

def analyze_waste_image(image_bytes=None, filename=""):
    """
    Analyzes waste image using OpenAI Vision API.
    If API key is missing or request fails, simulates response based on filename or random item.
    """
    if client and image_bytes:
        try:
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            prompt = """
            You are an expert waste & sustainability classification AI. Analyze the provided image.
            Return ONLY a valid JSON object matching this schema exactly:
            {
                "material": "Specific name of object (e.g. PET Plastic Bottle, Glass Jar, Solar Panel, Banana Peel, Cotton Shirt)",
                "category": "Category name (e.g., Plastic Packaging, Metal Can, Glass, Organic Waste, Cardboard / Paper, Electronic Waste, Eco-friendly product, Textile)",
                "confidence": 0.95, // float between 0.10 and 0.99
                "recyclable": true, // boolean
                "disposal_recommendation": "Clear step-by-step recommendation on how to dispose, recycle or compost this item",
                "environmental_impact": "Summary of eco impact (e.g. High, Moderate, Low with brief reason)",
                "eco_alternative": "Recommended sustainable eco-friendly alternative to single-use version",
                "explanation": "Detailed scientific explanation of material composition and recycling path",
                "is_uncertain": false, // set to true ONLY if image is blurry, extremely dark, or unidentifiable as any object
                "reuse_ideas": ["Practical upcycling idea 1", "Practical upcycling idea 2"],
                "repair_ideas": ["Repair or care tip"],
                "decomposition_time": "Estimated duration (e.g., 450 years, 2 months)",
                "co2_impact": -0.083, // estimated carbon savings in kg by recycling/proper disposal vs landfill. Use negative number for savings.
                "reward_earned": 50 // integer score between 25 and 120 based on environmental impact
            }
            Do not include markdown code block backticks like ```json in your response. Output pure raw JSON.
            Start directly with '{' and end with '}'.
            """
            
            if is_groq:
                model_name = "qwen/qwen3.6-27b"
            elif is_grok:
                model_name = "grok-2-vision-preview"
            else:
                model_name = "gpt-4o-mini"

            kwargs = {
                "model": model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a professional sustainability AI assistant that returns JSON reports. /no_think"
                            if is_groq else
                            "You are a professional sustainability AI assistant that returns JSON reports."
                        )
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
                            "content": "You are a professional sustainability AI assistant that returns JSON reports."
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
                    max_tokens=600
                )
                res_content = response.choices[0].message.content
                
            parsed = None
            try:
                parsed = extract_json_payload(res_content)
            except Exception:
                parsed = None

            if parsed and isinstance(parsed, dict) and "material" in parsed:
                # Ensure default fallback values for any missing fields
                parsed.setdefault("category", "General Waste")
                parsed.setdefault("confidence", 0.90)
                parsed.setdefault("disposal_recommendation", "Rinse and dispose of in local recycling bin.")
                parsed.setdefault("environmental_impact", "Moderate")
                parsed.setdefault("eco_alternative", "Choose reusable zero-waste options.")
                parsed.setdefault("explanation", "Scanned and evaluated by EcoSphere Vision AI.")
                parsed.setdefault("is_uncertain", False)
                return parsed

            # Attempt to infer material from raw text when the model response is not valid JSON
            inferred = infer_material_from_text(res_content)
            if inferred:
                return inferred
        except Exception as e:
            print(f"OpenAI Vision API error: {e}. Falling back to smart keyword simulation.")
    
    # Keyword based simulation fallback
    fn_lower = filename.lower()
    generic_filename = fn_lower in ["camera_capture.jpg", "cam_shot.jpg", "photo.jpg", "image.jpg", "scan.jpg", "receipt.jpg"]
    if "bottle" in fn_lower or "plastic" in fn_lower:
        return SIMULATED_ITEMS[0]
    elif "can" in fn_lower or "metal" in fn_lower or "aluminum" in fn_lower:
        return SIMULATED_ITEMS[1]
    elif "banana" in fn_lower or "peel" in fn_lower or "apple" in fn_lower or "food" in fn_lower or "organic" in fn_lower:
        return SIMULATED_ITEMS[2]
    elif "box" in fn_lower or "cardboard" in fn_lower or "paper" in fn_lower:
        return SIMULATED_ITEMS[3]
    elif "jar" in fn_lower or "glass" in fn_lower:
        return SIMULATED_ITEMS[4]
    elif "phone" in fn_lower or "electronic" in fn_lower or "battery" in fn_lower or "ewaste" in fn_lower:
        return SIMULATED_ITEMS[5]
    elif "reusable" in fn_lower or "steel" in fn_lower:
        return SIMULATED_ITEMS[6]
    
    # Use safer unknown fallback for generic or ambiguous filenames
    if generic_filename or not any(keyword in fn_lower for keyword in ["bottle", "plastic", "can", "metal", "aluminum", "banana", "peel", "apple", "food", "organic", "box", "cardboard", "paper", "jar", "glass", "phone", "electronic", "battery", "ewaste", "reusable", "steel"]):
        return {
            "material": "Unknown Waste Item",
            "category": "Unknown",
            "confidence": 0.45,
            "recyclable": False,
            "disposal_recommendation": "The item could not be confidently identified. Please retake the photo with better lighting and a clear view, or consult local sorting guidelines.",
            "environmental_impact": "Unknown - unclear item classification.",
            "eco_alternative": "Choose reusable, durable, and low-waste products where possible.",
            "explanation": "The scanner could not confidently classify this object from the provided image.",
            "is_uncertain": True,
            "reuse_ideas": [
                "Retake the photo using a clear background and good lighting.",
                "Compare the item with local recycling categories.",
                "Bring the item to a nearby recycling center for expert sorting advice."
            ],
            "repair_ideas": [
                "If the item is damaged, consider repairing or repurposing it rather than discarding it."
            ],
            "decomposition_time": "Unknown",
            "co2_impact": 0.0,
            "reward_earned": 25
        }

    return random.choice(SIMULATED_ITEMS)

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
            # Build chat completions messages list
            system_instruction = (
                "You are EcoCoach, the premium AI companion on the EcoSphere platform. "
                "You sound like a mix of Stripe design polish, Apple elegance, and Linear precision: "
                "professional, extremely insightful, encouraging, and clear. "
                "Provide practical carbon-saving tips. Keep responses under 4 sentences unless asked otherwise. "
                + scan_context_prompt
            )

            messages = [{"role": "system", "content": system_instruction}]
            
            # Add history
            for chat in chat_history:
                role = "user" if chat.get('sender') == 'user' else "assistant"
                messages.append({"role": role, "content": chat.get('text', '')})
            
            messages.append({"role": "user", "content": user_message})
            
            if is_groq:
                chat_model = "llama-3.3-70b-versatile"
            elif is_grok:
                chat_model = "grok-beta"
            else:
                chat_model = "gpt-4o-mini"

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

    # Rule-based coach response simulation with scan context
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
            
            model_name = "qwen/qwen3.6-27b" if is_groq else ("grok-2-vision-preview" if is_grok else "gpt-4o-mini")
            kwargs = {
                "model": model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a professional ESG auditor that returns itemized JSON reports. /no_think"
                            if is_groq else
                            "You are a professional ESG auditor that returns itemized JSON reports."
                        )
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

