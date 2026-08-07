from flask import request, jsonify
from app.routes.api import api_bp
from app.services.gamification import get_user_profile, redeem_coins, add_rewards
from app.services.firebase import db
from app.utils.auth_helper import login_required

# Mock leaderboard data with premium branding (venture-backed ESG feel)
LEADERBOARD_GLOBAL = [
    {"rank": 1, "username": "Elena Vance", "green_score": 962, "level": 12, "badge": "♻️ Carbon Elite"},
    {"rank": 2, "username": "Marcus Aurelius", "green_score": 890, "level": 10, "badge": "🌳 Canopy Warden"},
    {"rank": 3, "username": "Sophie Germain", "green_score": 815, "level": 8, "badge": "⚡ Power Optimizer"},
    {"rank": 4, "username": "You (demo_user)", "green_score": 745, "level": 4, "badge": "🌱 Eco Catalyst"}, # Dynamically syncs with score
    {"rank": 5, "username": "Alan Turing", "green_score": 680, "level": 6, "badge": "📊 Data Conservationist"},
    {"rank": 6, "username": "Ada Lovelace", "green_score": 612, "level": 5, "badge": "💧 Aqua Guardian"}
]

LEADERBOARD_UNIVERSITIES = [
    {"rank": 1, "name": "Stanford University", "green_score": 875, "total_trees": 1420, "percentile": 99},
    {"rank": 2, "name": "MIT (Eco Club)", "green_score": 842, "total_trees": 1150, "percentile": 95},
    {"rank": 3, "name": "UC Berkeley", "green_score": 795, "total_trees": 980, "percentile": 89},
    {"rank": 4, "name": "Harvard CleanTech", "green_score": 710, "total_trees": 640, "percentile": 78},
    {"rank": 5, "name": "Oxford Sustainability", "green_score": 690, "total_trees": 580, "percentile": 74}
]

MARKETPLACE_ITEMS = [
    {
        "id": "plant_tree",
        "title": "Plant a Mangrove Tree",
        "description": "Sponsor planting a real mangrove tree in Madagascar via Eden Reforestation Projects.",
        "cost": 150,
        "category": "Action",
        "reward_text": "Mangrove Tree Planted in Madagascar!"
    },
    {
        "id": "ngo_donate",
        "title": "Ocean Cleanup Contribution",
        "description": "Redeem coins to donate $5 directly to Plastic Oceans NGO to clean marine habitats.",
        "cost": 200,
        "category": "Donation",
        "reward_text": "$5 donated to Plastic Oceans!"
    },
    {
        "id": "carbon_offset",
        "title": "50kg Verified CO₂ Offset",
        "description": "Retire a verified carbon credit certificate representing 50kg CO₂ reduction via Gold Standard.",
        "cost": 100,
        "category": "Offset",
        "reward_text": "50kg CO₂ Offset Certificate Issued!"
    },
    {
        "id": "premium_theme",
        "title": "Glassmorphism Themes",
        "description": "Unlock premium UI styles: Cyberpunk Neon, Aurora Borealis, or Sahara Desert layouts.",
        "cost": 80,
        "category": "Cosmetic",
        "reward_text": "Premium Themes Unlocked in Settings!"
    },
    {
        "id": "certificate",
        "title": "Verified Carbon Champion",
        "description": "An official downloadable cryptographic certificate signed by EcoSphere AI.",
        "cost": 300,
        "category": "Certificate",
        "reward_text": "Carbon Champion Certificate generated!"
    }
]

@api_bp.route('/passport', methods=['GET'])
@login_required
def get_passport():
    """Retrieve user statistics, inventory, badges, and leaderboard rankings."""
    user_id = request.args.get('user_id', 'demo_user')
    profile = get_user_profile(user_id)
    
    # Sync "You" on leaderboard with profile
    for p in LEADERBOARD_GLOBAL:
        if "You" in p["username"]:
            p["green_score"] = profile["green_score"]
            p["level"] = profile["level"]
            p["badge"] = f"🌱 {profile['phase']}"
            
    # Sort leaderboard in case "You" changes
    LEADERBOARD_GLOBAL.sort(key=lambda x: x["green_score"], reverse=True)
    for index, p in enumerate(LEADERBOARD_GLOBAL):
        p["rank"] = index + 1
        
    return jsonify({
        "profile": profile,
        "leaderboard_global": LEADERBOARD_GLOBAL,
        "leaderboard_universities": LEADERBOARD_UNIVERSITIES,
        "marketplace_items": MARKETPLACE_ITEMS
    })

@api_bp.route('/passport/redeem', methods=['POST'])
@login_required
def redeem_marketplace():
    """Redeem eco coins for marketplace rewards."""
    data = request.get_json() or {}
    user_id = data.get('user_id', 'demo_user')
    item_id = data.get('item_id')
    
    if not item_id:
        return jsonify({"success": False, "message": "Missing item_id"}), 400
        
    # Find marketplace item
    item = next((i for i in MARKETPLACE_ITEMS if i["id"] == item_id), None)
    if not item:
        return jsonify({"success": False, "message": "Marketplace item not found"}), 404
        
    result = redeem_coins(
        user_id=user_id,
        item_id=item_id,
        item_cost=item["cost"],
        reward_text=item["reward_text"]
    )
    
    # Check if this redeem completes the marketplace challenge
    if result.get("success"):
        profile = result["profile"]
        completed_challenges = profile.get("completed_challenges", [])
        if "eco_marketplace" not in completed_challenges:
            completed_challenges.append("eco_marketplace")
            db.collection('users').document(user_id).update({
                "completed_challenges": completed_challenges
            })
            profile = add_rewards(user_id, score_delta=20, xp_delta=80, coins_delta=80)
            result["profile"] = profile
            result["mission_completed"] = "Eco Patron"
            
    return jsonify(result)
