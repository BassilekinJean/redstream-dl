# 🎬 RedStream DL

> Un téléchargeur YouTube moderne et élégant avec interface React et backend FastAPI.

![RedStream DL](https://img.shields.io/badge/version-1.0.0-red?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?style=for-the-badge&logo=fastapi)
![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)

## ✨ Fonctionnalités

- 🎥 **Téléchargement de vidéos** - Qualité jusqu'à 4K
- 🎵 **Extraction audio** - Conversion MP3 automatique
- 📋 **Support des playlists** - Sélection multiple de vidéos
- 🎨 **Interface moderne** - Design sombre avec effets glassmorphism
- 📱 **Responsive** - Fonctionne sur mobile et desktop
- ⚡ **Rapide** - Backend async avec FastAPI

## 📸 Aperçu

*Capture d'écran à ajouter*

## 🚀 Installation

### Prérequis

- **Node.js** >= 18.x
- **Python** >= 3.9
- **FFmpeg** (pour la fusion vidéo/audio)

### 1. Cloner le projet

```bash
git clone https://github.com/votre-username/redstream-dl.git
cd redstream-dl
```

### 2. Installer le Frontend

```bash
npm install
```

### 3. Installer le Backend

```bash
# Créer un environnement virtuel
python -m venv venv

# Activer l'environnement
# Linux/Mac:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

# Installer les dépendances
pip install -r server/requirements.txt
```

### 4. Installer FFmpeg

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows (avec Chocolatey)
choco install ffmpeg
```

## 🎮 Utilisation

### Option 1: Développement local

#### Démarrer le Backend (Terminal 1)

```bash
source venv/bin/activate  # Activer l'environnement virtuel
cd server
uvicorn main:app --reload
```

Le backend sera accessible sur `http://127.0.0.1:8000`

#### Démarrer le Frontend (Terminal 2)

```bash
npm run dev
```

Le frontend sera accessible sur `http://localhost:5173`

### Option 2: Docker (Recommandé pour la production)

```bash
# Build et lancement
docker-compose up --build

# Ou en arrière-plan
docker-compose up -d --build

# Arrêter
docker-compose down

# Voir les logs
docker-compose logs -f
```

L'application sera accessible sur `http://localhost`

## 🐳 Architecture Docker

```
┌─────────────────────────────────────────────────────────┐
│                    NGINX (Port 80)                      │
│              Reverse Proxy + Static Files               │
├─────────────────────────────────────────────────────────┤
│     /              │           /api/*                   │
│   Static React     │         Proxy to Backend           │
│    (dist/)         │                                    │
└────────┬───────────┴──────────────┬────────────────────┘
         │                          │
         │                          ▼
         │              ┌───────────────────────┐
         │              │  FastAPI (Port 8000)  │
         │              │    + yt-dlp + FFmpeg  │
         │              └───────────────────────┘
         │                          │
         │                          ▼
         │              ┌───────────────────────┐
         │              │  Volume: downloads/   │
         │              │  (Nettoyage auto 30m) │
         │              └───────────────────────┘
```

## 📁 Structure du projet

```
redstream-dl/
├── server/                 # Backend FastAPI
│   ├── main.py            # API principale
│   ├── requirements.txt   # Dépendances Python
│   └── downloads/         # Fichiers temporaires (auto-nettoyés)
├── src/                   # Frontend React
│   ├── App.jsx           # Composant principal
│   ├── App.css           # Styles additionnels
│   └── main.jsx          # Point d'entrée
├── docs/                  # Documentation technique
│   ├── BACKEND_DOCUMENTATION.md
│   └── FRONTEND_DOCUMENTATION.md
├── public/               # Assets statiques
├── package.json          # Dépendances Node.js
├── vite.config.js        # Configuration Vite
├── tailwind.config.js    # Configuration Tailwind
└── README.md
```

## 📚 Documentation

Pour une documentation technique détaillée :

- [📖 Documentation Backend](docs/BACKEND_DOCUMENTATION.md) - API, endpoints, sécurité
- [📖 Documentation Frontend](docs/FRONTEND_DOCUMENTATION.md) - Composants, state, UX

## 🛠️ API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/info` | Récupérer les infos d'une vidéo/playlist |
| `POST` | `/api/download` | Télécharger une vidéo |
| `POST` | `/api/download/playlist` | Télécharger plusieurs vidéos |
| `GET` | `/api/download/{id}/{filename}` | Récupérer le fichier |

## ⚙️ Configuration

### Variables d'environnement (optionnel)

Créez un fichier `.env` à la racine :

```env
VITE_API_URL=http://127.0.0.1:8000
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## ⚠️ Avertissement légal

Ce projet est destiné à un usage personnel et éducatif uniquement. Respectez les droits d'auteur et les conditions d'utilisation de YouTube.

## 📄 Licence

MIT © [BassilekinJean](https://github.com/BassilekinJean)

---

<p align="center">
  <b>RedStream DL</b> - Designed for Performance 🚀
</p>
