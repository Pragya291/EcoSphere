from flask import request, jsonify
from app.routes.api import api_bp
from app.services.gamification import add_rewards, get_user_profile
from app.services.firebase import db, SERVER_TIMESTAMP
from app.utils.auth_helper import login_required

DAILY_CHALLENGES = [
    {
        "id": "scan_recycle",
        "title": "Material Analyst",
        "description": "Identify and recycle a plastic or metal item using the AI Waste Scanner.",
        "difficulty": "Easy",
        "xp_reward": 50,
        "coins_reward": 50
    },
    {
        "id": "chat_energy",
        "title": "Energy Audit",
        "description": "Ask the AI Eco Coach about practical methods to reduce household vampire energy loads.",
        "difficulty": "Medium",
        "xp_reward": 40,
        "coins_reward": 40
    },
    {
        "id": "water_conservation",
        "title": "Aqua Saver",
        "description": "Log water conservation by keeping your shower duration under 5 minutes.",
        "difficulty": "Easy",
        "xp_reward": 30,
        "coins_reward": 30
    },
    {
        "id": "eco_marketplace",
        "title": "Eco Patron",
        "description": "Redeem your earned coins to plant a tree or sponsor a carbon offset coupon.",
        "difficulty": "Hard",
        "xp_reward": 80,
        "coins_reward": 80
    }
]

@api_bp.route('/challenges', methods=['GET'])
@login_required
def get_challenges():
    """Retrieve daily missions, along with the user's completion status."""
    user_id = request.args.get('user_id', 'demo_user')
    profile = get_user_profile(user_id)
    completed_ids = profile.get("completed_challenges", [])
    
    challenges_with_status = []
    for ch in DAILY_CHALLENGES:
        c_copy = ch.copy()
        c_copy["completed"] = ch["id"] in completed_ids
        challenges_with_status.append(c_copy)
        
    return jsonify({
        "challenges": challenges_with_status,
        "streak": profile.get("streak", 0)
    })

@api_bp.route('/challenges/complete', methods=['POST'])
@login_required
def complete_challenge():
    """Mark a daily challenge as completed and add rewards to user profile."""
    data = request.get_json() or {}
    user_id = data.get('user_id', 'demo_user')
    challenge_id = data.get('challenge_id')
    
    if not challenge_id:
        return jsonify({"success": False, "message": "Missing challenge_id"}), 400
        
    profile = get_user_profile(user_id)
    completed_ids = profile.get("completed_challenges", [])
    
    if challenge_id in completed_ids:
        return jsonify({"success": True, "message": "Challenge already completed", "profile": profile})
        
    # Find challenge rewards
    challenge = next((c for c in DAILY_CHALLENGES if c["id"] == challenge_id), None)
    if not challenge:
        return jsonify({"success": False, "message": "Challenge not found"}), 404
        
    # Add rewards
    completed_ids.append(challenge_id)
    db.collection('users').document(user_id).update({
        "completed_challenges": completed_ids,
        "updated_at": SERVER_TIMESTAMP
    })
    
    updated_profile = add_rewards(
        user_id=user_id,
        score_delta=20, # Completing a challenge gives +20 Green Score
        xp_delta=challenge["xp_reward"],
        coins_delta=challenge["coins_reward"]
    )
    
    return jsonify({
        "success": True,
        "message": f"Mission '{challenge['title']}' completed! Level up your EcoSphere.",
        "profile": updated_profile
    })
