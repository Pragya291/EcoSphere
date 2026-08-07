from flask import jsonify, request
from app.routes.api import api_bp
from app.services.gamification import add_rewards, get_user_profile
from app.utils.auth_helper import login_required

@api_bp.route('/score', methods=['GET'])
@login_required
def get_score():
    user_id = request.args.get('user_id', 'demo_user')
    profile = get_user_profile(user_id)
    return jsonify({'score': profile.get('green_score', 0)})

@api_bp.route('/score', methods=['POST'])
@login_required
def update_score():
    data = request.get_json() or {}
    user_id = data.get('user_id', 'demo_user')
    points = data.get('points', 0)
    profile = add_rewards(user_id, score_delta=points, xp_delta=points, coins_delta=points)
    return jsonify({'new_score': profile.get('green_score', 0)})

