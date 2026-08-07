# Carbon emissions factors (in kg of CO2 equivalent)
EMISSION_FACTORS = {
    "electricity_kwh": 0.38,      # kg CO2 per kWh
    "gasoline_liter": 2.31,       # kg CO2 per liter
    "driving_km": 0.12,           # kg CO2 per km (average car)
    "flight_km": 0.15,            # kg CO2 per km (short-haul flight)
    "meat_meal": 2.10,            # kg CO2 per meal with meat
    "vegetarian_meal": 0.60,      # kg CO2 per vegetarian meal
    "organic_waste_landfill": 0.5, # kg CO2 equivalent per kg in landfill
    "organic_waste_compost": 0.05,# kg CO2 equivalent per kg composted
    "paper_landfill": 0.8,
    "paper_recycle": 0.08
}

def calculate_savings(activity_type, value):
    """
    Calculates carbon, energy, and water savings based on green actions.
    Returns a dict with savings of co2 (kg), energy (kWh), and water (Liters).
    """
    savings = {
        "co2": 0.0,
        "energy": 0.0,
        "water": 0.0
    }
    
    if activity_type == "recycle_plastic":
        savings["co2"] = value * 1.5      # 1.5 kg CO2 saved per kg plastic recycled
        savings["energy"] = value * 5.7    # 5.7 kWh saved per kg plastic
        savings["water"] = value * 20.0    # 20 liters saved per kg plastic
    elif activity_type == "recycle_metal":
        savings["co2"] = value * 9.0      # 9.0 kg CO2 saved per kg aluminum
        savings["energy"] = value * 14.0   # 14.0 kWh saved per kg
        savings["water"] = value * 45.0
    elif activity_type == "compost_organic":
        savings["co2"] = value * 0.45     # 0.45 kg CO2 saved by composting vs landfill
        savings["energy"] = 0.0
        savings["water"] = value * 5.0     # soil moisture retention value
    elif activity_type == "recycle_paper":
        savings["co2"] = value * 1.2
        savings["energy"] = value * 4.2
        savings["water"] = value * 26.0
    elif activity_type == "save_electricity":
        # value in kWh saved
        savings["co2"] = value * EMISSION_FACTORS["electricity_kwh"]
        savings["energy"] = value
        savings["water"] = value * 1.5     # water saved from cooling power plants
    elif activity_type == "short_shower":
        # value in minutes saved
        savings["co2"] = value * 0.18      # water heating energy footprint
        savings["energy"] = value * 0.4    # water heating energy saved in kWh
        savings["water"] = value * 8.0     # 8 liters per minute saved
    elif activity_type == "bike_or_walk":
        # value in km traveled by foot/bike instead of driving
        savings["co2"] = value * EMISSION_FACTORS["driving_km"]
        savings["energy"] = value * 0.8    # fuel energy equivalent
        savings["water"] = 0.0
        
    # Round metrics for presentation
    for k in savings:
        savings[k] = round(savings[k], 3)
        
    return savings

def get_twin_predictions():
    """
    Generates forecasting data for the AI Sustainability Twin.
    Compares 3 tracks:
    1. 'Current Track' (user maintains present eco behavior)
    2. 'Future Green You' (user fully optimizes recycling, diets, and transit)
    3. 'Future High Carbon You' (user increases carbon footprint due to higher wastage)
    
    Returns lists of projected cumulative emissions (kg CO2) over 30 days, 90 days, and 365 days.
    """
    return {
        "periods": ["Today", "30 Days", "90 Days", "1 Year"],
        "current_track": [0, 240, 720, 2920],        # ~8kg CO2 per day baseline
        "future_green": [0, 110, 310, 1095],         # ~3kg CO2 per day optimized
        "future_high_carbon": [0, 480, 1440, 5840]    # ~16kg CO2 per day wasteful
    }
