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

    result = analyze_waste_image(image_bytes, filename)
    
    # Prevent duplicate farming (same user scanning exact same material within 30 seconds)
    scans_ref = db.collection('scans')
    is_duplicate = False
    now_iso = datetime.datetime.utcnow()
    
    try:
        user_recent_scans = [doc.to_dict() for doc in scans_ref.stream() if doc.to_dict().get('user_id') == user_id]
        if user_recent_scans:
            user_recent_scans.sort(key=lambda s: s.get('scanned_at', ''), reverse=True)
            latest = user_recent_scans[0]
            if latest.get('material') == result.get('material'):
                scan_time = datetime.datetime.fromisoformat(latest.get('scanned_at', '2026-01-01T00:00:00'))
                time_diff = (now_iso - scan_time).total_seconds()
                if time_diff < 30:
                    is_duplicate = True
    except Exception as e:
        print(f"Error checking duplicate scan: {e}")

    # Calculate gamification awards
    if is_duplicate:
        xp_award = 0
        coins_award = 0
        score_award = 0
    else:
        xp_award = result.get("reward_earned", 40)
        coins_award = result.get("reward_earned", 40)
        co2_savings = abs(result.get("co2_impact", 0.05))
        score_award = int(co2_savings * 100)
        if score_award < 15:
            score_award = 15
        
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
        "filename": filename if filename else "camera_capture.jpg",
        "material": result.get("material", "PET Plastic Bottle"),
        "category": result.get("category", "Plastic Packaging"),
        "confidence": result.get("confidence", 0.95),
        "recyclable": result.get("recyclable", True),
        "disposal_recommendation": result.get("disposal_recommendation", "Rinse and place in plastic recycling bin."),
        "environmental_impact": result.get("environmental_impact", "Moderate"),
        "eco_alternative": result.get("eco_alternative", "Use a reusable container."),
        "explanation": result.get("explanation", "Scanned & analyzed by EcoSphere AI."),
        "is_uncertain": result.get("is_uncertain", False),
        "reuse_ideas": result.get("reuse_ideas", []),
        "repair_ideas": result.get("repair_ideas", []),
        "decomposition_time": result.get("decomposition_time", "450 years"),
        "co2_impact": result.get("co2_impact", -0.083),
        "xp_earned": xp_award,
        "coins_earned": coins_award,
        "is_duplicate": is_duplicate,
        "scanned_at": now_iso.isoformat()
    }
    db.collection('scans').document(scan_id).set(scan_record)
    
    return jsonify({
        "success": True,
        "scan": scan_record,
        "profile": updated_profile,
        "is_duplicate": is_duplicate
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

@api_bp.route('/scan/receipt', methods=['POST'])
@login_required
def scan_receipt():
    """
    Scans a shopping receipt. Accepts file upload ('file') or base64.
    Returns itemized carbon footprints and alternatives.
    """
    user_id = request.form.get('user_id', 'demo_user')
    image_bytes = None
    filename = ""
    
    if 'file' in request.files:
        uploaded_file = request.files['file']
        filename = uploaded_file.filename
        image_bytes = uploaded_file.read()
    else:
        data = request.get_json() or {}
        image_b64 = data.get('image')
        filename = data.get('filename', 'receipt.jpg')
        if image_b64:
            import base64
            try:
                image_bytes = base64.b64decode(image_b64.split(",")[-1])
            except Exception:
                pass
                
    from app.services.openai_service import analyze_receipt
    result = analyze_receipt(image_bytes, filename)
    
    from app.services.gamification import add_rewards
    updated_profile = add_rewards(user_id, score_delta=5, xp_delta=10, coins_delta=10)
    
    return jsonify({
        "success": True,
        "result": result,
        "profile": updated_profile
    })

