/**
 * Database schema types for Resume AI Chatbot.
 * Mirrors Supabase tables: profiles, work_experience, projects, conversations, sessions.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Auth user from Supabase (id only from our app's perspective)
export interface User {
  id: string;
  email?: string;
}

// Profiles: bio, current role, career summary, skills
export interface Profile {
  id: string;
  user_id: string;
  bio: string | null;
  current_job_role: string | null;
  career_summary: string | null;
  skills: string[]; // stored as text[] or jsonb
  created_at: string;
  updated_at: string;
}

// Work Experience
export interface WorkExperience {
  id: string;
  user_id: string;
  company: string;
  role: string;
  start_date: string | null; // YYYY-MM
  end_date: string | null;
  responsibilities: string[];
  achievements: string[];
  created_at: string;
  updated_at: string;
}

// Projects
export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  impact: string | null;
  technologies: string[];
  created_at: string;
  updated_at: string;
}

// Conversation messages (stored per message)
export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// Sessions: one per "chat session"
export type SessionStatus = "active" | "ended";

export interface Session {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  summary: string | null;
  status: SessionStatus;
  life_story_mode: boolean;
  created_at: string;
  updated_at: string;
}

// --- Data extraction types (from Claude structured output) ---

export interface ExtractedWorkExperience {
  company: string;
  role: string;
  start_date?: string;
  end_date?: string;
  responsibilities?: string[];
  achievements?: string[];
}

export interface ExtractedProject {
  title: string;
  description?: string;
  impact?: string;
  technologies?: string[];
}

export interface ExtractedProfile {
  bio?: string;
  current_job_role?: string;
  career_summary?: string;
  skills?: string[];
}

// Union for extraction payload
export type ExtractedData =
  | { type: "work_experience"; data: ExtractedWorkExperience }
  | { type: "project"; data: ExtractedProject }
  | { type: "profile"; data: ExtractedProfile };
