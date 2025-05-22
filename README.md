# Alberthon Vocal

Une application web d'entretien vocal utilisant l'IA pour transcrire, analyser et répondre aux questions de l'utilisateur.

## Fonctionnalités

- Enregistrement vocal via le navigateur
- Transcription automatique avec Whisper
- Génération de réponses avec GPT-3.5
- Synthèse vocale des réponses

## Prérequis

- Node.js 18+ et npm
- Python 3.8+
- Une clé API OpenAI

## Installation

### Frontend (Next.js)

1. Installer les dépendances :
```bash
npm install
```

2. Lancer le serveur de développement :
```bash
npm run dev
```

### Backend (FastAPI)

1. Créer un environnement virtuel Python :
```bash
python -m venv venv
source venv/bin/activate  # Sur Windows : venv\Scripts\activate
```

2. Installer les dépendances :
```bash
pip install -r requirements.txt
```

3. Créer un fichier `.env` à la racine du projet avec votre clé API OpenAI :
```
OPENAI_API_KEY=votre_clé_api_ici
```

4. Lancer le serveur backend :
```bash
cd backend
uvicorn main:app --reload
```

## Utilisation

1. Ouvrez votre navigateur à l'adresse `http://localhost:3000`
2. Cliquez sur le bouton "Démarrer l'entretien"
3. Parlez dans votre microphone
4. Cliquez sur "Arrêter" pour terminer l'enregistrement
5. Attendez la réponse de l'IA

## Architecture

- Frontend : Next.js avec TypeScript et Tailwind CSS
- Backend : FastAPI (Python)
- Transcription : Whisper
- Génération de réponses : GPT-3.5
- Synthèse vocale : Web Speech API 