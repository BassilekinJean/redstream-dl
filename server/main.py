from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
import yt_dlp
import os
import uuid
import glob
import asyncio
import traceback
import shutil
import time
import subprocess
from datetime import datetime, timedelta
import threading

# ===== CONFIGURATION =====
DOWNLOADS_DIR = "downloads"
FILE_EXPIRY_MINUTES = 30  # Les fichiers sont supprimés après 30 minutes
CLEANUP_INTERVAL_SECONDS = 300  # Vérification toutes les 5 minutes
YT_DLP_UPDATE_INTERVAL_HOURS = 24  # Mise à jour yt-dlp toutes les 24 heures

# Variable pour arrêter les threads
cleanup_running = True

def update_yt_dlp():
    """Met à jour yt-dlp vers la dernière version"""
    global cleanup_running
    
    # Première mise à jour au démarrage
    try:
        print("[yt-dlp] Vérification de la version...")
        result = subprocess.run(
            ["pip", "install", "--upgrade", "yt-dlp"],
            capture_output=True,
            text=True
        )
        if "Successfully installed" in result.stdout:
            print(f"[yt-dlp] Mis à jour avec succès!")
        else:
            print(f"[yt-dlp] Déjà à jour")
    except Exception as e:
        print(f"[yt-dlp] Erreur mise à jour initiale: {e}")
    
    # Boucle de mise à jour périodique
    update_interval_seconds = YT_DLP_UPDATE_INTERVAL_HOURS * 3600
    while cleanup_running:
        time.sleep(update_interval_seconds)
        if not cleanup_running:
            break
        try:
            print(f"[yt-dlp] Mise à jour automatique ({datetime.now().strftime('%Y-%m-%d %H:%M')})...")
            result = subprocess.run(
                ["pip", "install", "--upgrade", "yt-dlp"],
                capture_output=True,
                text=True
            )
            if "Successfully installed" in result.stdout:
                print(f"[yt-dlp] Mis à jour avec succès!")
            else:
                print(f"[yt-dlp] Déjà à jour")
        except Exception as e:
            print(f"[yt-dlp] Erreur mise à jour: {e}")

