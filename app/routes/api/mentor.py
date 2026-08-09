from flask import request, jsonify
from app.routes.api import api_bp
from app.services.ai_service import get_coach_response
from app.services.gamification import get_user_profile, add_rewards
from app.services.firebase import db, SERVER_TIMESTAMP
from app.utils.auth_helper import login_required

@api_bp.route('/mentor', methods=['POST'])
@login_required
def chat_coach():
    """
    Chat with the AI Eco Coach.
    Checks message content to complete the Energy Audit challenge.
    """
    data = request.get_json() or {}
    user_id = data.get('user_id', 'demo_user')
    message = data.get('message', '')
    history = data.get('history', [])  # list of dicts: {'sender': 'user'/'coach', 'text': '...'}
    latest_scan = data.get('latest_scan', None)
    
    if not message:
        return jsonify({"success": False, "message": "Missing message"}), 400
        
    # Get response from AI Eco Coach (with scan context awareness)
    response_text = get_coach_response(history, message, latest_scan=latest_scan)
    
    # Check if this chat completes the "chat_energy" mission
    completed_mission = None
    profile = get_user_profile(user_id)
    completed_challenges = profile.get("completed_challenges", [])
    
    msg_lower = message.lower()
    if ("energy" in msg_lower or "power" in msg_lower or "solar" in msg_lower or "vampire" in msg_lower) and "chat_energy" not in completed_challenges:
        completed_challenges.append("chat_energy")
        db.collection('users').document(user_id).update({
            "completed_challenges": completed_challenges,
            "updated_at": SERVER_TIMESTAMP
        })
        profile = add_rewards(user_id, score_delta=20, xp_delta=40, coins_delta=40)
        completed_mission = "Energy Audit"
        
    return jsonify({
        "success": True,
        "response": response_text,
        "completed_mission": completed_mission,
        "profile": profile
    })
