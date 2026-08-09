from flask import request, jsonify
from app.routes.api import api_bp
from app.services.ai_service import analyze_waste_image
from app.services.gamification import add_rewards, get_user_profile
from app.services.firebase import db, SERVER_TIMESTAMP
from app.utils.auth_helper import login_required
import datetime
import uuid

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MIME_FROM_EXT = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                 "png": "image/png", "webp": "image/webp", "gif": "image/gif"}


def _safe_mime(raw_mime, filename=""):
    """Return a normalised, allowed MIME type or None if invalid."""
    if raw_mime:
        raw_mime = raw_mime.split(";")[0].strip().lower()
        # Normalise image/jpg -> image/jpeg
        if raw_mime == "image/jpg":
            raw_mime = "image/jpeg"
        if raw_mime in ALLOWED_MIME_TYPES:
            return raw_mime
    # Fall back to extension
    if filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in MIME_FROM_EXT:
            return MIME_FROM_EXT[ext]
    return None


@api_bp.route('/scan', methods=['POST'])
@login_required
def scan_waste():
    """
    Scans a waste item. Accepts:
      - multipart FormData with field 'image' or 'file'
      - JSON body with base64-encoded 'image' field (camera captures)
    Awards XP, Eco Coins, and updates Green Score.
    """
    user_id = request.form.get('user_id', 'demo_user')
    client_scan_id = request.form.get('scan_id')
    image_bytes = None
    filename = ""
    mime_type = None

    print("[Scanner] Upload received")

    # ── Multipart file upload (FormData) ────────────────────────
    # Accept both 'image' (new) and 'file' (legacy) field names
    upload_file = request.files.get('image') or request.files.get('file')
    if upload_file and upload_file.filename != '':
        filename = upload_file.filename
        raw_mime = upload_file.content_type or upload_file.mimetype or ""
        mime_type = _safe_mime(raw_mime, filename)
        image_bytes = upload_file.read()

    # ── Base64 JSON payload (camera captures) ──────────────────
    elif request.is_json:
        data = request.get_json() or {}
        user_id = data.get('user_id', user_id)
        client_scan_id = data.get('scan_id', client_scan_id)
        base64_image = data.get('image')
        filename = data.get('filename', 'camera_capture.jpg')
        if base64_image:
            import base64 as b64mod
            raw_data = base64_image
            if ',' in base64_image:
                header, raw_data = base64_image.split(',', 1)
                if 'data:' in header and ';base64' in header:
                    raw_mime = header.split(';')[0].replace('data:', '').strip()
                    mime_type = _safe_mime(raw_mime, filename)
            try:
                image_bytes = b64mod.b64decode(raw_data)
            except Exception as decode_err:
                print(f"[Scanner] Base64 decode error: {decode_err}")

    print(f"[Scanner] MIME type: {mime_type}")
    print(f"[Scanner] File size: {len(image_bytes) if image_bytes else 0} bytes")

    # ── Validate: must have image bytes ────────────────────────
    if not image_bytes or len(image_bytes) == 0:
        return jsonify({
            "success": False,
            "error": "Please upload a valid image.",
            "error_type": "invalid_upload",
            "scan_id": client_scan_id or str(uuid.uuid4())
        }), 400

    # ── Validate: must be a recognised image MIME ───────────────
    if mime_type is None:
        return jsonify({
            "success": False,
            "error": "Please upload a valid image (JPEG, PNG, or WebP).",
            "error_type": "invalid_upload",
            "scan_id": client_scan_id or str(uuid.uuid4())
        }), 400

    # ── Validate size limit (max 10MB) ─────────────────────────
    MAX_FILE_SIZE = 10 * 1024 * 1024
    if len(image_bytes) > MAX_FILE_SIZE:
        return jsonify({
            "success": False,
            "error": "Image file too large (max 10MB). Please select a smaller photo.",
            "error_type": "invalid_upload",
            "scan_id": client_scan_id or str(uuid.uuid4())
        }), 400

    scan_id = client_scan_id or f"scan_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.datetime.utcnow()

    print(f"[Scanner] Local AI scanner configured: True")
    print(f"[Scanner] Scan ID: {scan_id} | Filename: {filename} | Time: {now_iso.isoformat()}")

    result = analyze_waste_image(image_bytes, filename, mime_type) or {}
    # ── Differentiate error types from analyze_waste_image ─────
    error_type = result.get("error_type")
    if error_type == "model_unavailable":
        return jsonify({
            "success": False,
            "error": "The local scanner model is unavailable. Please try again.",
            "error_type": "model_unavailable",
            "scan_id": scan_id
        }), 503
    elif error_type == "low_confidence":
        return jsonify({
            "success": False,
            "error": "Couldn't confidently identify this item. Try taking a clearer photo.",
            "error_type": "low_confidence",
            "scan_id": scan_id
        }), 422
    elif error_type == "invalid_upload":
        return jsonify({
            "success": False,
            "error": result.get("reason", "Please upload a valid image."),
            "error_type": "invalid_upload",
            "scan_id": scan_id
        }), 400
    elif error_type == "api_error":
        err_msg = result.get("reason") or "The local scanner model failed to analyze the image."
        return jsonify({
            "success": False,
            "error": err_msg,
            "error_type": "api_error",
            "scan_id": scan_id
        }), 500

    scans_ref = db.collection('scans')
    is_duplicate = False
    
    try:
        user_recent_scans = [doc.to_dict() for doc in scans_ref.stream() if doc.to_dict().get('user_id') == user_id]
        if user_recent_scans:
            user_recent_scans.sort(key=lambda s: s.get('scanned_at', ''), reverse=True)
            latest = user_recent_scans[0]
            if latest.get('item') == result.get('item') or latest.get('material') == result.get('material'):
                scan_time = datetime.datetime.fromisoformat(latest.get('scanned_at', '2026-01-01T00:00:00'))
                time_diff = (now_iso - scan_time).total_seconds()
                if time_diff < 30:
                    is_duplicate = True
    except Exception as e:
        print(f"Error checking duplicate scan: {e}")

    # Calculate gamification awards
    if is_duplicate or not result.get("is_waste", True) or result.get("is_uncertain", False):
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
    
    # Build complete scan record
    scan_record = {
        "scan_id": scan_id,
        "user_id": user_id,
        "filename": filename if filename else "camera_capture.jpg",
        "is_waste": result.get("is_waste", True),
        "category": result.get("category", "Other / Unknown"),
        "item": result.get("item", result.get("material", "Waste Item")),
        "material": result.get("item", result.get("material", "Waste Item")),
        "confidence": result.get("confidence", 0.45),
        "disposal_method": result.get("disposal_method", "Recyclable"),
        "bin": result.get("bin", "Dry Waste / Recycling"),
        "reason": result.get("reason", result.get("explanation", "Scanned & analyzed by EcoSphere Vision AI.")),
        "environmental_tip": result.get("environmental_tip", result.get("eco_alternative", "Dispose or recycle according to local rules.")),
        "multiple_objects": result.get("multiple_objects", []),
        "recyclable": result.get("recyclable", True),
        "disposal_recommendation": result.get("disposal_recommendation", "Rinse and place in recycling bin."),
        "environmental_impact": result.get("environmental_impact", "Moderate"),
        "eco_alternative": result.get("eco_alternative", "Choose reusable alternatives."),
        "explanation": result.get("explanation", "Analyzed via Vision AI."),
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
        "scan_id": scan_id,
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
                
    from app.services.ai_service import analyze_receipt
    result = analyze_receipt(image_bytes, filename)
    
    from app.services.gamification import add_rewards
    updated_profile = add_rewards(user_id, score_delta=5, xp_delta=10, coins_delta=10)
    
    return jsonify({
        "success": True,
        "result": result,
        "profile": updated_profile
    })

