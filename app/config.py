import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    FIREBASE_CREDENTIALS_PATH = os.getenv('FIREBASE_CREDENTIALS_PATH', 'serviceAccountKey.json')
    FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID')
    FIREBASE_API_KEY = os.getenv('FIREBASE_API_KEY', 'mock-web-api-key')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
