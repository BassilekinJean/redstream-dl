# 📚 Documentation Technique - Frontend (App.jsx)

## Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Architecture et dépendances](#architecture-et-dépendances)
3. [Composants UI réutilisables](#composants-ui-réutilisables)
4. [Gestion de l'état (State)](#gestion-de-létat-state)
5. [Fonctions principales](#fonctions-principales)
6. [Traitement des données](#traitement-des-données)
7. [Interface utilisateur](#interface-utilisateur)
8. [Choix techniques](#choix-techniques)
9. [Pistes d'amélioration](#pistes-damélioration)

---

## Vue d'ensemble

Le frontend RedStream est une application **React** moderne avec une interface sombre et élégante, utilisant **Tailwind CSS** pour le styling. L'application permet d'analyser et télécharger des vidéos/playlists YouTube.

### Stack technique
- **React 18** : Bibliothèque UI avec hooks
- **Tailwind CSS** : Framework CSS utility-first
- **Lucide React** : Icônes SVG modernes
- **Vite** : Build tool ultra-rapide

---

## Architecture et dépendances

```jsx
import React, { useState } from 'react';
import {
  Download, Search, Youtube, Music, Film, FileText,
  Image as ImageIcon, Settings, List, Check, AlertCircle,
  Loader2, Play, X, Folder, Globe, Monitor
} from 'lucide-react';
```

### Pourquoi ces choix ?

| Dépendance | Justification |
|------------|---------------|
| `React` | Écosystème riche, composants réutilisables, virtual DOM |
| `useState` | Gestion d'état simple et locale |
| `useMemo` | Optimisation des calculs coûteux |
| `useEffect` | Effets de bord (sync avec données) |
| `Lucide React` | Icônes cohérentes, légères, tree-shakable |
| `Tailwind CSS` | Styling rapide, responsive, sans CSS custom |

---

## Composants UI réutilisables

### Badge

```jsx
const Badge = ({ children, className }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);
```

**Usage** : Étiquettes pour "VIDEO", "PLAYLIST", compteurs.

**Pourquoi un composant ?** 
- Réutilisation avec styles cohérents
- Flexibilité via `className` prop
- Maintenabilité centralisée

### Card

```jsx
const Card = ({ children, className }) => (
  <div className={`bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm rounded-xl overflow-hidden ${className}`}>
    {children}
  </div>
);
```

**Caractéristiques** :
- Fond semi-transparent (`/80`)
- Bordure subtile
- Effet glassmorphism (`backdrop-blur-sm`)
- Coins arrondis (`rounded-xl`)

### Button

```jsx
const Button = ({ children, onClick, variant = 'primary', className, disabled, icon: Icon }) => {
  const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-lg shadow-red-900/30",
    secondary: "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700",
    outline: "border border-red-600/50 text-red-500 hover:bg-red-900/10",
    ghost: "text-neutral-400 hover:text-white hover:bg-neutral-800"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
```

#### Variants expliqués

| Variant | Usage | Style |
|---------|-------|-------|
| `primary` | Actions principales (Télécharger) | Dégradé rouge avec ombre |
| `secondary` | Actions secondaires (Parcourir) | Fond gris avec bordure |
| `outline` | Actions tertiaires (Sélectionner tout) | Bordure rouge, fond transparent |
| `ghost` | Actions discrètes (Annuler) | Texte gris, hover background |

#### Fonctionnalités
- **Icon prop** : Affiche une icône Lucide à gauche
- **Animation** : Scale 95% au clic (`active:scale-95`)
- **Disabled** : Opacité réduite, curseur interdit

### SettingsModal

```jsx
const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl">
        {/* ... contenu */}
      </div>
    </div>
  );
};
```

#### Pattern Modal

1. **Render conditionnel** : `if (!isOpen) return null`
2. **Backdrop** : Overlay sombre cliquable pour fermer
3. **Z-index** : `z-50` pour être au-dessus de tout
4. **Animation** : `animate-fade-in-up` (à définir)

---

## Gestion de l'état (State)

### États principaux

```jsx
const [url, setUrl] = useState('');              // URL saisie
const [loading, setLoading] = useState(false);   // Chargement en cours
const [data, setData] = useState(null);          // Données vidéo/playlist
const [mode, setMode] = useState('video');       // Mode: video | audio
const [selectedFormat, setSelectedFormat] = useState(null);  // Format choisi
const [options, setOptions] = useState({         // Options de téléchargement
  thumbnail: true,
  subtitles: false,
  metadata: true
});
const [downloadStatus, setDownloadStatus] = useState(null);  // idle | downloading | completed
const [error, setError] = useState(null);        // Message d'erreur
const [selectedVideos, setSelectedVideos] = useState(new Set());  // Vidéos sélectionnées (playlist)
const [showSettings, setShowSettings] = useState(false);  // Modal paramètres
```

### Pourquoi ces choix de state ?

| State | Type | Justification |
|-------|------|---------------|
| `url` | `string` | Input contrôlé pour validation |
| `loading` | `boolean` | Feedback visuel pendant l'API call |
| `data` | `object\|null` | Stocke la réponse complète de l'API |
| `mode` | `string` | Enum simple, pas besoin de plus complexe |
| `selectedFormat` | `string\|null` | ID du format, lié aux données |
| `options` | `object` | Groupement logique des toggles |
| `selectedVideos` | `Set` | Performance O(1) pour add/delete/has |
| `error` | `string\|null` | Message d'erreur à afficher |

### Pourquoi Set pour selectedVideos ?

```jsx
const [selectedVideos, setSelectedVideos] = useState(new Set());
```

**Avantages du Set** :
- `has(id)` : O(1) vs O(n) pour Array.includes
- `add(id)` / `delete(id)` : Mutations claires
- Pas de doublons possibles
- Idéal pour les sélections multiples

---

## Fonctions principales

### handleAnalyze

```jsx
const handleAnalyze = async (e) => {
  e.preventDefault();
  if (!url) return;

  setLoading(true);
  setData(null);
  setDownloadStatus(null);
  setSelectedFormat(null);
  setError(null);
  setSelectedVideos(new Set());

  try {
    const response = await fetch('http://127.0.0.1:8000/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errData = await response.json();
      const errorMsg = errData.detail?.error || errData.detail?.detail || errData.detail || 'Erreur';
      throw new Error(errorMsg);
    }

    const result = await response.json();
    setData(result);
    
    if (result.formats && result.formats.length > 0) {
      setSelectedFormat(result.formats[0].format_id);
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

#### Flux détaillé

```
1. Empêche le submit form (e.preventDefault)
2. Validation: URL non vide
3. Reset tous les états (clean slate)
4. Appel API POST /api/info
5. Gestion des erreurs (extraction du message)
6. Stockage des données
7. Pré-sélection du premier format
8. Cleanup: loading = false (finally)
```

#### Gestion des erreurs

```jsx
const errorMsg = errData.detail?.error || errData.detail?.detail || errData.detail || 'Erreur';
```

**Pattern de fallback** : Chaînage optionnel (`?.`) pour extraire le message d'erreur de différentes structures possibles.

### handleDownload

```jsx
const handleDownload = async () => {
  if (!selectedFormat || !data) return;

  setDownloadStatus('downloading');
  setError(null);
  
  try {
    let response;
    
    if (data.is_playlist && selectedVideos.size > 0) {
      // Playlist: POST /api/download/playlist
      const selectedUrls = data.entries
        .filter(e => selectedVideos.has(e.id))
        .map(e => e.url);
      
      response = await fetch('http://127.0.0.1:8000/api/download/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: selectedUrls,
          format_id: selectedFormat,
          extract_audio: mode === 'audio',
          include_thumbnail: options.thumbnail,
          include_subtitles: options.subtitles
        }),
      });
    } else {
      // Vidéo simple: POST /api/download
      response = await fetch('http://127.0.0.1:8000/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          format_id: selectedFormat,
          extract_audio: mode === 'audio',
          include_thumbnail: options.thumbnail,
          include_subtitles: options.subtitles
        }),
      });
    }

    // ... gestion de la réponse et téléchargement navigateur
  } catch (err) {
    setError(err.message);
    setDownloadStatus(null);
  }
};
```

#### Téléchargement vers le navigateur

```jsx
if (result.files && result.files.length > 0) {
  // Playlist: télécharger chaque fichier
  for (const filename of result.files) {
    const downloadUrl = `http://127.0.0.1:8000/api/download/${result.download_id}/${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    await new Promise(r => setTimeout(r, 500)); // Délai entre téléchargements
  }
}
```

**Technique** : Création dynamique de `<a>` avec attribut `download` pour forcer le téléchargement navigateur.

**Délai de 500ms** : Évite les problèmes de téléchargements simultanés sur certains navigateurs.

### toggleVideoSelection

```jsx
const toggleVideoSelection = (videoId) => {
  setSelectedVideos(prev => {
    const newSet = new Set(prev);
    if (newSet.has(videoId)) {
      newSet.delete(videoId);
    } else {
      newSet.add(videoId);
    }
    return newSet;
  });
};
```

**Pattern** : Mise à jour immutable du Set via copie + modification.

### toggleAllVideos

```jsx
const toggleAllVideos = () => {
  if (!data?.entries) return;
  if (selectedVideos.size === data.entries.length) {
    setSelectedVideos(new Set());  // Tout désélectionner
  } else {
    setSelectedVideos(new Set(data.entries.map(e => e.id)));  // Tout sélectionner
  }
};
```

**Logique** : Si tout est sélectionné → vider. Sinon → tout sélectionner.

### toggleOption

```jsx
const toggleOption = (key) => {
  setOptions(prev => ({ ...prev, [key]: !prev[key] }));
};
```

**Pattern** : Spread + computed property name pour toggle un booléen dans un objet.

---

## Traitement des données

### processedFormats (useMemo)

```jsx
const processedFormats = React.useMemo(() => {
  if (!data || !data.formats) return [];

  if (mode === 'audio') {
    return data.formats.filter(f => f.resolution === 'audio only' || f.vcodec === 'none');
  }

  // Video processing
  const videoFormats = data.formats.filter(f => f.vcodec !== 'none' && f.resolution !== 'audio only');
  const uniqueFormats = {};

  videoFormats.forEach(f => {
    let label = f.resolution;
    // Convertir 1920x1080 -> 1080p
    const match = f.resolution.match(/[0-9]+x([0-9]+)/);
    if (match) {
      label = match[1] + 'p';
    }
    
    // Priorité: Recommandé > meilleure taille
    if (!uniqueFormats[label] || f.note === 'Recommandé' || (f.filesize && f.filesize > (uniqueFormats[label].filesize || 0))) {
      uniqueFormats[label] = { ...f, displayResolution: label };
    }
  });

  // Tri: Recommandé en premier, puis par résolution décroissante
  return Object.values(uniqueFormats).sort((a, b) => {
    if (a.note === 'Recommandé') return -1;
    if (b.note === 'Recommandé') return 1;
    const valA = parseInt(a.displayResolution) || 0;
    const valB = parseInt(b.displayResolution) || 0;
    return valB - valA;
  });
}, [data, mode]);
```

#### Pourquoi useMemo ?

- **Performance** : Évite de recalculer à chaque render
- **Dépendances** : Recalcule uniquement si `data` ou `mode` change

#### Transformations

1. **Filtrage par mode** : Audio vs Vidéo
2. **Conversion résolution** : `1920x1080` → `1080p`
3. **Déduplication** : Un seul format par résolution
4. **Priorité** : Format "Recommandé" > plus gros fichier
5. **Tri** : Recommandé d'abord, puis résolution décroissante

### useEffect pour auto-sélection

```jsx
React.useEffect(() => {
  if (data?.is_playlist && data?.entries) {
    const allIds = new Set(data.entries.map(e => e.id));
    setSelectedVideos(allIds);
  }
}, [data]);
```

**But** : Quand une playlist est chargée, sélectionner automatiquement toutes les vidéos.

---

## Interface utilisateur

### Structure de la page

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (Logo + Settings)                               │
├─────────────────────────────────────────────────────────┤
│  HERO (Titre + Barre de recherche)                      │
├─────────────────────────────────────────────────────────┤
│  ERROR ALERT (conditionnel)                             │
├─────────────────────────────────────────────────────────┤
│  RESULTS CARD (conditionnel)                            │
│  ┌─────────────┬───────────────────────────────────────┐│
│  │  Thumbnail  │  Controls (Mode, Formats, Options)   ││
│  │  + Infos    │  + Download Button                   ││
│  └─────────────┴───────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  PLAYLIST CARD (conditionnel - si playlist)             │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Liste des vidéos avec checkboxes                  ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  FOOTER                                                 │
└─────────────────────────────────────────────────────────┘
```

### Responsive Design

```jsx
className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8 max-w-[1920px] mx-auto"
```

| Breakpoint | Padding |
|------------|---------|
| Mobile | `px-4` (16px) |
| `sm` (640px) | `px-6` (24px) |
| `lg` (1024px) | `px-8` (32px) |
| `xl` (1280px) | `px-12` (48px) |
| `2xl` (1536px) | `px-16` (64px) |

**Max-width** : `1920px` pour les écrans ultra-wide.

### Effets visuels

#### Background Ambience
```jsx
<div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
  <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 rounded-full blur-[120px]" />
  <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-red-600/10 rounded-full blur-[100px]" />
</div>
```

**Technique** : Cercles flous positionnés en fixed pour créer une ambiance colorée.

#### Glassmorphism
```jsx
className="bg-neutral-900/80 backdrop-blur-sm"
```

**Effet** : Fond semi-transparent avec flou de l'arrière-plan.

#### Glow Effect (Bouton recherche)
```jsx
<div className="absolute inset-0 bg-red-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
```

**Technique** : Div identique avec `blur` derrière le bouton pour effet de lueur.

### Custom Scrollbar

```jsx
<style jsx>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(20, 20, 20, 0.3);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(60, 60, 60, 0.5);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(220, 38, 38, 0.5);
  }
`}</style>
```

**Pourquoi ?** Les scrollbars par défaut cassent le design sombre.

---

## Choix techniques

### 1. useState vs useReducer

**Choix** : `useState` multiple

**Raison** : 
- États relativement indépendants
- Logique de mise à jour simple
- Pas de transitions d'état complexes

**Alternative** : `useReducer` serait préférable si les états étaient interdépendants.

### 2. Fetch vs Axios

**Choix** : `fetch` natif

**Raison** :
- Pas de dépendance supplémentaire
- API moderne avec async/await
- Suffisant pour des requêtes simples

### 3. Tailwind vs CSS-in-JS

**Choix** : Tailwind CSS

**Raison** :
- Développement rapide
- Pas de fichiers CSS séparés
- Design system intégré
- Optimisation automatique (PurgeCSS)

### 4. Composants inline vs fichiers séparés

**Choix** : Tout dans `App.jsx`

**Raison** :
- Application relativement petite
- Composants UI simples et locaux
- Évite la sur-ingénierie

**Alternative recommandée** : Extraire `Badge`, `Button`, `Card` dans `/components/ui/`.

---

## Pistes d'amélioration

### 🔒 Sécurité

#### 1. Validation des URLs côté client
```jsx
const isValidYoutubeUrl = (url) => {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]+/
  ];
  return patterns.some(p => p.test(url));
};

const handleAnalyze = async (e) => {
  if (!isValidYoutubeUrl(url)) {
    setError("URL YouTube invalide");
    return;
  }
  // ...
};
```

#### 2. Sanitization de l'affichage
```jsx
import DOMPurify from 'dompurify';

const SafeTitle = ({ title }) => (
  <h3 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(title) }} />
);
```

#### 3. Content Security Policy
```html
<!-- Dans index.html -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src http://127.0.0.1:8000;">
```

### 🎨 UX/UI

#### 1. Skeleton Loading
```jsx
const SkeletonCard = () => (
  <div className="animate-pulse">
    <div className="bg-neutral-800 h-48 rounded-lg mb-4"></div>
    <div className="bg-neutral-800 h-4 rounded w-3/4 mb-2"></div>
    <div className="bg-neutral-800 h-4 rounded w-1/2"></div>
  </div>
);

{loading && <SkeletonCard />}
```

#### 2. Progression réelle du téléchargement
```jsx
const [downloadProgress, setDownloadProgress] = useState({
  percent: 0,
  speed: 'N/A',
  eta: 'N/A'
});

// Avec WebSocket
useEffect(() => {
  if (downloadStatus === 'downloading' && downloadId) {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/download/${downloadId}`);
    ws.onmessage = (event) => {
      setDownloadProgress(JSON.parse(event.data));
    };
    return () => ws.close();
  }
}, [downloadStatus, downloadId]);
```

#### 3. Toast Notifications
```jsx
import { Toaster, toast } from 'react-hot-toast';

