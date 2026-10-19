from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class QuizGenerateRequest(BaseModel):
    document_id: str
    difficulty: Optional[str] = "medium"
    question_count: Optional[int] = 5
    custom_topic: Optional[str] = None

class QuestionItem(BaseModel):
    id: str
    quiz_id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_ans: Optional[str] = None
    explanation: Optional[str] = None

    class Config:
        from_attributes = True

class QuizItem(BaseModel):
    id: str
    document_id: str
    title: str
    difficulty: str
    total_questions: int
    created_at: datetime
    document_title: Optional[str] = None
    subject: Optional[str] = None
    attempts_count: Optional[int] = 0
    best_score: Optional[float] = None
    last_attempt_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class QuizDetailResponse(BaseModel):
    quiz: QuizItem
    questions: List[QuestionItem]
    previous_attempts_count: int = 0

class AnswerSubmission(BaseModel):
    question_id: str
    selected_option: str

class QuizSubmitRequest(BaseModel):
    answers: List[AnswerSubmission]
    time_spent_sec: Optional[int] = 0

class EvaluatedQuestionResult(BaseModel):
    question_id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    selected_option: str
    correct_ans: str
    is_correct: boolean = False if 'boolean' in locals() else bool
    explanation: str

class WeaknessAnalysis(BaseModel):
    weakness_summary: str
    recommended_review_topics: List[str]
    encouragement: str

class QuizAttemptItem(BaseModel):
    id: str
    quiz_id: str
    score: float
    correct_count: int
    total_questions: int
    time_spent_sec: int
    completed_at: datetime
    rank: Optional[str] = None

    class Config:
        from_attributes = True

class QuizSubmitResponse(BaseModel):
    attempt: QuizAttemptItem
    weakness_analysis: WeaknessAnalysis
    results: List[EvaluatedQuestionResult]