def cleanup_old_downloads():
    """Supprime les dossiers de téléchargement expirés"""
    global cleanup_running
    while cleanup_running:
        try:
            if os.path.exists(DOWNLOADS_DIR):
                now = time.time()
                expiry_seconds = FILE_EXPIRY_MINUTES * 60
                
                for folder_name in os.listdir(DOWNLOADS_DIR):
                    folder_path = os.path.join(DOWNLOADS_DIR, folder_name)
                    if os.path.isdir(folder_path):
                        # Vérifier l'âge du dossier
                        folder_age = now - os.path.getmtime(folder_path)
                        if folder_age > expiry_seconds:
                            try:
                                shutil.rmtree(folder_path)
                                print(f"[Cleanup] Supprimé: {folder_name} (âge: {folder_age/60:.1f} min)")
                            except Exception as e:
                                print(f"[Cleanup] Erreur suppression {folder_name}: {e}")
        except Exception as e:
            print(f"[Cleanup] Erreur générale: {e}")
        
        # Attendre avant la prochaine vérification
        time.sleep(CLEANUP_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    global cleanup_running
    
    # Créer le dossier downloads s'il n'existe pas
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    
    # Démarrer le thread de nettoyage
    cleanup_thread = threading.Thread(target=cleanup_old_downloads, daemon=True)
    cleanup_thread.start()
    print(f"[Startup] Nettoyage automatique activé (expiration: {FILE_EXPIRY_MINUTES} min)")
    
    # Démarrer le thread de mise à jour yt-dlp
    update_thread = threading.Thread(target=update_yt_dlp, daemon=True)
    update_thread.start()
    print(f"[Startup] Mise à jour automatique yt-dlp activée (intervalle: {YT_DLP_UPDATE_INTERVAL_HOURS}h)")
    
    yield
    
    # Arrêter les threads
    cleanup_running = False
    print("[Shutdown] Arrêt des tâches automatiques")

app = FastAPI(title="RedStream API", lifespan=lifespan)

# Configuration CORS pour autoriser le frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En prod, remplacer par l'URL de ton frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stockage des téléchargements en cours
downloads_status = {}

class VideoRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_id: str
    extract_audio: bool = False
    include_thumbnail: bool = True
    include_subtitles: bool = False

class PlaylistDownloadRequest(BaseModel):
    urls: List[str]  # Liste des URLs des vidéos à télécharger
    format_id: str
    extract_audio: bool = False
    include_thumbnail: bool = True
    include_subtitles: bool = False

def format_error(e: Exception) -> dict:
    """Formate une erreur pour le frontend"""
    error_str = str(e)
    
    # Messages d'erreur plus clairs
    if "Requested format is not available" in error_str:
        return {
            "error": "Format non disponible",
            "detail": "Le format sélectionné n'est pas disponible pour cette vidéo. Essayez avec 'best' ou un autre format.",
            "code": "FORMAT_UNAVAILABLE"
        }
    elif "Video unavailable" in error_str:
        return {
            "error": "Vidéo indisponible",
            "detail": "Cette vidéo n'est pas accessible (privée, supprimée ou bloquée dans votre région).",
            "code": "VIDEO_UNAVAILABLE"
        }
    elif "Sign in" in error_str or "age" in error_str.lower():
        return {
            "error": "Restriction d'âge",
            "detail": "Cette vidéo nécessite une connexion pour vérifier l'âge.",
            "code": "AGE_RESTRICTED"
        }
    elif "No supported JavaScript runtime" in error_str:
        return {
            "error": "Runtime JS manquant",
            "detail": "Installez Node.js ou Deno pour un meilleur support YouTube.",
            "code": "JS_RUNTIME_MISSING"
        }
    else:
        return {
            "error": "Erreur de téléchargement",
            "detail": error_str[:200],  # Limiter la taille
            "code": "UNKNOWN_ERROR"
        }

def get_yt_dlp_options(skip_download=True):
    """
    Retourne les options yt-dlp optimisées pour éviter les blocages YouTube
    """
    return {
        'quiet': False,
        'no_warnings': False,
        'skip_download': skip_download,
        'flat_playlist': False,
        # === Options anti-blocage YouTube ===
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'referer': 'https://www.youtube.com',
        'socket_timeout': 30,
        'http_headers': {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        # === Gestion des erreurs YouTube ===
        'extractor_args': {
            'youtube': {
                'lang': ['en'],
                'skip': ['hls', 'dash']
            }
        },
        # === Retry sur erreur ===
        'socket_timeout': 30,
        'retries': {'max_tries': 5, 'socket_timeout': 30},
        'fragment_retries': 10,
        # === Cache pour éviter les requêtes répétées ===
        'cache_dir': '/tmp/yt-dlp-cache',
        'no_cache_dir': False,
    }

@app.post("/api/info")
async def get_video_info(request: VideoRequest):
    """Récupère les métadonnées sans télécharger"""
    
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="URL vide")
    
    try:
        ydl_opts = get_yt_dlp_options(skip_download=True)
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"[DEBUG] Extraction des infos pour: {request.url}")
            info = ydl.extract_info(request.url, download=False)
            
            if not info:
                raise Exception("Impossible d'extraire les informations de la vidéo")
            
            # Traitement des formats
            formats = []
            if 'formats' in info:
                for fmt in info.get('formats', []):
                    try:
                        formats.append({
                            'format_id': fmt.get('format_id'),
                            'ext': fmt.get('ext', 'unknown'),
                            'resolution': fmt.get('format', 'unknown'),
                            'note': fmt.get('format_note', ''),
                            'filesize': fmt.get('filesize'),
                            'fps': fmt.get('fps'),
                            'vcodec': fmt.get('vcodec', 'none'),
                            'acodec': fmt.get('acodec', 'none'),
                        })
                    except Exception as e:
                        print(f"[WARNING] Erreur lors du traitement du format: {e}")
                        continue
            
            # Traitement des formats génériques (fallback)
            if not formats:
                formats = [
                    {'format_id': 'bestvideo+bestaudio/best', 'ext': 'mp4', 'resolution': '1080p max', 'note': 'Recommandé', 'vcodec': 'h264', 'acodec': 'aac'},
                    {'format_id': '22', 'ext': 'mp4', 'resolution': '720p', 'note': 'Medium Quality', 'vcodec': 'h264', 'acodec': 'aac'},
                    {'format_id': '18', 'ext': 'mp4', 'resolution': '360p', 'note': 'Low Quality', 'vcodec': 'h264', 'acodec': 'aac'},
                ]
            
            # Détection playlist
            is_playlist = 'entries' in info and info['entries'] is not None
            
            result = {
                'id': info.get('id'),
                'title': info.get('title', 'Sans titre'),
                'uploader': info.get('uploader', 'Inconnu'),
                'duration': info.get('duration', 0),
                'view_count': info.get('view_count', 0),
                'thumbnail': info.get('thumbnail'),
                'description': info.get('description', ''),
                'formats': formats,
                'is_playlist': is_playlist,
                'playlist_title': info.get('playlist_title') if is_playlist else None,
                'playlist_count': len(info['entries']) if is_playlist else None,
                'entries': []
            }

            # Traitement des entrées de playlist
            if is_playlist and info.get('entries'):
                for i, entry in enumerate(info['entries'][:50]):  # Limiter à 50 entrées
                    try:
                        result['entries'].append({
                            'id': entry.get('id'),
                            'title': entry.get('title', f'Vidéo {i+1}'),
                            'duration': entry.get('duration', 0),
                            'thumbnail': entry.get('thumbnail'),
                            'url': f"https://www.youtube.com/watch?v={entry.get('id')}"
                        })
                    except Exception as e:
                        print(f"[WARNING] Erreur lors du traitement de l'entrée {i}: {e}")
                        continue
            
            print(f"[SUCCESS] Infos extraites avec succès pour: {result['title']}")
            return result
            
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Erreur lors de l'extraction: {error_msg}")

        # Gestion spécifique des erreurs YouTube
        if "Sign in to confirm you're not a bot" in error_msg:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "YouTube demande une vérification supplémentaire. Essayez avec une autre vidéo ou réessayez dans quelques minutes.",
                    "code": "YOUTUBE_BOT_CHECK"
                }
            )
        elif "Video unavailable" in error_msg:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "Cette vidéo n'est pas disponible (privée, supprimée ou restreinte géographiquement).",
                    "code": "VIDEO_UNAVAILABLE"
                }
            )
        elif "Private video" in error_msg:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Cette vidéo est privée et ne peut pas être téléchargée.",
                    "code": "PRIVATE_VIDEO"
                }
            )
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": error_msg,
                    "code": "EXTRACTION_ERROR"
                }
            )


