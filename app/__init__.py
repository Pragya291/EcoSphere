from flask import Flask
from app.services.firebase import db  # initialises Firebase

def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    
    # Register blueprints
    from app.routes.main import main_bp
    app.register_blueprint(main_bp)
    
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    
    return app
