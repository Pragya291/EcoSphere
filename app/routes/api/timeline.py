from flask import jsonify, request
from app.routes.api import api_bp
from app.services.carbon_calculator import get_twin_predictions
from app.utils.auth_helper import login_required

@api_bp.route('/timeline', methods=['GET'])
@login_required
def get_timeline():
    """
    Retrieve carbon forecasting timeline data for the AI Twin.
    Compares carbon tracks and provides projected milestones.
    """
    forecast = get_twin_predictions()
    
    milestones = [
        {
            "day": 10,
            "title": "Thermostat Optimization",
            "description": "Adjusting HVAC by 2°C reduces thermal loads, avoiding approximately 12kg of CO2.",
            "type": "energy"
        },
        {
            "day": 30,
            "title": "Single-Use Plastic Phase-Out",
            "description": "Switching to reusable bottles and bags avoids 15kg of plastic waste and prevents 4kg of CO2 production.",
            "type": "waste"
        },
        {
            "day": 90,
            "title": "Low-Impact Transit Transition",
            "description": "Biking/walking for short trips instead of driving prevents 180kg of CO2 and saves $120 in gasoline.",
            "type": "transit"
        },
        {
            "day": 180,
            "title": "Canopy Steward Status",
            "description": "Through your marketplace coin redemptions, 12 real-world mangrove trees have been planted, sequestering 300kg of CO2.",
            "type": "offset"
        },
        {
            "day": 365,
            "title": "Carbon Neutral Milestones Reached",
            "description": "A total reduction of 2,920kg CO2 (2.9 Metric Tons) is reached, placing you in the top 3% of global carbon citizens.",
            "type": "neutral"
        }
    ]
    
    return jsonify({
        "forecast": forecast,
        "milestones": milestones
    })