// Dans le composant
toast.success('Téléchargement terminé !');
toast.error('Erreur: ' + errorMessage);

// Dans le JSX
<Toaster position="bottom-right" />
```

#### 4. Dark/Light Mode
```jsx
const [theme, setTheme] = useState('dark');

useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}, [theme]);
```

### 🚀 Fonctionnalités

#### 1. Historique des téléchargements
```jsx
const [history, setHistory] = useState(() => {
  const saved = localStorage.getItem('downloadHistory');
  return saved ? JSON.parse(saved) : [];
});

useEffect(() => {
  localStorage.setItem('downloadHistory', JSON.stringify(history));
}, [history]);

const addToHistory = (video) => {
  setHistory(prev => [
    { ...video, downloadedAt: new Date().toISOString() },
    ...prev.slice(0, 49)  // Garder 50 max
  ]);
};
```

#### 2. Recherche YouTube intégrée
```jsx
const [searchResults, setSearchResults] = useState([]);

const searchYoutube = async (query) => {
  const response = await fetch(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(query)}`);
  const results = await response.json();
  setSearchResults(results);
};
```

#### 3. Drag & Drop d'URLs
```jsx
const handleDrop = (e) => {
  e.preventDefault();
  const droppedUrl = e.dataTransfer.getData('text/plain');
  if (isValidYoutubeUrl(droppedUrl)) {
    setUrl(droppedUrl);
    handleAnalyze({ preventDefault: () => {} });
  }
};

<div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
  {/* Contenu */}
</div>
```

#### 4. Raccourcis clavier
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter' && url) {
      handleAnalyze({ preventDefault: () => {} });
    }
    if (e.key === 'Escape') {
      setShowSettings(false);
      setError(null);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [url]);
