'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// Types pour la reconnaissance vocale
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

interface ApiResponse {
  transcript: string;
  response: string;
  audio: string;
}

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId] = useState(() => {
    // Récupérer la session existante ou en créer une nouvelle
    const savedSession = localStorage.getItem('sessionId');
    if (savedSession) return savedSession;
    const newSession = Math.random().toString(36).substring(7);
    localStorage.setItem('sessionId', newSession);
    return newSession;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef('');
  const isFinalRef = useRef(false);
  const processingStartTimeRef = useRef(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fullTranscriptRef = useRef('');

  // Sauvegarder les messages dans le localStorage
  useEffect(() => {
    localStorage.setItem('messages', JSON.stringify(messages));
  }, [messages]);

  // Charger les messages au démarrage
  useEffect(() => {
    const savedMessages = localStorage.getItem('messages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);

  // Scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        recognitionRef.current = new SpeechRecognition();
        if (recognitionRef.current) {
          recognitionRef.current.lang = 'fr-FR';
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;

          // Créer une fonction pour gérer les résultats que nous pouvons réutiliser
          const handleResults = (event: any) => {
            console.log('Événement de reconnaissance vocale reçu', event.results.length);
            const currentTranscript = Array.from(event.results)
              .map((result: any) => result[0].transcript)
              .join('');

            console.log('Transcription en cours:', currentTranscript);
            setTranscript(currentTranscript);
            // Stocker la transcription complète
            fullTranscriptRef.current = currentTranscript;

            // Si l'utilisateur commence à parler, arrêter l'audio en cours
            if (currentTranscript && currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current.currentTime = 0; // Réinitialiser l'audio
              currentAudioRef.current = null;
              setStatus('listening');
            }

            // Vérifier si c'est le résultat final
            const isFinal = event.results[event.results.length - 1].isFinal;
            isFinalRef.current = isFinal;

            if (isFinal) {
              const finalTranscript = event.results[event.results.length - 1][0].transcript;
              console.log('Transcription finale reçue:', finalTranscript);
              if (finalTranscript !== lastTranscriptRef.current) {
                lastTranscriptRef.current = finalTranscript;
                // Attendre 3 secondes avant de traiter le texte final
                console.log('Attente de 3 secondes avant traitement');
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                }
                silenceTimerRef.current = setTimeout(() => {
                  console.log('Délai écoulé, traitement du texte');
                  if (isFinalRef.current) {
                    // Utiliser la transcription complète au lieu de juste la dernière partie
                    console.log('Envoi de la transcription complète:', fullTranscriptRef.current);
                    processText(fullTranscriptRef.current);
                  }
                }, 3000);
              }
            }
          };

          recognitionRef.current.onresult = handleResults;

          recognitionRef.current.onerror = (event: any) => {
            console.error('Erreur de reconnaissance vocale:', event.error);
            setStatus('idle');
            setIsRecording(false);
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current = null;
            }
          };

          recognitionRef.current.onend = () => {
            console.log('Reconnaissance vocale terminée. Enregistrement actif:', isRecording);
            if (isRecording) {
              console.log('Redémarrage de la reconnaissance vocale');
              setTimeout(() => {
                if (recognitionRef.current && isRecording) {
                  try {
                    recognitionRef.current.start();
                  } catch (error) {
                    console.error('Erreur lors du redémarrage de la reconnaissance vocale:', error);
                    // Tenter une réinitialisation complète
                    reinitializeRecognition();
                  }
                }
              }, 300);
            }
          };
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de la reconnaissance vocale:', error);
        setIsBrowserSupported(false);
      }
    } else {
      console.error('La reconnaissance vocale n\'est pas prise en charge par ce navigateur.');
      setIsBrowserSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    if (!isBrowserSupported) {
      alert('La reconnaissance vocale n\'est pas prise en charge par votre navigateur. Veuillez utiliser Chrome, Edge ou Safari.');
      return;
    }

    if (recognitionRef.current) {
      try {
        // Stopper d'abord si une reconnaissance est déjà en cours
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Pas de reconnaissance à arrêter', e);
        }
        
        // Petit délai pour s'assurer que tout est correctement arrêté
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('Démarrage de la reconnaissance vocale');
        recognitionRef.current.start();
        setIsRecording(true);
        setStatus('listening');
      } catch (error) {
        console.error('Erreur lors du démarrage de la reconnaissance vocale:', error);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setStatus('idle');
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    }
  };

  const processText = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    // Vérifier si le message est déjà présent
    if (messages.some(m => m.type === 'user' && m.content === text)) {
      return;
    }

    // Ajouter le message de l'utilisateur immédiatement
    setMessages(prev => [...prev, {
      type: 'user',
      content: text,
      timestamp: new Date()
    }]);

    // Attendre 2 secondes avant d'envoyer à l'IA
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      setIsProcessing(true);
      setStatus('processing');
      const formData = new FormData();
      formData.append('text', text);
      formData.append('session_id', sessionId);

      const response = await axios.post<ApiResponse>('http://localhost:8000/api/process', formData);
      
      if (response.data) {
        const newMessage: Message = {
          type: 'assistant',
          content: response.data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
        
        // Lecture de la réponse vocale
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
        currentAudioRef.current = audio;
        
        // Gestion des événements audio
        audio.onplay = () => {
          console.log('Lecture audio démarrée');
          setStatus('speaking');
        };
        
        audio.onpause = () => {
          console.log('Audio en pause');
          setStatus('listening');
        };
        
        audio.onended = () => {
          console.log('Audio terminé, redémarrage de la reconnaissance vocale');
          currentAudioRef.current = null;
          setStatus('listening');
          
          // Réinitialisation complète de la reconnaissance vocale
          if (isRecording) {
            console.log('Réinitialisation forcée après audio');
            reinitializeRecognition();
          }
        };
        
        try {
          console.log('Démarrage de la lecture audio');
          await audio.play();
        } catch (audioError) {
          console.error('Erreur de lecture audio:', audioError);
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
      setTranscript(''); // Réinitialiser la transcription
    }
  };

  const playResponse = (audioBase64: string) => {
    setStatus('speaking');
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    
    audioRef.current.oncanplaythrough = () => {
      console.log('Audio prêt à être joué');
    };
    
    audioRef.current.onerror = (e) => {
      console.error('Erreur lors de la lecture audio:', e);
      setStatus('listening');
    };
    
    audioRef.current.onended = () => {
      console.log('Lecture audio terminée');
      setStatus('listening');
    };
    
    console.log('Démarrage de la lecture audio');
    audioRef.current.src = audioUrl;
    audioRef.current.play().catch(error => {
      console.error('Erreur lors du démarrage de la lecture:', error);
      setStatus('listening');
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Nouvelle fonction pour réinitialiser complètement la reconnaissance vocale
  const reinitializeRecognition = () => {
    console.log('Réinitialisation complète de la reconnaissance vocale');
    
    // D'abord, nettoyons tout état
    setTranscript('');
    lastTranscriptRef.current = '';
    isFinalRef.current = false;
    fullTranscriptRef.current = ''; // Réinitialiser aussi la transcription complète
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // Arrêter la reconnaissance actuelle
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('Reconnaissance vocale arrêtée');
      } catch (e) {
        console.log('Erreur lors de l\'arrêt de la reconnaissance vocale:', e);
      }
    }

    // Pause avant de redémarrer
    setTimeout(() => {
      console.log('Création d\'une nouvelle instance de reconnaissance vocale');
      
      // @ts-ignore - WebkitSpeechRecognition n'est pas reconnu par TypeScript
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        try {
          // @ts-ignore - Ignorer les erreurs TypeScript
          recognitionRef.current = new SpeechRecognition();
          
          if (recognitionRef.current) {
            recognitionRef.current.lang = 'fr-FR';
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
              console.log('Nouvel événement de reconnaissance après réinitialisation');
              const currentTranscript = Array.from(event.results)
                .map((result: any) => result[0].transcript)
                .join('');

              console.log('Nouvelle transcription:', currentTranscript);
              setTranscript(currentTranscript);

              // Vérifier si c'est le résultat final
              const isFinal = event.results[event.results.length - 1].isFinal;
              isFinalRef.current = isFinal;

              if (isFinal) {
                const finalTranscript = event.results[event.results.length - 1][0].transcript;
                if (finalTranscript !== lastTranscriptRef.current) {
                  lastTranscriptRef.current = finalTranscript;
                  if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                  }
                  silenceTimerRef.current = setTimeout(() => {
                    if (isFinalRef.current) {
                      // Utiliser la transcription complète
                      processText(currentTranscript);
                    }
                  }, 3000);
                }
              }
            };

            recognitionRef.current.onerror = (event: any) => {
              console.error('Erreur après réinitialisation:', event.error);
              setStatus('idle');
              setIsRecording(false);
            };

            recognitionRef.current.onend = () => {
              console.log('Fin après réinitialisation. Enregistrement actif:', isRecording);
              if (isRecording) {
                setTimeout(() => {
                  try {
                    recognitionRef.current?.start();
                  } catch (error) {
                    console.error('Erreur lors du redémarrage:', error);
                  }
                }, 300);
              }
            };

            console.log('Démarrage après réinitialisation');
            try {
              recognitionRef.current.start();
              console.log('Reconnaissance vocale démarrée avec succès');
            } catch (error) {
              console.error('Erreur au démarrage de la reconnaissance:', error);
            }
            
            setIsRecording(true);
            setStatus('listening');
          }
        } catch (error) {
          console.error('Erreur lors de la réinitialisation:', error);
          setIsBrowserSupported(false);
        }
      }
    }, 500);
  };

  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-8">Alberthon Vocal</h1>
        
        <div className="space-y-6">
          {!isBrowserSupported && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">
              La reconnaissance vocale n'est pas prise en charge par votre navigateur.
              <br />
              Veuillez utiliser Chrome, Edge ou Safari pour une meilleure expérience.
            </div>
          )}

          <div className="text-center text-gray-600">
            {status === 'listening' && 'En écoute...'}
            {status === 'processing' && (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>Analyse en cours... ({processingTime}s)</span>
              </div>
            )}
            {status === 'speaking' && 'Réponse en cours...'}
            <div className="text-xs mt-2">
              {isRecording ? 
                <span className="text-green-500">Reconnaissance vocale active</span> : 
                <span className="text-red-500">Reconnaissance vocale inactive</span>
              }
            </div>
            
            {/* Message d'alerte si aucune transcription n'est visible */}
            {isRecording && status === 'listening' && !transcript && (
              <div className="mt-2 text-orange-500 text-sm">
                Si vous parlez mais aucun texte n'apparaît, cliquez sur "Forcer l'écoute"
              </div>
            )}
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isBrowserSupported}
              className={`px-6 py-3 rounded-full text-white font-semibold ${
                !isBrowserSupported 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-primary hover:bg-blue-600'
              } transition-colors`}
            >
              {isRecording ? 'Arrêter' : 'Démarrer l\'entretien'}
            </button>
            
            <button
              onClick={reinitializeRecognition}
              disabled={!isBrowserSupported}
              className="px-6 py-3 rounded-full text-white font-semibold bg-yellow-500 hover:bg-yellow-600 transition-colors"
            >
              Forcer l'écoute
            </button>
          </div>

          {/* Bouton d'aide */}
          <button 
            onClick={() => alert('Si votre voix n\'est pas transcrite après une réponse de l\'IA, cliquez sur "Forcer l\'écoute" pour redémarrer la reconnaissance vocale.')}
            className="block mx-auto mt-2 text-sm text-blue-500 hover:underline"
          >
            Besoin d'aide?
          </button>

          {/* Zone de messages */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-lg">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col ${
                  message.type === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  <div className="text-sm mb-1">
                    {message.type === 'user' ? 'Vous' : 'Assistant'} • {formatTime(message.timestamp)}
                  </div>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message en cours de transcription */}
          {transcript && !messages.some(m => m.content === transcript) && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="font-semibold mb-2">En cours de transcription :</h2>
              <p className="text-gray-700">{transcript}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 