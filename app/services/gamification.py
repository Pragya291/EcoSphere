import datetime
from app.services.firebase import db, SERVER_TIMESTAMP

# Define EcoSphere progression phases based on Green Score
ECOSPHERE_PHASES = [
    {"name": "Seed", "min_score": 0, "max_score": 100},
    {"name": "Plant", "min_score": 101, "max_score": 250},
    {"name": "Tree", "min_score": 251, "max_score": 400},
    {"name": "Forest", "min_score": 401, "max_score": 550},
    {"name": "River", "min_score": 551, "max_score": 700},
    {"name": "Wildlife", "min_score": 701, "max_score": 850},
    {"name": "Nature Reserve", "min_score": 851, "max_score": 950},
    {"name": "Smart Eco City", "min_score": 951, "max_score": 99999}
]

def get_phase_name(green_score):
    """Map a green score (0-1000) to an EcoSphere evolution phase."""
    for phase in ECOSPHERE_PHASES:
        if green_score <= phase["max_score"]:
            return phase["name"]
    return "Smart Eco City"

def get_user_profile(user_id="demo_user"):
    """
    Retrieves full user gamification stats.
    Initializes a default profile if the user document is empty.
    """
    doc_ref = db.collection('users').document(user_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        # Starting template profile for a premium demo experience
        profile = {
            "user_id": user_id,
            "green_score": 745,            # Animated high score out of 1000
            "xp": 3820,                    # Experience points
            "coins": 450,                  # Eco coins for marketplace redemptions
            "streak": 6,                   # Weekly streak days
            "rank": 4,                     # Current user rank on leaderboard
            "completed_challenges": [],     # IDs of completed challenges today
            "inventory": []                # Purchased marketplace coupons / certificates
        }
        doc_ref.set(profile)
    else:
        profile = doc.to_dict()
        # Handle backward compatibility/missing fields
        profile.setdefault("green_score", 745)
        profile.setdefault("xp", 3820)
        profile.setdefault("coins", 450)
        profile.setdefault("streak", 6)
        profile.setdefault("rank", 4)
        profile.setdefault("completed_challenges", [])
        profile.setdefault("inventory", [])
        profile["user_id"] = user_id

    # Compute level and level progress percentage
    # Level formula: Every 1000 XP is a level. Level 1 starts at 0 XP.
    profile["level"] = int(profile["xp"] / 1000) + 1
    profile["next_level_xp"] = profile["level"] * 1000
    profile["current_level_base_xp"] = (profile["level"] - 1) * 1000
    profile["level_progress"] = int(((profile["xp"] - profile["current_level_base_xp"]) / 1000.0) * 100)
    profile["phase"] = get_phase_name(profile["green_score"])
    
    return profile

def add_rewards(user_id="demo_user", score_delta=0, xp_delta=0, coins_delta=0):
    """Increments user metrics (Green Score, XP, Coins) and stores in Firestore."""
    profile = get_user_profile(user_id)
    
    # Calculate new values with limits
    new_score = min(max(profile["green_score"] + score_delta, 0), 1000)
    new_xp = max(profile["xp"] + xp_delta, 0)
    new_coins = max(profile["coins"] + coins_delta, 0)
    
    updates = {
        "green_score": new_score,
        "xp": new_xp,
        "coins": new_coins,
        "updated_at": SERVER_TIMESTAMP
    }
    
    # Handle random streak increments for demonstration
    # (In real app, this is calculated on consecutive daily logins)
    db.collection('users').document(user_id).update(updates)
    
    return get_user_profile(user_id)

def redeem_coins(user_id="demo_user", item_id="", item_cost=0, reward_text=""):
    """Deducts coins from user balance and adds item to inventory if affordable."""
    profile = get_user_profile(user_id)
    
    if profile["coins"] < item_cost:
        return {"success": False, "message": f"Insufficient Eco Coins. Need {item_cost - profile['coins']} more coins."}
    
    new_coins = profile["coins"] - item_cost
    inventory = profile.get("inventory", [])
    inventory.append({
        "item_id": item_id,
        "purchased_at": datetime.datetime.utcnow().isoformat(),
        "reward_text": reward_text
    })
    
    db.collection('users').document(user_id).update({
        "coins": new_coins,
        "inventory": inventory,
        "updated_at": SERVER_TIMESTAMP
    })
    
    # Also reward user with small Green Score bump (+15) for planting tree/doing eco action
    add_rewards(user_id, score_delta=15, xp_delta=50, coins_delta=0)
    
    updated_profile = get_user_profile(user_id)
    return {
        "success": True, 
        "message": f"Successfully redeemed! {reward_text}", 
        "profile": updated_profile
    }
