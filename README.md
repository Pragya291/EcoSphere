# EcoSphere

EcoSphere is a gamified web application aimed at encouraging eco-friendly habits and sustainability. It provides users with features like a carbon footprint calculator, eco-challenges, sustainability tips, and an AI mentor to guide them on their green journey.

## Features

- **Carbon Calculator**: Calculate and track your daily carbon footprint.
- **Gamification**: Earn points and improve your score by completing eco-friendly tasks and challenges.
- **AI Mentor**: Get personalized advice and answers to your sustainability questions powered by OpenAI.
- **Eco Passport & Timeline**: Track your progress and view a timeline of your sustainable activities.
- **Sustainability Tips**: Discover new ways to reduce your environmental impact.

## Tech Stack

- **Backend**: Python, Flask
- **Database / Authentication**: Firebase
- **AI Integration**: OpenAI API
- **Testing**: Pytest

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
   OPENAI_API_KEY=your-openai-api-key
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
