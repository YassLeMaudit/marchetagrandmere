from dotenv import load_dotenv
import os
from mistralai.client import MistralClient
import logging
import traceback

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Chargement des variables d'environnement
load_dotenv()
logger.info("Variables d'environnement chargées")

# Clé API Mistral en dur dans le code
MISTRAL_API_KEY = "EjBs94UFYC6jxzMrhNSlSkHsjOS6vG5b"
logger.info("Utilisation de la clé API en dur")
logger.info(f"Premiers caractères de la clé API: {MISTRAL_API_KEY[:4]}...")

try:
    # Initialisation du client Mistral
    client = MistralClient(api_key=MISTRAL_API_KEY)
    logger.info("Client Mistral initialisé avec succès")
    
    # Liste des modèles disponibles
    models = client.list_models()
    logger.info("Modèles disponibles :")
    logger.info(f"Type de l'objet models : {type(models)}")
    
    # Inspection du format des modèles
    if models:
        if isinstance(models, list):
            for model in models:
                logger.info(f"- Format de l'élément : {type(model)}")
                logger.info(f"- Contenu : {model}")
                if hasattr(model, 'id'):
                    logger.info(f"- ID : {model.id}")
                elif isinstance(model, (tuple, list)) and len(model) > 0:
                    logger.info(f"- Premier élément : {model[0]}")
        else:
            logger.info(f"Format inattendu : {models}")
    
except Exception as e:
    logger.error(f"Erreur : {str(e)}")
    logger.error(traceback.format_exc()) 