# EcoSphere

EcoSphere is a gamified web application aimed at encouraging eco-friendly habits and sustainability. It provides users with features like a carbon footprint calculator, eco-challenges, sustainability tips, and an AI mentor to guide them on their green journey.

## Features

- **Carbon Calculator**: Calculate and track your daily carbon footprint based on various activities (electricity usage, transportation, food choices, waste management, etc.).
- **Waste Image Analysis**: Upload waste images to automatically classify and identify recyclable materials using AI-powered image recognition.
- **Gamification System**: Earn rewards and track your Green Score through progressive ecosystem phases (Seed → Plant → Tree → Forest → River → Wildlife → Nature Reserve → Smart Eco City).
- **AI Mentor**: Get personalized advice and answers to your sustainability questions powered by OpenAI GPT.
- **Eco Passport & Timeline**: Track your progress and view a timeline of your sustainable activities and achievements.
- **Sustainability Tips**: Discover new ways to reduce your environmental impact.
- **Score & Rewards Tracking**: Accumulate points through eco-friendly actions and monitor your environmental impact reduction.

## Tech Stack

- **Backend**: Python, Flask
- **Frontend**: HTML5, CSS3, JavaScript
- **Database / Authentication**: Firebase Realtime Database & Firebase Auth
- **AI Integration**: Grok API, OpenAI API (GPT models), Google Gemini API & Hugging Face Transformers
- **Machine Learning**: PyTorch, Transformers (for waste image classification)
- **Image Processing**: Pillow (PIL)
- **Testing**: Pytest
- **Deployment**: Gunicorn, Vercel

## Setup and Installation

### Prerequisites

- Python 3.x
- Firebase account and project setup
- OpenAI API Key

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ecosphere
   ```

2. **Set up a virtual environment**:
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Create a `.env` file in the root directory and add the following configuration:
   ```env
   SECRET_KEY=your-secret-key
   FIREBASE_PROJECT_ID=your-firebase-project-id
   GROK_API_KEY=your-grok-api-key
   OPENAI_API_KEY=your-openai-api-key
   GEMINI_API_KEY=your-google-gemini-api-key
   FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json
   ```

5. **Firebase Credentials**:
   Download your Firebase service account key and save it as `serviceAccountKey.json` in the project root directory.

## Running the Application

Start the Flask development server by running:
```bash
python run.py
```
The application will be accessible at `http://127.0.0.1:5000/`.

## API Endpoints

The backend provides several API endpoints under the `/api` prefix, including:
- `/api/score`: GET and POST user scores.
- `/api/challenges`: Access and manage eco-challenges.
- `/api/tips`: Fetch daily sustainability tips.
- `/api/scan`: Scan-related functionalities.
- `/api/mentor`: Interact with the AI mentor.
- `/api/passport`: Manage user eco passports.
- `/api/timeline`: View user timelines.

## Testing

Run the test suite using pytest:
```bash
pytest
```
