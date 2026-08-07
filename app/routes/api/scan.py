from flask import request, jsonify
from app.routes.api import api_bp
from app.services.openai_service import analyze_waste_image
from app.services.gamification import add_rewards, get_user_profile
from app.services.firebase import db, SERVER_TIMESTAMP
from app.utils.auth_helper import login_required
import datetime
import uuid

@api_bp.route('/scan', methods=['POST'])
@login_required
def scan_waste():
    """
    Scans a waste item. Accepts file upload ('file') or JSON containing base64.
    Awards XP, Eco Coins, and updates Green Score based on the recycled material.
    """
    user_id = request.form.get('user_id', 'demo_user')
    image_bytes = None
    filename = ""
    
    # Handle multipart file upload
    if 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            filename = file.filename
            image_bytes = file.read()
            
    # Handle base64 JSON payload
    elif request.is_json:
        data = request.get_json()
        user_id = data.get('user_id', 'demo_user')
        base64_image = data.get('image')
        filename = data.get('filename', 'camera_capture.jpg')
        if base64_image:
            import base64
            # Clean base64 header if present
            if ',' in base64_image:
                base64_image = base64_image.split(',')[1]
            image_bytes = base64.b64decode(base64_image)

    # If neither is present, run mock scanning using empty parameters (gets a simulated item)
    result = analyze_waste_image(image_bytes, filename)
    
    # Calculate gamification awards
    xp_award = result.get("reward_earned", 40)
    coins_award = result.get("reward_earned", 40)
    
    # Green score award is proportional to carbon savings
    co2_savings = abs(result.get("co2_impact", 0.05))
    score_award = int(co2_savings * 100)
    if score_award < 10:
        score_award = 15 # Minimum green score bump
        
    # Apply rewards to user profile
    updated_profile = add_rewards(
        user_id=user_id, 
        score_delta=score_award, 
        xp_delta=xp_award, 
        coins_delta=coins_award
    )
    
    # Save the scan history to Firestore
    scan_id = str(uuid.uuid4())
    scan_record = {
        "scan_id": scan_id,
        "user_id": user_id,
        "filename": filename if filename else "unnamed_upload",
        "material": result.get("material"),
        "confidence": result.get("confidence"),
        "recyclable": result.get("recyclable"),
        "reuse_ideas": result.get("reuse_ideas"),
        "repair_ideas": result.get("repair_ideas"),
        "decomposition_time": result.get("decomposition_time"),
        "co2_impact": result.get("co2_impact"),
        "xp_earned": xp_award,
        "coins_earned": coins_award,
        "scanned_at": datetime.datetime.utcnow().isoformat()
    }
    db.collection('scans').document(scan_id).set(scan_record)
    
    return jsonify({
        "success": True,
        "scan": scan_record,
        "profile": updated_profile
    })

@api_bp.route('/scan/history', methods=['GET'])
@login_required
def get_scan_history():
    """Retrieve list of user's past scans."""
    user_id = request.args.get('user_id', 'demo_user')
    scans_ref = db.collection('scans')
    
    # For mock/local support: filter client-side if query isn't fully index-supported
    scans = []
    for doc in scans_ref.stream():
        data = doc.to_dict()
        if data.get('user_id') == user_id:
            scans.append(data)
            
    # Sort scans by scanned_at DESC
    scans.sort(key=lambda s: s.get('scanned_at', ''), reverse=True)
    return jsonify(scans[:10]) # Return last 10 scans
