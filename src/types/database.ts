export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'error';
export type FileType = 'syllabus' | 'notes' | 'textbook' | 'exam_paper' | 'other';
export type TopicLevel = 'unit' | 'topic' | 'subtopic';
export type TopicImportance = 'high' | 'medium' | 'low';
export type QuizType = 'diagnostic' | 'topic_review' | 'mock_exam';
export type QuizStatus = 'in_progress' | 'completed';
export type QuestionType = 'multiple_choice' | 'short_answer';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type MasteryClassification = 'weak' | 'medium' | 'strong' | 'not_assessed';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  exam_name: string;
  exam_date: string | null;
  daily_study_hours: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  description: string | null;
  exam_date: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  file_name: string;
  file_type: FileType;
  file_size: number | null;
  storage_path: string | null;
  processing_status: ProcessingStatus;
  error_message: string | null;
  total_pages: number;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  user_id: string;
  subject_id: string | null;
  chunk_index: number;
  page_number: number | null;
  section_title: string | null;
  content: string;
  token_count: number | null;
  embedding?: number[];
  created_at: string;
}

export interface Topic {
  id: string;
  user_id: string;
  subject_id: string;
  parent_id: string | null;
  title: string;
  level: TopicLevel;
  order_index: number;
  description: string | null;
  estimated_importance: TopicImportance;
  created_at: string;
  children?: Topic[];
  mastery?: TopicMastery;
}

export interface TopicSource {
  id: string;
  user_id: string;
  topic_id: string;
  document_id: string;
  chunk_id: string | null;
  relevance_note: string | null;
  created_at: string;
}

export interface Quiz {
  id: string;
  user_id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  quiz_type: QuizType;
  status: QuizStatus;
  total_questions: number;
  score_percentage: number | null;
  completed_at: string | null;
  created_at: string;
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  user_id: string;
  topic_id: string | null;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer?: string; // Hidden on client for active quizzes
  explanation: string;
  difficulty: Difficulty;
  citation_document_title: string | null;
  citation_page: number | null;
  citation_passage: string | null;
  order_index: number;
  created_at: string;
  student_answer?: QuizAnswer;
}

export interface RubricFeedback {
  score: number;
  max_score: number;
  is_correct: boolean;
  key_points_identified: string[];
  missed_points: string[];
  reasoning: string;
  suggested_improvement: string;
}

export interface QuizAnswer {
  id: string;
  quiz_id: string;
  question_id: string;
  user_id: string;
  student_answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  rubric_feedback: RubricFeedback | null;
  submitted_at: string;
}

export interface TopicMastery {
  id: string;
  user_id: string;
  topic_id: string;
  subject_id: string;
  score_percentage: number;
  classification: MasteryClassification;
  total_questions_answered: number;
  correct_answers: number;
  classification_reason: string;
  supporting_evidence: {
    quiz_id: string;
    score: number;
    total: number;
    date: string;
  }[];
  suggested_next_action: string | null;
  last_assessed_at: string;
  updated_at: string;
  topic_title?: string;
  subject_name?: string;
}

export interface RevisionPlan {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  daily_study_hours: number;
  total_tasks: number;
  completed_tasks: number;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
  updated_at: string;
  tasks?: RevisionTask[];
}

export interface RevisionTask {
  id: string;
  plan_id: string;
  user_id: string;
  topic_id: string | null;
  priority: TaskPriority;
  scheduled_date: string;
  estimated_duration_minutes: number;
  suggested_activity: string;
  source_material_reference: string | null;
  status: TaskStatus;
  order_index: number;
  completed_at: string | null;
  created_at: string;
  topic_title?: string;
}

export interface Citation {
  document_title: string;
  page_number: number | null;
  section_title: string | null;
  passage: string;
  similarity?: number;
}
