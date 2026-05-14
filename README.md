# NEXORA

> AI-Powered Intelligent Document Retrieval System — Upload documents, ask questions in natural language, and get accurate answers with source citations.

---

## 🧠 About

**NEXORA** is a full-stack Retrieval-Augmented Generation (RAG) application that allows users to upload PDF and text documents, then query them using natural language. The system uses vector similarity search and Large Language Models to provide accurate, citation-backed answers.

### Who It's For
- Students researching across multiple documents
- Professionals needing quick answers from large document sets
- Teams managing shared document knowledge bases

### Key Features
- 📄 **Document Upload** — PDF and TXT files with configurable page ranges (up to 500 pages, 75MB)
- 💬 **AI-Powered Chat** — Natural language Q&A with streaming responses
- 📍 **Source Citations** — Every answer links back to exact document sources
- 🔍 **Vector Search** — FAISS-based semantic similarity for instant retrieval
- ☁️ **Google Drive Integration** — Browse, upload, scan, and index Drive files
- 📦 **Cloudinary Storage** — Cloud-based document storage and retrieval
- 🔐 **Firebase Auth** — Email/password and Google OAuth sign-in
- 💾 **Chat History** — Persistent conversation storage in Firestore
- 📱 **PWA Support** — Installable as a Progressive Web App
- 🌙 **Dark/Light Mode** — System-aware theme with manual toggle
- 📑 **PDF Export** — Export chat conversations to PDF
- 🔑 **Multi-Key Rotation** — Round-robin Gemini API key rotation (up to 5 keys)

---

## 🏗️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | ^19.2.0 | UI component framework |
| Vite | ^7.2.4 | Build tool & dev server |
| Tailwind CSS | ^4.2.4 | Utility-first styling |
| React Router DOM | ^7.14.2 | Client-side routing |
| Firebase (Client) | ^12.12.1 | Authentication & Firestore |
| Axios | ^1.13.3 | HTTP client |
| Lucide React | ^0.563.0 | Icon library |
| React PDF | ^10.4.1 | PDF rendering |
| React Markdown | ^10.1.0 | Markdown rendering in chat |
| jsPDF | ^4.2.1 | PDF export |
| Vite Plugin PWA | ^1.2.0 | Progressive Web App support |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.115.5 | REST API framework |
| Uvicorn | 0.32.1 | ASGI server |
| Firebase Admin | 7.4.0 | Auth verification & Firestore |
| FAISS CPU | 1.9.0 | Vector similarity search |
| Sentence Transformers | 3.3.1 | Text embedding generation |
| Google Generative AI | 0.8.3 | Gemini LLM integration |
| PyPDF2 | 3.0.1 | PDF text extraction |
| python-docx | 1.2.0 | DOCX file support |
| python-pptx | 1.0.2 | PPTX file support |
| Cloudinary | latest | Cloud document storage |
| Google API Client | 2.194.0 | Google Drive API |
| PyTorch | 2.11.0 | ML model runtime |

### Infrastructure
| Technology | Purpose |
|---|---|
| Firebase Firestore | NoSQL database (users, documents, chat history) |
| Firebase Auth | Authentication (email/password, Google OAuth) |
| Cloudinary | Cloud media/document storage |
| Google Drive API | Drive file management & indexing |
| Google Gemini API | LLM for answer generation |

---

## 📁 Project Structure

```
NEXORA/
├── backend/                          # Python FastAPI backend
│   ├── app/
│   │   ├── main.py                   # FastAPI entry point, CORS, routers
│   │   ├── config.py                 # Pydantic settings (env vars)
│   │   ├── database.py               # Firebase Admin initialization
│   │   ├── models.py                 # Pydantic request/response models
│   │   ├── suggested_questions.py    # AI question suggestions
│   │   ├── auth/deps.py             # Auth dependency (token verify)
│   │   ├── routes/                   # API route handlers
│   │   ├── services/                 # Business logic layer
│   │   └── utils/                    # Utility functions
│   ├── .env.example                  # Env template with placeholders
│   └── requirements.txt              # Python dependencies
│
├── frontend/                         # React + Vite frontend
│   ├── public/assets/                # Static images (logos, team)
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   ├── context/                  # React context providers
│   │   ├── pages/                    # Route page components
│   │   └── services/                 # API client & Firebase config
│   ├── package.json                  # Node.js dependencies
│   └── vite.config.js                # Vite + PWA configuration
│
├── .gitignore
├── README.md
└── SETUP_GUIDE.txt
```

---

## ⚙️ Environment Variables

All environment variables are defined in `backend/.env`. Copy from `backend/.env.example`.

| Variable | Required | Description | Example Value |
|---|---|---|---|
| `GEMINI_API_KEY_1` | ✅ Yes | Primary Gemini API key | `AIzaSy...` |
| `GEMINI_API_KEY_2` to `_5` | ⚠️ Optional | Additional Gemini keys (round-robin) | `AIzaSy...` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ✅ Yes | Path to Firebase SA JSON | `./firebase-service-account.json` |
| `UPLOAD_DIR` | ✅ Yes | Temp upload directory | `uploads` |
| `VECTORSTORE_DIR` | ✅ Yes | FAISS index directory | `vectorstore` |
| `MAX_UPLOAD_SIZE` | ✅ Yes | Max upload size (bytes) | `10485760` |
| `CHUNK_SIZE` | ✅ Yes | Text chunk size | `1000` |
| `CHUNK_OVERLAP` | ✅ Yes | Chunk overlap | `200` |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | ✅ Yes | Google Cloud SA JSON path | `./google-service-account.json` |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ✅ Yes | Root Drive folder ID | `1aBcDeFg...` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ Yes | Service account email | `sa@project.iam.gserviceaccount.com` |
| `GOOGLE_CLIENT_ID` | ⚠️ Optional | OAuth client ID | `123...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | ⚠️ Optional | OAuth client secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | ⚠️ Optional | OAuth redirect URI | `http://localhost:8000/api/drive/callback` |
| `CLOUDINARY_CLOUD_NAME` | ✅ Yes | Cloudinary cloud name | `dxxxxxxxx` |
| `CLOUDINARY_API_KEY` | ✅ Yes | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | ✅ Yes | Cloudinary API secret | `aBcDeFg...` |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> && cd NEXORA

# 2. Backend setup
cd backend
python -m venv venv
venv\Scripts\Activate.ps1        # Windows
pip install -r requirements.txt
cp .env.example .env             # Then edit with real values

# 3. Start backend
uvicorn app.main:app --reload --port 8000

# 4. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 5. Open → http://localhost:5173
```

---

## 🧪 Running Tests

```bash
# Backend health check
curl http://localhost:8000/health

# Swagger API docs → http://localhost:8000/docs

# Frontend lint
cd frontend && npm run lint
```

---

## 📦 Build & Deploy

```bash
# Production build
cd frontend && npm run build    # Output: frontend/dist/
npm run preview                  # Preview locally
```

**Deploy Options:**
- **Vercel** (frontend) + **Railway/Render** (backend) — set env vars in dashboards
- **VPS/Docker** — serve `dist/` with nginx, run backend with uvicorn

---

## 🤝 Contributing

- **Branches:** `feature/<name>`, `fix/<name>`, `refactor/<name>`
- **Commits:** `feat: description`, `fix: description`, `docs: description`
- **PRs:** Fork → branch from `main` → test locally → submit with clear description

---

*Built with ❤️ using React, FastAPI, Firebase, and Google Gemini AI*