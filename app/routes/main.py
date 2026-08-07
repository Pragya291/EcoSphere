from flask import Blueprint, render_template, current_app

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    firebase_config = {
        'apiKey': current_app.config.get('FIREBASE_API_KEY', ''),
        'authDomain': current_app.config.get('FIREBASE_AUTH_DOMAIN', ''),
        'projectId': current_app.config.get('FIREBASE_PROJECT_ID', ''),
        'storageBucket': current_app.config.get('FIREBASE_STORAGE_BUCKET', ''),
        'messagingSenderId': current_app.config.get('FIREBASE_MESSAGING_SENDER_ID', ''),
        'appId': current_app.config.get('FIREBASE_APP_ID', ''),
        'measurementId': current_app.config.get('FIREBASE_MEASUREMENT_ID', '')
    }
    return render_template('index.html', firebase_config=firebase_config)

