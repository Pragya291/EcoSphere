from app.services.firebase import update_user_score, get_user_score

def add_points(user_id, points):
    current = get_user_score(user_id)
    new_score = current + points
    update_user_score(user_id, new_score)
    return new_score
