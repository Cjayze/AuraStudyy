from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import auth, documents, chat, quiz

# Create tables in Database if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AuraStudy API",
    description="Hệ thống trợ lý học tập thông minh AuraStudy ứng dụng AI & RAG",
    version="1.0.0"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(quiz.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "message": "Chào mừng bạn đến với AuraStudy API Core Service",
        "docs_url": "/docs",
        "status": "online"
    }

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "AuraStudy FastAPI Backend",
        "version": "1.0.0"
    }
