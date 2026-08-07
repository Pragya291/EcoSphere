from flask import Blueprint

api_bp = Blueprint('api', __name__)

# Import route modules to register endpoints
from . import score, challenges, tips, scan, mentor, passport, timeline