```

#### 5. PWA (Progressive Web App)
```js
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RedStream DL',
        short_name: 'RedStream',
        theme_color: '#dc2626',
        icons: [/* ... */]
      }
    })
  ]
};
```

### 🏗️ Architecture

#### 1. Extraction des composants
```
src/
├── components/
│   ├── ui/
│   │   ├── Badge.jsx
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   └── Modal.jsx
│   ├── VideoCard.jsx
│   ├── FormatSelector.jsx
│   ├── PlaylistList.jsx
│   └── SettingsModal.jsx
├── hooks/
│   ├── useVideoInfo.js
│   ├── useDownload.js
│   └── useLocalStorage.js
├── services/
│   └── api.js
└── App.jsx
```

#### 2. Custom Hooks
```jsx
// hooks/useVideoInfo.js
export const useVideoInfo = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInfo = async (url) => {
    setLoading(true);
    try {
      const response = await api.getVideoInfo(url);
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchInfo };
};

// Usage
const { data, loading, error, fetchInfo } = useVideoInfo();
```

#### 3. Service API centralisé
```jsx
// services/api.js
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const api = {
  getVideoInfo: async (url) => {
    const response = await fetch(`${API_BASE}/api/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  
  downloadVideo: async (params) => {
    // ...
  }
};
```

#### 4. State Management (Zustand)
```jsx
import { create } from 'zustand';

const useStore = create((set) => ({
  url: '',
  data: null,
  loading: false,
  error: null,
  
  setUrl: (url) => set({ url }),
  setData: (data) => set({ data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  reset: () => set({ url: '', data: null, error: null }),
}));
```

### 🧪 Tests

#### 1. Tests unitaires (Vitest)
```jsx
// App.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('affiche le titre', () => {
  render(<App />);
  expect(screen.getByText(/RedStream/i)).toBeInTheDocument();
});

test('valide une URL YouTube', () => {
  render(<App />);
  const input = screen.getByPlaceholderText(/Collez votre lien/i);
  fireEvent.change(input, { target: { value: 'invalid-url' } });
  fireEvent.submit(input.closest('form'));
  expect(screen.getByText(/URL invalide/i)).toBeInTheDocument();
});
```

#### 2. Tests E2E (Playwright)
```js
// e2e/download.spec.js
test('télécharge une vidéo', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[placeholder*="lien YouTube"]', 'https://youtube.com/watch?v=dQw4w9WgXcQ');
  await page.click('button:has-text("Analyser")');
  await page.waitForSelector('[data-testid="video-card"]');
  await page.click('button:has-text("Télécharger")');
  // ...
});
```

---

## Résumé

Ce frontend offre une interface moderne et réactive pour le téléchargement de vidéos YouTube. Les principaux axes d'amélioration sont :

1. **Architecture** : Découper en composants et hooks réutilisables
2. **UX** : Progression réelle, notifications, raccourcis clavier
3. **Performance** : Lazy loading, code splitting, caching
4. **Tests** : Coverage unitaire et E2E
5. **PWA** : Installation, offline support

---

*Documentation générée pour RedStream DL v1.0.0*