@app.post("/api/download")
async def download_video(request: DownloadRequest, background_tasks: BackgroundTasks):
    """Lance le téléchargement"""
    
    if not request.url or not request.format_id:
        raise HTTPException(status_code=400, detail="URL ou format_id manquant")
    
    try:
        download_id = str(__import__('uuid').uuid4())
        output_dir = f"{DOWNLOADS_DIR}/{download_id}"
        os.makedirs(output_dir, exist_ok=True)
        
        output_template = f"{output_dir}/%(title)s.%(ext)s"
        
        ydl_opts = get_yt_dlp_options(skip_download=False)
        ydl_opts.update({
            'format': request.format_id,
            'outtmpl': output_template,
            'writethumbnail': request.include_thumbnail,
            'writesubtitles': request.include_subtitles,
        })
        
        if request.extract_audio:
            ydl_opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'format': 'bestaudio/best',
            })
        
        print(f"[DEBUG] Lancement du téléchargement {download_id}")
        background_tasks.add_task(run_download, ydl_opts, request.url, download_id)
        
        return {"status": "downloading", "download_id": download_id}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=format_error(e))

def run_download(opts, url, download_id):
    """Exécute le téléchargement en arrière-plan"""
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            print(f"[SUCCESS] Téléchargement {download_id} terminé: {filename}")
    except Exception as e:
        print(f"[ERROR] Erreur lors du téléchargement {download_id}: {str(e)}")

@app.post("/api/download/playlist")
async def download_playlist(request: PlaylistDownloadRequest):
    """Télécharge plusieurs vidéos d'une playlist"""
    download_id = str(uuid.uuid4())
    download_dir = f"downloads/{download_id}"
    os.makedirs(download_dir, exist_ok=True)
    
    results = []
    errors = []
    
    format_spec = request.format_id if request.format_id else 'bestvideo+bestaudio/best'
    
    for url in request.urls:
        output_template = f"{download_dir}/%(title)s.%(ext)s"
        
        ydl_opts = {
            'format': format_spec,
            'outtmpl': output_template,
            'writethumbnail': request.include_thumbnail,
            'writesubtitles': request.include_subtitles,
            'quiet': True,
            'no_warnings': True,
            'merge_output_format': 'mp4',
            'ignoreerrors': True,
        }

        if request.extract_audio:
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            results.append({"url": url, "status": "success"})
        except Exception as e:
            errors.append({"url": url, "error": str(e)[:100]})
    
    # Lister tous les fichiers téléchargés
    files = glob.glob(f"{download_dir}/*")
    video_files = [os.path.basename(f) for f in files if not f.endswith(('.jpg', '.png', '.webp', '.vtt', '.srt'))]
    
    return {
        "status": "completed",
        "download_id": download_id,
        "files": video_files,
        "success_count": len(results),
        "error_count": len(errors),
        "errors": errors
    }

@app.get("/api/health")
async def health_check():
    """Endpoint de vérification de santé pour Render/Docker"""
    return {
        "status": "healthy",
        "service": "redstream-api",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/download/{download_id}/{filename}")
async def get_file(download_id: str, filename: str):
    """Télécharge le fichier vers le navigateur"""
    file_path = f"downloads/{download_id}/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=format_error(Exception("Fichier non trouvé")))
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )

@app.get("/api/download/{download_id}")
async def list_files(download_id: str):
    """Liste les fichiers disponibles dans un téléchargement"""
    download_dir = f"downloads/{download_id}"
    
    if not os.path.exists(download_dir):
        raise HTTPException(status_code=404, detail=format_error(Exception("Téléchargement non trouvé")))
    
    files = glob.glob(f"{download_dir}/*")
    video_files = [os.path.basename(f) for f in files if not f.endswith(('.jpg', '.png', '.webp', '.vtt', '.srt'))]
    
    return {"files": video_files}

