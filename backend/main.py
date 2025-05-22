from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import torch
import os
from dotenv import load_dotenv
import tempfile
import base64
from gtts import gTTS
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
import logging
import traceback
import json
from typing import Dict, List
import re

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Chargement des variables d'environnement
load_dotenv()
logger.info("Variables d'environnement chargées")

app = FastAPI()

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clé API Mistral en dur dans le code
MISTRAL_API_KEY = "EjBs94UFYC6jxzMrhNSlSkHsjOS6vG5b"
logger.info("Utilisation de la clé API en dur")
logger.info(f"Premiers caractères de la clé API: {MISTRAL_API_KEY[:4]}...")

# Initialisation du client Mistral
try:
    mistral_client = MistralClient(api_key=MISTRAL_API_KEY)
    logger.info("Client Mistral initialisé avec succès")
except Exception as e:
    logger.error(f"Erreur lors de l'initialisation du client Mistral: {str(e)}")
    raise

# Stockage de l'état de la conversation pour chaque session
conversation_states: Dict[str, dict] = {}

@app.post("/api/process")
async def process_text(text: str = Form(...), session_id: str = Form("default")):
    try:
        logger.info(f"Texte reçu pour la session {session_id}: {text}")
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Le texte ne peut pas être vide")
        
        # Initialisation ou récupération de l'état de la conversation
        if session_id not in conversation_states:
            conversation_states[session_id] = {
                "is_first_message": True,
                "question_count": 0,
                "max_questions": 3,
                "messages": []
            }
        
        state = conversation_states[session_id]
        
        # Génération de réponse avec Mistral
        try:
            logger.info("Préparation des messages pour l'API Mistral")
            
            # Prompt système adapté au contexte
            system_prompt = """
Tu es un recruteur qui mène un entretien d'embauche.
À CHAQUE FOIS que tu reçois une réponse du candidat, tu dois UNIQUEMENT poser UNE SEULE question claire et concise, adaptée à la réponse précédente.
N'ajoute rien d'autre, ne fais pas de résumé, ne donne pas d'avis, ne fais pas de debrief, ne pose pas plusieurs questions à la fois, ne mets pas de texte entre crochets, ne simule pas la réponse du candidat, ne remercie pas, ne conclus pas.
Attends la prochaine réponse avant de continuer.
Si tu poses plus d'une question, arrête-toi à la première.
Quand tu as posé 3 questions (et reçu 3 réponses), alors seulement tu fais un court debrief et tu termines l'entretien.
"""
            
            # Construction de l'historique des messages
            messages = [ChatMessage(role="system", content=system_prompt)]
            messages.extend(state["messages"])
            messages.append(ChatMessage(role="user", content=text))
            
            logger.info("Appel de l'API Mistral avec le modèle mistral-medium")
            chat_response = mistral_client.chat(
                model="mistral-medium",
                messages=messages
            )
            
            logger.info("Réponse reçue de l'API Mistral")
            ai_response = chat_response.choices[0].message.content
            logger.info(f"Réponse IA brute : {ai_response}")

            # Post-traitement : ne garder que la première question si plusieurs sont générées
            questions = re.findall(r'[^.?!]*[?]', ai_response)
            if questions:
                ai_response = questions[0].strip()
                logger.info(f"Réponse IA filtrée (1ère question) : {ai_response}")
            else:
                # Si pas de question détectée, renvoyer un message explicite
                ai_response = "Je n'ai pas compris votre réponse, pouvez-vous préciser ?"
                logger.info("Aucune question détectée, réponse par défaut envoyée.")

            # Mise à jour de l'état de la conversation
            state["messages"].append(ChatMessage(role="user", content=text))
            state["messages"].append(ChatMessage(role="assistant", content=ai_response))
            state["is_first_message"] = False
            state["question_count"] += 1
            
        except Exception as e:
            logger.error(f"Erreur lors de la génération de la réponse IA: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Erreur lors de la génération de la réponse IA: {str(e)}")

        # Génération de la réponse vocale avec gTTS
        try:
            output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
            logger.info(f"Génération audio dans : {output_path}")
            
            tts = gTTS(text=ai_response, lang='fr')
            tts.save(output_path)
            
            # Vérification que le fichier existe et a une taille
            if not os.path.exists(output_path):
                raise Exception("Le fichier audio n'a pas été créé")
            
            file_size = os.path.getsize(output_path)
            logger.info(f"Taille du fichier audio : {file_size} bytes")

            # Lecture du fichier audio généré
            with open(output_path, "rb") as audio_file:
                audio_base64 = base64.b64encode(audio_file.read()).decode()
                logger.info(f"Audio encodé en base64 (longueur : {len(audio_base64)})")

            return {
                "transcript": text,
                "response": ai_response,
                "audio": audio_base64,
                "question_count": state["question_count"]
            }
        except Exception as e:
            logger.error(f"Erreur lors de la génération audio: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail="Erreur lors de la génération audio")

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Erreur inattendue: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Nettoyage des fichiers temporaires
        if 'output_path' in locals():
            try:
                os.unlink(output_path)
                logger.info("Fichier temporaire supprimé")
            except Exception as e:
                logger.error(f"Erreur lors de la suppression du fichier temporaire : {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 