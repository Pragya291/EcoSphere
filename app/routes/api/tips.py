from flask import request, jsonify
from app.routes.api import api_bp
from app.services.carbon_calculator import calculate_savings
from app.services.gamification import add_rewards, get_user_profile
from app.services.firebase import db, SERVER_TIMESTAMP
from app.utils.auth_helper import login_required
import datetime
import uuid

# Preset habits for the dashboard
RECOMMENDED_HABITS = [
    {
        "id": "habit_commute",
        "title": "Clean Commuting",
        "category": "Transit",
        "description": "Walk, cycle, or take public transport for trips under 5km instead of driving.",
        "co2_impact": "0.12 kg CO2 per km",
        "difficulty": "Medium"
    },
    {
        "id": "habit_appliances",
        "title": "Smart Power Strips",
        "category": "Energy",
        "description": "Use smart power strips to shut down standby current to idle electronics.",
        "co2_impact": "0.38 kg CO2 per kWh",
        "difficulty": "Easy"
    },
    {
        "id": "habit_water",
        "title": "5-Minute Shower limit",
        "category": "Water",
        "description": "Shorten your showers. A 5-minute shower saves over 40 liters of clean water.",
        "co2_impact": "0.18 kg CO2 per minute",
        "difficulty": "Easy"
    },
    {
        "id": "habit_diet",
        "title": "Plant-Rich Days",
        "category": "Food",
        "description": "Swap red meat meals for organic vegetarian alternatives twice a week.",
        "co2_impact": "1.50 kg CO2 per meal",
        "difficulty": "Medium"
    }
]

@api_bp.route('/tips', methods=['GET'])
@login_required
def get_tips():
    """Retrieve list of recommended habits and tips."""
    return jsonify({
        "habits": RECOMMENDED_HABITS,
        "coach_weekly_message": (
            "Great progress this week! Your waste recycling habits prevented 4.2kg of waste "
            "from entering landfills. Focus on reducing electricity standby load to reach Level 5."
        )
    })

@api_bp.route('/tips/log', methods=['POST'])
@login_required
def log_eco_action():
    """
    Log manual sustainability actions (e.g. short shower, biking, paper recycling).
    Invokes the carbon calculator to reward the user with score, XP, and coins.
    """
    data = request.get_json() or {}
    user_id = data.get('user_id', 'demo_user')
    activity_type = data.get('activity_type')  # e.g., 'short_shower', 'bike_or_walk', etc.
    quantity = float(data.get('quantity', 1.0))
    
    if not activity_type:
        return jsonify({"success": False, "message": "Missing activity_type"}), 400
        
    # Calculate savings using Carbon Calculator
    savings = calculate_savings(activity_type, quantity)
    
    # Calculate rewards based on action
    co2_saved = savings.get("co2", 0.0)
    energy_saved = savings.get("energy", 0.0)
    water_saved = savings.get("water", 0.0)
    
    # Scale points
    xp_award = int(co2_saved * 25) + int(water_saved * 0.5) + int(energy_saved * 1.5)
    xp_award = max(min(xp_award, 100), 10)  # bounds: [10, 100]
    coins_award = xp_award
    
    score_award = int(co2_saved * 15)
    score_award = max(min(score_award, 50), 5) # bounds: [5, 50]
    
    # Update profile
    profile = add_rewards(
        user_id=user_id,
        score_delta=score_award,
        xp_delta=xp_award,
        coins_delta=coins_award
    )
    
    # Log action to activities database for carbon trends
    activity_id = str(uuid.uuid4())
    activity_record = {
        "activity_id": activity_id,
        "user_id": user_id,
        "activity_type": activity_type,
        "quantity": quantity,
        "co2_saved": co2_saved,
        "energy_saved": energy_saved,
        "water_saved": water_saved,
        "xp_earned": xp_award,
        "coins_earned": coins_award,
        "logged_at": datetime.datetime.utcnow().isoformat()
    }
    db.collection('activities').document(activity_id).set(activity_record)
    
    # Check if this action completes the water conservation mission
    if activity_type == "short_shower" and quantity >= 5:
        # Check if already completed today
        completed_challenges = profile.get("completed_challenges", [])
        if "water_conservation" not in completed_challenges:
            completed_challenges.append("water_conservation")
            db.collection('users').document(user_id).update({
                "completed_challenges": completed_challenges
            })
            profile = add_rewards(user_id, score_delta=20, xp_delta=30, coins_delta=30)
            savings["mission_completed"] = "Aqua Saver"
            
    return jsonify({
        "success": True,
        "message": f"Action logged successfully! Saved {co2_saved} kg CO2.",
        "savings": savings,
        "profile": profile
    })

@api_bp.route('/activities/history', methods=['GET'])
@login_required
def get_activity_history():
    """Retrieve list of user's past manual eco activities."""
    user_id = request.args.get('user_id', 'demo_user')
    activities_ref = db.collection('activities')
    
    activities = []
    for doc in activities_ref.stream():
        data = doc.to_dict()
        if data.get('user_id') == user_id:
            activities.append(data)
            
    # Sort activities by logged_at DESC
    activities.sort(key=lambda s: s.get('logged_at', ''), reverse=True)
    return jsonify(activities[:15]) # Return last 15 activities
