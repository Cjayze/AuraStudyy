import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table supporting Supabase Auth UID and traditional user IDs
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  fullName: text('full_name'),
  school: text('school'),
  role: text('role').default('student'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow()
});

// Documents table for uploaded study materials
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  subject: text('subject').default('General'),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').default(0),
  filePath: text('file_path').notNull(),
  status: text('status').default('ready'),
  rawText: text('raw_text'),
  createdAt: timestamp('created_at').defaultNow()
});

// Document chunks for AI context extraction
export const documentChunks = pgTable('document_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  charCount: integer('char_count').default(0)
});

// Chat sessions
export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  documentId: text('document_id'),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Chat messages
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(),
  content: text('content').notNull(),
  contextSources: text('context_sources'),
  createdAt: timestamp('created_at').defaultNow()
});

// Quizzes
export const quizzes = pgTable('quizzes', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  difficulty: text('difficulty').default('medium'),
  totalQuestions: integer('total_questions').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Quiz questions
export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  quizId: text('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  questionText: text('question_text').notNull(),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  optionC: text('option_c').notNull(),
  optionD: text('option_d').notNull(),
  options: jsonb('options').$type<string[]>(),
  correctAns: text('correct_ans').notNull(),
  explanation: text('explanation')
});

// Quiz attempts
export const quizAttempts = pgTable('quiz_attempts', {
  id: text('id').primaryKey(),
  quizId: text('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  score: integer('score').notNull(),
  correctCount: integer('correct_count').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  timeSpentSec: integer('time_spent_sec').default(0),
  completedAt: timestamp('completed_at').defaultNow()
});

// Quiz answers
export const quizAnswers = pgTable('quiz_answers', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull(),
  selectedOption: text('selected_option').notNull(),
  isCorrect: boolean('is_correct').default(false)
});

// Learning progress
export const learningProgress = pgTable('learning_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  totalDocuments: integer('total_documents').default(0),
  totalQuestionsAsked: integer('total_questions_asked').default(0),
  totalQuizzesCompleted: integer('total_quizzes_completed').default(0),
  averageScore: integer('average_score').default(0),
  lastActiveAt: timestamp('last_active_at').defaultNow()
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  chatSessions: many(chatSessions),
  quizzes: many(quizzes),
  quizAttempts: many(quizAttempts)
}));

export const documentsRelations = relations(documents, ({ many, one }) => ({
  author: one(users, {
    fields: [documents.userId],
    references: [users.id]
  }),
  chunks: many(documentChunks),
  quizzes: many(quizzes)
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id]
  })
}));

export const chatSessionsRelations = relations(chatSessions, ({ many, one }) => ({
  author: one(users, {
    fields: [chatSessions.userId],
    references: [users.id]
  }),
  messages: many(chatMessages)
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id]
  })
}));

export const quizzesRelations = relations(quizzes, ({ many, one }) => ({
  document: one(documents, {
    fields: [quizzes.documentId],
    references: [documents.id]
  }),
  questions: many(questions),
  attempts: many(quizAttempts)
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id]
  })
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ many, one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id]
  }),
  answers: many(quizAnswers)
}));

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id]
  })
}));
