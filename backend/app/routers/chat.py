from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import (
    ChatAskRequest, ChatAskResponse, SummarizeRequest, SummarizeResponse,
    ChatSessionItem, ChatMessageResponse
)
from app.services.auth_service import get_current_user
from app.services.rag_service import generate_rag_answer

router = APIRouter(prefix="/chat", tags=["Aura AI & RAG"])

@router.post("/ask", response_model=ChatAskResponse)
def ask_question(
    payload: ChatAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = None
    if payload.session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == payload.session_id,
            ChatSession.user_id == current_user.id
        ).first()

    if not session:
        title = payload.question[:40] + ("..." if len(payload.question) > 40 else "")
        session = ChatSession(
            user_id=current_user.id,
            document_id=payload.document_id,
            title=title
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # User message
    user_msg = ChatMessage(
        session_id=session.id,
        sender_type="user",
        content=payload.question
    )
    db.add(user_msg)

    # RAG Generation
    rag_result = generate_rag_answer(
        db=db,
        question=payload.question,
        document_id=payload.document_id or session.document_id,
        user_id=current_user.id
    )

    ai_msg = ChatMessage(
        session_id=session.id,
        sender_type="ai",
        content=rag_result["answer"],
        context_sources=rag_result["sources"]
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    return {
        "session": {
            "id": session.id,
            "title": session.title,
            "document_id": session.document_id
        },
        "user_message": user_msg,
        "ai_message": ai_msg,
        "sources": rag_result["sources"]
    }

@router.get("/sessions", response_model=List[ChatSessionItem])
def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    results = []
    for s in sessions:
        doc = db.query(Document).filter(Document.id == s.document_id).first() if s.document_id else None
        count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        results.append(ChatSessionItem(
            id=s.id,
            title=s.title,
            document_id=s.document_id,
            document_title=doc.title if doc else None,
            message_count=count,
            created_at=s.created_at
        ))
    return results

@router.get("/sessions/{session_id}")
def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Phiên hỏi đáp không tồn tại.")
    
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    doc = db.query(Document).filter(Document.id == session.document_id).first() if session.document_id else None

    return {
        "session": {
            "id": session.id,
            "title": session.title,
            "document_id": session.document_id,
            "document_title": doc.title if doc else None
        },
        "messages": messages
    }
