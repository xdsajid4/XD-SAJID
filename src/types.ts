export type VoicePersona = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export type LanguageMode = 'auto' | 'english' | 'bangla' | 'banglish';

export type CompanionPacing = 'thoughtful' | 'natural' | 'brisk';
export type AmbientSoundType = 'none' | 'rain' | 'hearth' | 'breeze';

export type CompanionStateMachineState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'paused'
  | 'quiet';

export type MemoryCategory =
  | 'personal'
  | 'preference'
  | 'interest'
  | 'project'
  | 'task'
  | 'context'
  | 'emotion';

export interface CompanionEmotion {
  mood: string;
  internalThought: string;
  vocalInflection?: string;
  energyLevel?: number; // 0 to 1
  colorTheme?: string;
  timestamp: number;
}

export interface SessionMemoryItem {
  id: string;
  category: MemoryCategory;
  key: string;
  detail: string;
  emotionalTone?: string;
  isConfirmedByUser: boolean;
  isSensitive?: boolean;
  isAssumption?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  interrupted?: boolean;
  emotion?: string;
  backchannel?: string;
  voiceStyle?: string;
  toolCall?: {
    toolName: string;
    details: string;
    status?: 'success' | 'failed' | 'pending';
  };
}

export interface CompanionSettings {
  voice: VoicePersona;
  pacing: CompanionPacing;
  languageMode: LanguageMode;
  speakingSpeed: number; // 0.8 to 1.3
  speakingVolume: number; // 0 to 1
  autoInterrupt: boolean;
  vadSensitivity: number; // 0.015 to 0.08
  empathyDepth: 'gentle' | 'balanced' | 'deep';
  moodAwareness: boolean;
  ambientSound: AmbientSoundType;
  ambientVolume: number;
  proactiveMode: boolean;
  proactiveIntervalSeconds: number; // 30s to 180s
  isQuietMode: boolean; // Do Not Disturb / Silence
}

// Windows PC Automation Types
export type WindowsAutomationTool =
  | 'open_website'
  | 'open_application'
  | 'list_approved_files'
  | 'search_approved_files'
  | 'create_text_file'
  | 'get_task_status'
  | 'cancel_task'
  | 'emergency_stop'
  | 'SearchApprovedFiles'
  | 'OpenApprovedApplication'
  | 'OpenWebsite'
  | 'CreateFile'
  | 'ListApprovedFiles'
  | 'OrganizeApprovedFiles'
  | 'ReadAuthorizedFile'
  | 'GetAutomationStatus'
  | 'CancelAutomation';

export interface WindowsAutomationAction {
  id: string;
  taskId?: string;
  pid?: number;
  toolName: WindowsAutomationTool;
  params: Record<string, any>;
  description: string;
  requiresConfirmation: boolean;
  status: 'pending_confirmation' | 'executing' | 'completed' | 'cancelled' | 'failed';
  result?: any;
  error?: string;
  timestamp: number;
}

export interface WindowsAgentConfig {
  agentUrl: string; // e.g. http://127.0.0.1:41199
  authToken: string;
  isConnected: boolean;
  isBridge?: boolean;
  agentVersion?: string;
  allowedDirectories: string[];
  allowedApps: string[];
  lastChecked?: number;
}

// Desktop Productivity Tools
export interface DesktopNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface DesktopTimer {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  startedAt: number;
}

export interface DesktopTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface PendingConfirmation {
  id: string;
  title: string;
  description: string;
  actionType: 'clear_memory' | 'clear_notes' | 'clear_tasks' | 'automation_action' | 'reset_session' | 'other';
  payload?: any;
}
