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
        "confidence": 0.95,
        "recyclable": True,
        "reuse_ideas": [
            "Cut in half to use as a seedling starter pot",
            "Create a self-watering planter container",
            "Clean and reuse for storing dry grains or beads"
        ],
        "repair_ideas": [
            "Not recommended for repair. Recycle or reuse instead."
        ],
        "decomposition_time": "450 years",
        "co2_impact": -0.083,  # savings in kg of CO2 by recycling vs landfill
        "reward_earned": 50
    },
    {
        "material": "Aluminum Soda Can",
        "confidence": 0.98,
        "recyclable": True,
        "reuse_ideas": [
            "Pencil holder for your desk",
            "Crush and use in drainage for plant pots",
            "Construct a small soda-can tab chain decoration"
        ],
        "repair_ideas": [
            "Not applicable for repair. Highly recyclable."
        ],
        "decomposition_time": "200-500 years",
        "co2_impact": -0.160,
        "reward_earned": 60
    },
    {
        "material": "Organic Banana Peel",
        "confidence": 0.99,
        "recyclable": False,
        "reuse_ideas": [
            "Add to backyard compost bin to enrich soil nutrients",
            "Boil in water to create nutrient-rich liquid fertilizer for houseplants",
            "Rub the inside of the peel on leather shoes or houseplant leaves to polish them"
        ],
        "repair_ideas": [
            "Organic material. Composting is the best path."
        ],
        "decomposition_time": "2-10 days",
        "co2_impact": -0.020,  # compost vs landfill methane emissions
        "reward_earned": 40
    },
    {
        "material": "Cardboard Box",
        "confidence": 0.94,
        "recyclable": True,
        "reuse_ideas": [
            "Use as storage boxes for home organization",
            "Lay down as weed barriers in garden beds",
            "Repurpose for packaging shipments"
        ],
        "repair_ideas": [
            "Reinforce seams with eco-friendly paper tape if torn"
        ],
        "decomposition_time": "2 months",
        "co2_impact": -0.110,
        "reward_earned": 30
    },
    {
        "material": "Glass Jar",
        "confidence": 0.97,
        "recyclable": True,
        "reuse_ideas": [
            "Store kitchen bulk ingredients like rice, lentils, or spices",
            "Use as a water glass or smoothy container",
            "Build a stylish candle holder or terrarium"
        ],
        "repair_ideas": [
            "If chipped, do not reuse for food. Upcycle into a vase with protective sealant."
        ],
        "decomposition_time": "1 million years",
        "co2_impact": -0.125,
        "reward_earned": 45
    },
    {
        "material": "E-Waste: Old Smartphone",
        "confidence": 0.91,
        "recyclable": True,  # via e-waste facility
        "reuse_ideas": [
            "Use as a dedicated smart home controller or alarm clock",
            "Donate to a shelter or community organization if functional",
            "Repurpose as an offline media player or security camera"
        ],
        "repair_ideas": [
            "Replace degraded battery, repair screen through local authorized service"
        ],
        "decomposition_time": "1,000+ years (metals and glass don't decompose)",
        "co2_impact": -15.0,  # massive carbon prevention by avoiding manufacturing a new device
        "reward_earned": 150
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
            You are an expert waste classification AI. Analyze the image provided.
            Respond ONLY with a valid JSON object matching this schema:
            {
                "material": "Name of waste material (e.g. Plastic Bottle, Aluminum Can)",
                "confidence": 0.92,
                "recyclable": true/false,
                "reuse_ideas": ["idea 1", "idea 2"],
                "repair_ideas": ["idea 1", "idea 2"],
                "decomposition_time": "Duration (e.g., 450 years)",
                "co2_impact": -0.05, // estimated carbon savings in kg by recycling/proper disposal vs landfill. Use negative number for savings.
                "reward_earned": 50 // integer score between 20 and 150 based on impact
            }
            Do not include markdown tags like ```json in the output. Output pure JSON.
            IMPORTANT: If the image is not a physical waste item (e.g. text slide, chart, digital logo), classify it as "Infographic flyer / Printed paper document" and output the JSON immediately. Do not write any conversational preamble or thinking blocks. Start your output directly with the JSON object.
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
                # Legacy openai v0.x call
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
                
            return extract_json_payload(res_content)
        except Exception as e:
            print(f"OpenAI Vision API error: {e}. Falling back to simulation.")
    
    # Keyword based simulation fallback
    fn_lower = filename.lower()
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
    elif "phone" in fn_lower or "electronic" in fn_lower or "battery" in fn_lower:
        return SIMULATED_ITEMS[5]
    
    # Pick a random one for visual demonstration
    return random.choice(SIMULATED_ITEMS)

def get_coach_response(chat_history, user_message):
    """
    Get response from the Eco Coach.
    Includes fallback rules based on message content for offline/demo mode.
    """
    if client:
        try:
            # Build chat completions messages list
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are EcoCoach, the premium AI companion on the EcoSphere platform. "
                        "You sound like a mix of Stripe design polish, Apple elegance, and Linear precision: "
                        "professional, extremely insightful, encouraging, and clear. Avoid typical conversational filler. "
                        "Provide practical carbon-saving tips. Keep responses under 4 sentences unless asked otherwise. "
                        "Keep your response tone premium, venture-backed SaaS style."
                    )
                }
            ]
            
            # Add history
            for chat in chat_history:
                role = "user" if chat['sender'] == 'user' else "assistant"
                messages.append({"role": role, "content": chat['text']})
            
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
                    max_tokens=250
                )
                return response.choices[0].message.content
            else:
                # Legacy openai v0.x call
                response = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=messages,
                    max_tokens=250
                )
                return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI Chat API error: {e}. Falling back to simulation.")

    # Rule-based coach response simulation
    msg = user_message.lower()
    if "hello" in msg or "hi" in msg:
        return "Greetings from EcoSphere AI. I am your Sustainability Coach. How can I assist you with your carbon offset goals or waste scanning metrics today?"
    elif "compost" in msg or "food" in msg or "waste" in msg:
        return "Composting organic matter is highly effective. It diverts organic waste from landfills where it would otherwise generate methane, a greenhouse gas 25x more potent than CO2. Ensure you mix 'greens' (nitrogen-rich food scraps) and 'browns' (carbon-rich cardboard, dry leaves) in a 1:2 ratio."
    elif "energy" in msg or "electricity" in msg or "solar" in msg:
        return "To optimize household energy efficiency, address standby power consumption ('vampire loads') by using smart power strips. Transitioning to LED lighting yields up to 75% savings, and implementing a smart thermostat reduces heating and cooling energy use by roughly 10-15%."
    elif "water" in msg or "shower" in msg:
        return "Reducing shower duration to 5 minutes saves up to 40 liters of water per session. Additionally, installing low-flow aerators on faucets yields high savings with negligible drop in water pressure. Every liter conserved reduces the energy required to treat and transport water."
    elif "plastic" in msg or "recycle" in msg:
        return "Recycling is critical but often contaminated. Always rinse food containers to prevent mold and contamination. Focus on Plastics #1 (PET) and #2 (HDPE) as they have high market demand and recycling efficiency. Thin plastics, like wraps and bags, require specialized drop-offs."
    elif "score" in msg or "points" in msg or "earn" in msg:
        return "You can increase your EcoSphere Green Score by scanning household waste items, completing Daily Missions, and logging resource savings. Every 100 points will help grow your Living EcoSphere garden from a seed into a sustainable Smart Eco City."
    
    # General responses list
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

