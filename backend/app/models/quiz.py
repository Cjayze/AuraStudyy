import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Enum, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    difficulty = Column(Enum("easy", "medium", "hard", name="quiz_difficulty_enum"), default="medium", nullable=False)
    total_questions = Column(Integer, default=5, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_ans = Column(Enum("A", "B", "C", "D", name="correct_ans_enum"), nullable=False)
    explanation = Column(Text, nullable=False)

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    correct_count = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    time_spent_sec = Column(Integer, default=0, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    quiz = relationship("Quiz", back_populates="attempts")
    answers = relationship("QuizAnswer", back_populates="attempt", cascade="all, delete-orphan")


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    selected_option = Column(String(10), nullable=False)
    is_correct = Column(Boolean, nullable=False)

    attempt = relationship("QuizAttempt", back_populates="answers")
