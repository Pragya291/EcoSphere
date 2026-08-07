from flask import jsonify, request
from app.routes.api import api_bp
from app.services.firebase import get_user_score, update_user_score
from app.services.gamification import add_points

@api_bp.route('/score', methods=['GET'])
def get_score():
    user_id = request.args.get('user_id', 'demo_user')
    score = get_user_score(user_id)
    return jsonify({'score': score})

@api_bp.route('/score', methods=['POST'])
def update_score():
    data = request.get_json()
    user_id = data.get('user_id', 'demo_user')
    points = data.get('points', 0)
    new_score = add_points(user_id, points)
    return jsonify({'new_score': new_score})
