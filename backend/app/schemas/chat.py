from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class SourceItem(BaseModel):
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    chunk_index: int
    similarity_score: float
    content: str

class ChatAskRequest(BaseModel):
    question: str
    document_id: Optional[str] = None
    session_id: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    sender_type: str
    content: str
    context_sources: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChatAskResponse(BaseModel):
    session: Dict[str, Any]
    user_message: ChatMessageResponse
    ai_message: ChatMessageResponse
    sources: List[Dict[str, Any]]

class SummarizeRequest(BaseModel):
    document_id: str

class SummarizeResponse(BaseModel):
    title: str
    summary: str
    key_concepts: List[str]
    exam_tips: List[str]

class ChatSessionItem(BaseModel):
    id: str
    title: str
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    message_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
