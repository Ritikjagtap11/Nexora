from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes import documents, chat, auth, llm_status, drive
from app.database import connect_to_firebase
from app.suggested_questions import router as suggested_questions_router  # ← import only

@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_to_firebase()
    from app.services.drive_service import drive_service
    drive_service.init_drive()
    yield

app = FastAPI(
    title="Intelligent Document Retrieval System",
    description="LLM-powered document search and chat system",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(llm_status.router)
app.include_router(drive.router)
app.include_router(suggested_questions_router, prefix="/api/chat", tags=["chat"])  # ← after app

@app.get("/")
async def root():
    return {
        "message": "Intelligent Document Retrieval System API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)