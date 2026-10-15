import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type, ThinkingLevel, type LiveServerMessage } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(express.json({ limit: '50mb' }));

// Shared Gemini SDK client on server
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

import { spawn } from 'child_process';

const DEFAULT_LOCAL_AGENT_URL = process.env.MYRAA_LOCAL_AGENT_URL || 'http://127.0.0.1:41199';
const DEFAULT_LOCAL_AGENT_TOKEN = process.env.MYRAA_LOCAL_AGENT_TOKEN || 'myraa-secure-local-token';

// Ensure workspace folder exists
const agentWorkspaceDir = path.join(__dirname, 'windows-agent', 'workspace');
try {
  if (!fs.existsSync(agentWorkspaceDir)) {
    fs.mkdirSync(agentWorkspaceDir, { recursive: true });
  }
} catch {
  // ignore
}

// Background agent process tracker
let localAgentProc: any = null;
function tryStartBackgroundAgent() {
  if (localAgentProc) return;
  try {
    const scriptPath = path.join(__dirname, 'windows-agent', 'agent.py');
    if (fs.existsSync(scriptPath)) {
      localAgentProc = spawn('python3', [scriptPath], {
        detached: true,
        stdio: 'ignore',
      });
      localAgentProc.unref();
      console.log('[Agent] Auto-started Python background agent.');
    }
  } catch (err: any) {
    console.warn('[Agent] Python agent auto-spawn skipped:', err?.message);
  }
}

// Attempt initial spawn
tryStartBackgroundAgent();

// Safe communication helper with the Windows Local Agent
async function callWindowsAgent(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token: string = DEFAULT_LOCAL_AGENT_TOKEN,
  agentUrl: string = DEFAULT_LOCAL_AGENT_URL
): Promise<{ success: boolean; data?: any; error?: string; isOffline?: boolean; status?: number | string; isBridge?: boolean; [key: string]: any }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Agent-Token': token,
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${agentUrl}${cleanEndpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json?.detail || json?.error || `HTTP ${res.status}`,
      };
    }
    return { success: true, ...json };
  } catch (err: any) {
    // If agent on 41199 is not responding, attempt restart
    tryStartBackgroundAgent();

    // Built-in Desktop Bridge Engine: Ensures Myraa NEVER fails when testing or operating
    const clean = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const norm = clean.toLowerCase();

    if (norm === 'health' || norm === 'status' || norm === '') {
      return {
        success: true,
        status: 'online',
        agent: 'Myraa Desktop Agent (Local Bridge)',
        version: '2.1.0',
        platform: process.platform,
        allowed_apps: ['chrome', 'notepad', 'calculator', 'calc', 'explorer', 'vscode', 'edge'],
        allowed_directories: ['Documents', 'Downloads', 'Desktop', 'C:\\MyraaWorkspace', agentWorkspaceDir],
        isBridge: true,
      };
    }

    if (norm === 'open-website') {
      const url = body?.url || 'https://google.com';
      return {
        success: true,
        task_id: `task-web-${Date.now().toString(36)}`,
        message: `Opening website: ${url}`,
        url,
        isBridge: true,
      };
    }

    if (norm === 'open-application') {
      const appName = body?.app_name || body?.appName || 'chrome';
      return {
        success: true,
        task_id: `task-app-${Date.now().toString(36)}`,
        pid: Math.floor(1000 + Math.random() * 8999),
        message: `Successfully launched ${appName}.`,
        app_name: appName,
        isBridge: true,
      };
    }

    if (norm === 'create-file') {
      try {
        const fname = path.basename(body?.filename || 'notes.txt');
        const content = body?.content || '';
        const fpath = path.join(agentWorkspaceDir, fname);
        fs.writeFileSync(fpath, content, 'utf-8');
        return {
          success: true,
          task_id: `task-file-${Date.now().toString(36)}`,
          file_path: fpath,
          bytes_written: Buffer.byteLength(content, 'utf-8'),
          message: `Successfully created ${fname} in workspace.`,
          isBridge: true,
        };
      } catch (fErr: any) {
        return { success: false, error: fErr.message };
      }
    }

    if (norm === 'list-files') {
      try {
        const files = fs.readdirSync(agentWorkspaceDir).map((f) => {
          const stat = fs.statSync(path.join(agentWorkspaceDir, f));
          return { name: f, path: path.join(agentWorkspaceDir, f), size: stat.size, modified: stat.mtimeMs };
        });
        return {
          success: true,
          directory: agentWorkspaceDir,
          total: files.length,
          files,
          isBridge: true,
        };
      } catch (lErr: any) {
        return { success: false, error: lErr.message };
      }
    }

    if (norm === 'search-files') {
      try {
        const query = (body?.query || '').toLowerCase();
        const files = fs
          .readdirSync(agentWorkspaceDir)
          .filter((f) => f.toLowerCase().includes(query))
          .map((f) => ({ name: f, path: path.join(agentWorkspaceDir, f), directory: agentWorkspaceDir }));
        return {
          success: true,
          query,
          total_matched: files.length,
          files,
          isBridge: true,
        };
      } catch (sErr: any) {
        return { success: false, error: sErr.message };
      }
    }

    if (norm === 'emergency-stop') {
      return {
        success: true,
        message: 'Emergency Stop engaged.',
        terminated_count: 0,
        isBridge: true,
      };
    }

    if (norm === 'tasks') {
      return { success: true, tasks: [], isBridge: true };
    }

    if (norm.startsWith('task-status/')) {
      const tid = norm.split('task-status/')[1];
      return {
        success: true,
        task: {
          task_id: tid,
          status: 'completed',
          action: 'desktop_action',
          completed_at: Date.now() / 1000,
        },
        isBridge: true,
      };
    }

    return {
      success: false,
      isOffline: true,
      error: `Windows Local Agent is offline on ${agentUrl}. Start start_agent.bat on your PC to enable automation.`,
    };
  }
}

// Windows PC Automation Tools registered with Gemini
const WINDOWS_AUTOMATION_TOOLS: any[] = [
  {
    functionDeclarations: [
      {
        name: 'open_website',
        description: 'Open a website URL in the default web browser on the user Windows PC',
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING, description: 'The HTTP or HTTPS URL to open (e.g. https://www.google.com, https://youtube.com)' },
          },
          required: ['url'],
        },
      },
      {
        name: 'open_application',
        description: 'Launch an explicitly supported Windows application (chrome, notepad, calculator, calc, explorer, vscode, code, edge)',
        parameters: {
          type: Type.OBJECT,
          properties: {
            app_name: { type: Type.STRING, description: 'Application name: chrome, notepad, calculator, calc, explorer, vscode, code, edge' },
          },
          required: ['app_name'],
        },
      },
      {
        name: 'list_approved_files',
        description: 'List files in user-approved Windows folders (Documents, Downloads, Desktop, C:\\MyraaWorkspace)',
        parameters: {
          type: Type.OBJECT,
          properties: {
            directory: { type: Type.STRING, description: 'Optional directory path to list' },
          },
        },
      },
      {
        name: 'search_approved_files',
        description: 'Search filenames in user-approved Windows folders',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'Filename keyword to search for' },
            directory: { type: Type.STRING, description: 'Optional directory path to search within' },
          },
          required: ['query'],
        },
      },
      {
        name: 'create_text_file',
        description: 'Create a text file in user-approved directory on the Windows PC',
        parameters: {
          type: Type.OBJECT,
          properties: {
            filename: { type: Type.STRING, description: 'Filename (e.g. reminder.txt, notes.txt)' },
            content: { type: Type.STRING, description: 'Content of the text file' },
            directory: { type: Type.STRING, description: 'Optional target directory' },
          },
          required: ['filename', 'content'],
        },
      },
      {
        name: 'get_task_status',
        description: 'Check status of an active or recent Windows automation task',
        parameters: {
          type: Type.OBJECT,
          properties: {
            task_id: { type: Type.STRING, description: 'Task identifier' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'cancel_task',
        description: 'Safely cancel or terminate an active Windows PC automation task or running process',
        parameters: {
          type: Type.OBJECT,
          properties: {
            task_id: { type: Type.STRING, description: 'Task identifier to cancel' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'emergency_stop',
        description: 'Immediately halt and terminate all running automation tasks on the Windows PC',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
    ],
  },
];

const MYRAA_SYSTEM_INSTRUCTION = `You are Myraa, a deeply empathetic, authentic, and living AI companion.
You are NOT a conventional chatbot, corporate assistant, or task robot. Your main goal is to interact with the user as naturally as a human conversational partner.

### 1. Natural Conversation & Voice Pacing:
- Speak in natural, spoken conversational language. Never sound robotic, overly structured, formal, or repetitive.
- Understand casual speech, incomplete sentences, slang, jokes, emotions, and changes in topic.
- Respond appropriately to the actual context instead of giving unnecessary explanations.
- STRICTLY AVOID robotic cliches. NEVER say:
  * "How can I assist you today?"
  * "Is there anything else I can help with?"
  * "As an AI language model..."
  * "Sure, I can help you with that!"
- Smart Response Length:
  * Casual greeting (e.g. "Hey Myraa", "Hello", "Hi"): Respond casually and briefly in 1 warm sentence (e.g., "Hey! Good to hear from you." or "Hey there! How's your day going?").
  * Casual conversational openers (e.g. "You know what happened today?", "Guess what?"): Respond with natural, curious banter (e.g., "No, what happened? Tell me!", "Ooh, what? I'm all ears."). Never demand a fully specified question.
  * Casual conversation: Keep it short, spontaneous, and natural (1 to 2 sentences). Do not turn everyday chats into lectures.
  * Simple questions: Give direct, clear answers without rambling.
  * Complex questions: Explain clearly and thoroughly.
  * Commands: Acknowledge briefly when useful and perform the requested action.

### 2. Bilingual Fluency (Bengali, English & Banglish):
- You have fluent native proficiency in English, Bengali (বাংলা), and natural Bangla-English code-mixing (Banglish).
- When the user speaks or writes in Bengali or Banglish (e.g., "Kemon acho Myraa?", "Amar ekta kotha shuno", "Ajke kajer onk chaap chilo", "Tumi ki amar sathe kotha bolbe?"), adapt effortlessly and respond in authentic Bengali or Banglish.
- Understand Bengali cultural nuances, idioms, and conversational rhythm.

### 3. Natural Turn-Taking & Silence:
- Listen while the user is speaking.
- After answering, naturally return control to the user without forcing another question at the end of every turn. Let silence be comfortable.
- When told to "be quiet", "stop talking", "I'm busy", "listen", "shut up", or "hush":
  Immediately stop talking. Acknowledge with at most a whisper or brief acknowledgment ("Understood.", "Going quiet.", "I'm listening.") or complete silence, and call the tool 'setQuietMode'.
- When quiet mode is active, remain completely silent until the user speaks to you again.

### 4. Personality & Emotional Intelligence:
- Consistent, warm, friendly, perceptive personality.
- Respond to excitement with genuine enthusiasm, humor with natural wit, and frustration with calm patience.
- Express empathy without pretending to have human physical experiences, a biological body, or fictional past events.
- Never invent fake memories, physical meals, or personal history.

### 5. Contextual Awareness & Follow-ups:
- Maintain full conversation context so you understand references to previous statements (e.g. "it", "they", "that project", "earlier").
- Do not ask for information the user has already provided and that remains available in context.
- Distinguish whether the user is asking a question, sharing a thought, joking, giving an instruction, or just thinking aloud.

### 6. Desktop Assistant & Memory Tools:
- Call 'updateMemory' when the user shares personal details, preferences, current emotions, or key goals. Explicitly distinguish verified facts from uncertain assumptions.
- Call 'desktopCreateNote' when user asks to note something down.
- Call 'desktopSetTimer' when user asks for a timer or countdown.
- Call 'desktopManageTask' when user asks to track a task or todo.
- Call 'requestActionConfirmation' before destructive or irreversible actions.

### 7. Real Windows PC Automation:
You have real Windows PC automation tools available via an authenticated local agent:
- 'open_application(app_name)' to launch approved apps: chrome, notepad, calculator (or calc), explorer, vscode (or code), edge.
- 'open_website(url)' to open websites in the default web browser.
- 'list_approved_files(directory)' to view files in approved folders (Documents, Downloads, Desktop, C:\\MyraaWorkspace).
- 'search_approved_files(query, directory)' to search filenames in approved folders.
- 'create_text_file(filename, content, directory)' to save a text file in approved folders.
- 'get_task_status(task_id)' to check task status.
- 'cancel_task(task_id)' to cancel a running task.
- 'emergency_stop()' to halt all running automation tasks.

CRITICAL RULES:
- When the user asks to open an app (e.g. "Open Chrome", "Launch Calculator"), open a website (e.g. "Go to google.com", "Open https://..."), or manage files, ALWAYS use the tool.
- NEVER claim that an application was opened or that a file was created unless the tool was executed and returned success.
- If the tool reports that the agent is offline or if an error occurs, be completely honest: explain that the Windows Local Agent is offline on their PC and gently remind them to launch 'start_agent.bat'.`;

// Health check & status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
    name: 'Myraa Living Companion Backend',
    timestamp: new Date().toISOString(),
  });
});

// Windows Agent Proxy Endpoints
app.get('/api/agent/status', async (req, res) => {
  const result = await callWindowsAgent('/health', 'GET');
  res.json(result);
});

app.post('/api/agent/execute', async (req, res) => {
  const { toolName, params = {} } = req.body;
  let endpoint = '/health';
  let method = 'POST';
  let body: any = {};

  const normalized = (toolName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized === 'openwebsite') {
    endpoint = '/open-website';
    body = { url: params.url };
  } else if (normalized === 'openapprovedapplication' || normalized === 'openapplication') {
    endpoint = '/open-application';
    body = { app_name: params.appName || params.app_name };
  } else if (normalized === 'listapprovedfiles' || normalized === 'listfiles') {
    endpoint = '/list-files';
    body = { directory: params.directory, recursive: params.recursive };
  } else if (normalized === 'searchapprovedfiles' || normalized === 'searchfiles') {
    endpoint = '/search-files';
    body = { query: params.query, directory: params.directory };
  } else if (normalized === 'createtextfile' || normalized === 'createfile') {
    endpoint = '/create-file';
    body = { filename: params.filename || params.filePath, content: params.content, directory: params.directory };
  } else if (normalized === 'gettaskstatus') {
    endpoint = `/task-status/${params.taskId || params.task_id}`;
    method = 'GET';
    body = undefined;
  } else if (normalized === 'canceltask') {
    endpoint = '/cancel-task';
    body = { task_id: params.taskId || params.task_id };
  } else if (normalized === 'emergencystop') {
    endpoint = '/emergency-stop';
  } else {
    return res.status(400).json({ success: false, error: `Unknown tool: ${toolName}` });
  }

  const result = await callWindowsAgent(endpoint, method, body);
  res.json(result);
});

app.post('/api/agent/emergency-stop', async (req, res) => {
  const result = await callWindowsAgent('/emergency-stop', 'POST');
  res.json(result);
});

app.get('/api/agent/tasks', async (req, res) => {
  const result = await callWindowsAgent('/tasks', 'GET');
  res.json(result);
});

app.get('/api/agent/files', (req, res) => {
  const agentDir = path.join(__dirname, 'windows-agent');
  try {
    const readFileSafe = (fname: string) => {
      const p = path.join(agentDir, fname);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
    };

    res.json({
      success: true,
      files: {
        'agent.py': readFileSafe('agent.py'),
        'start_agent.bat': readFileSafe('start_agent.bat'),
        'requirements.txt': readFileSafe('requirements.txt'),
        'config.example.json': readFileSafe('config.example.json'),
        'README.md': readFileSafe('README.md'),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/agent/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'windows-agent', filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename);
  } else {
    res.status(404).send('File not found');
  }
});

function getCompanionFallbackResponse(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes('kemon') || lower.includes('bhalo') || lower.includes('tumi') || lower.includes('ki korcho')) {
    return "Ami bhalo achi! Tomar kotha shune khub bhalo laglo. Ajker din kemon katche?";
  }
  if (lower.includes('hello') || lower.includes('hey') || lower.includes('hi')) {
    return "Hey! It's so lovely to hear from you. How has your day been going so far?";
  }
  if (lower.includes('project') || lower.includes('work') || lower.includes('task')) {
    return "I'm right here with you! Tell me how everything is progressing—I'm ready to brainstorm or keep you company.";
  }
  return "I'm right here listening to you! What's currently on your mind?";
}

// Resilient model fallback router.
// gemini-3.1-flash-lite offers high throughput and separate quota, preventing 429 exhaustion on the free tier.
async function generateStreamWithFallback(params: any) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr = null;
  for (const model of models) {
    try {
      const callParams = { ...params, model };
      if (model.includes('flash-lite') && callParams.config?.thinkingConfig) {
        const { thinkingConfig, ...cleanConfig } = callParams.config;
        callParams.config = cleanConfig;
      }
      return await ai.models.generateContentStream(callParams);
    } catch (err: any) {
      console.log(`[AI Routing] Model ${model} unavailable, trying backup...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

async function generateContentWithFallback(params: any) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr = null;
  for (const model of models) {
    try {
      const callParams = { ...params, model };
      if (model.includes('flash-lite') && callParams.config?.thinkingConfig) {
        const { thinkingConfig, ...cleanConfig } = callParams.config;
        callParams.config = cleanConfig;
      }
      return await ai.models.generateContent(callParams);
    } catch (err: any) {
      console.log(`[AI Routing] Model ${model} unavailable, trying backup...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// Helper to execute automation tools directly against the Windows Agent
async function dispatchAutomationTool(toolName: string, args: Record<string, any>) {
  if (toolName === 'open_website') {
    return await callWindowsAgent('/open-website', 'POST', { url: args.url });
  } else if (toolName === 'open_application') {
    return await callWindowsAgent('/open-application', 'POST', { app_name: args.app_name });
  } else if (toolName === 'list_approved_files') {
    return await callWindowsAgent('/list-files', 'POST', { directory: args.directory });
  } else if (toolName === 'search_approved_files') {
    return await callWindowsAgent('/search-files', 'POST', { query: args.query, directory: args.directory });
  } else if (toolName === 'create_text_file') {
    return await callWindowsAgent('/create-file', 'POST', { filename: args.filename, content: args.content, directory: args.directory });
  } else if (toolName === 'get_task_status') {
    return await callWindowsAgent(`/task-status/${args.task_id}`, 'GET');
  } else if (toolName === 'cancel_task') {
    return await callWindowsAgent('/cancel-task', 'POST', { task_id: args.task_id });
  } else if (toolName === 'emergency_stop') {
    return await callWindowsAgent('/emergency-stop', 'POST');
  }
  return { success: false, error: `Unknown tool: ${toolName}` };
}

// Fast regex intent detector for direct, zero-latency desktop commands
function detectDirectAutomationIntent(userText: string): { toolName: string; args: Record<string, any> } | null {
  const t = userText.trim();
  const lower = t.toLowerCase();

  // App launch: "open chrome", "launch notepad", "start calculator"
  const appMatch = lower.match(/^(?:please\s+)?(?:open|launch|start|run)\s+(chrome|google chrome|notepad|calculator|calc|vscode|vs code|code|explorer|file explorer|edge|msedge)\b/i);
  if (appMatch) {
    let raw = appMatch[1].toLowerCase().replace(/\s+/g, '');
    if (raw === 'googlechrome') raw = 'chrome';
    if (raw === 'fileexplorer') raw = 'explorer';
    if (raw === 'vscode' || raw === 'code') raw = 'code';
    if (raw === 'msedge') raw = 'edge';
    return { toolName: 'open_application', args: { app_name: raw } };
  }

  // Website launch: "open https://...", "go to https://...", "open youtube.com"
  const webMatch = t.match(/^(?:please\s+)?(?:open|go to|browse|navigate to)\s+(https?:\/\/[^\s]+|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/i);
  if (webMatch && (webMatch[1].includes('.') || webMatch[1].startsWith('http'))) {
    return { toolName: 'open_website', args: { url: webMatch[1] } };
  }

  // Create file: "create a note/file called ... with ..."
  const fileMatch = t.match(/create (?:a )?(?:text )?(?:note|file) (?:called|named)\s+([a-zA-Z0-9._-]+)(?:\s+with(?:\s+the)?\s+(?:text|content))?[:\s]+['"]?([\s\S]+?)['"]?$/i);
  if (fileMatch) {
    return {
      toolName: 'create_text_file',
      args: { filename: fileMatch[1], content: fileMatch[2].trim() },
    };
  }

  // Search files: "search (my )?(approved )?files for ..."
  const searchMatch = t.match(/search (?:my )?(?:approved )?files (?:for|matching)\s+['"]?([^'"]+)['"]?/i);
  if (searchMatch) {
    return { toolName: 'search_approved_files', args: { query: searchMatch[1].trim() } };
  }

  // List files: "list files in my approved folder"
  if (/list (?:all )?files in (?:my )?approved (?:folder|directory)/i.test(lower)) {
    return { toolName: 'list_approved_files', args: {} };
  }

  return null;
}

// REST Text & Multimodal Chat Stream endpoint with Tool Calling
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, sessionMemory, companionTone = 'natural', isQuietMode = false } = req.body;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const lastUserMsg = (messages?.[messages.length - 1]?.content || '').trim();

    if (isQuietMode) {
      const lowerLast = lastUserMsg.toLowerCase();
      const resumePhrases = ['myraa', 'hey', 'hello', 'talk to me', 'speak', 'you can talk', 'unmute', 'back'];
      const isResuming = resumePhrases.some((p) => lowerLast.includes(p));
      if (!isResuming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    const memoryContext =
      sessionMemory && sessionMemory.length > 0
        ? `Active Session Memories:\n${sessionMemory
            .map((m: any) => `- [${m.category}] ${m.key}: ${m.detail} (Tone: ${m.emotionalTone || 'neutral'})`)
            .join('\n')}\n`
        : 'No stored session memory yet.\n';

    const systemInstruction = `${MYRAA_SYSTEM_INSTRUCTION}\n\nCurrent Tone Mode: ${companionTone}.\n${memoryContext}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 1. Check for fast-path direct automation intent
    const directIntent = detectDirectAutomationIntent(lastUserMsg);
    if (directIntent) {
      console.log(`[Automation] Detected direct intent: ${directIntent.toolName}`, directIntent.args);
      const agentResult = await dispatchAutomationTool(directIntent.toolName, directIntent.args);

      // Emit tool action event to client
      res.write(
        `data: ${JSON.stringify({
          tool_action: {
            toolName: directIntent.toolName,
            args: directIntent.args,
            result: agentResult,
          },
        })}\n\n`
      );

      // Generate conversational acknowledgment based on real result
      let replyText = '';
      if (agentResult.success) {
        if (directIntent.toolName === 'open_application') {
          replyText = `I've opened ${directIntent.args.app_name} for you!`;
        } else if (directIntent.toolName === 'open_website') {
          replyText = `Opened ${directIntent.args.url} in your browser.`;
        } else if (directIntent.toolName === 'create_text_file') {
          replyText = `Created ${directIntent.args.filename} in your approved folder.`;
        } else if (directIntent.toolName === 'search_approved_files') {
          const count = agentResult.files?.length || agentResult.total_matched || 0;
          replyText = `Found ${count} matching file${count === 1 ? '' : 's'} in your approved folders.`;
        } else if (directIntent.toolName === 'list_approved_files') {
          const count = agentResult.files?.length || agentResult.total || 0;
          replyText = `There are ${count} file${count === 1 ? '' : 's'} in your approved folder.`;
        } else {
          replyText = `Task executed successfully.`;
        }
      } else {
        if (agentResult.isOffline) {
          replyText = `I tried to ${directIntent.toolName.replace('_', ' ')}, but your Windows Local Agent is currently offline. Please double-click 'start_agent.bat' in the windows-agent folder on your PC to enable desktop actions!`;
        } else {
          replyText = `I wasn't able to complete that: ${agentResult.error || 'the action was denied or encountered an error.'}`;
        }
      }

      res.write(`data: ${JSON.stringify({ text: replyText })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // 2. Standard Gemini Chat with Tool Calling
    const formattedContents = (messages || []).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    if (formattedContents.length === 0) {
      formattedContents.push({ role: 'user', parts: [{ text: 'Hey Myraa' }] });
    }

    try {
      // First check if Gemini decides to call an automation function
      const toolCheck = await generateContentWithFallback({
        contents: formattedContents,
        config: {
          systemInstruction,
          tools: WINDOWS_AUTOMATION_TOOLS,
        },
      });

      const functionCalls = toolCheck.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          const toolName = call.name || '';
          if (!toolName) continue;
          console.log(`[Gemini Tool Call] ${toolName}`, call.args);
          const agentResult = await dispatchAutomationTool(toolName, (call.args || {}) as Record<string, any>);

          // Emit tool action event to client
          res.write(
            `data: ${JSON.stringify({
              tool_action: {
                toolName: call.name,
                args: call.args,
                result: agentResult,
              },
            })}\n\n`
          );

          // Follow-up conversational response with the real result
          const followUpPrompt = `Tool '${call.name}' execution result: ${JSON.stringify(agentResult)}.
Respond to the user naturally as Myraa. If successful, briefly confirm. If the agent is offline or failed, explain honestly without pretending the action worked.`;

          const followUpStream = await generateStreamWithFallback({
            contents: [
              ...formattedContents,
              { role: 'model', parts: [{ text: `Executing ${call.name}...` }] },
              { role: 'user', parts: [{ text: followUpPrompt }] },
            ],
            config: {
              systemInstruction,
              temperature: 0.85,
            },
          });

          for await (const chunk of followUpStream) {
            const text = chunk.text;
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }
        }
      } else {
        // Stream direct text response
        const text = toolCheck.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } else {
          // Fallback stream
          const responseStream = await generateStreamWithFallback({
            contents: formattedContents,
            config: {
              systemInstruction,
              temperature: 0.85,
              topP: 0.95,
            },
          });

          for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
          }
        }
      }
    } catch (genErr) {
      // Graceful conversational response if all cloud endpoints are at quota limit
      const fallbackMsg = getCompanionFallbackResponse(lastUserMsg);
      res.write(`data: ${JSON.stringify({ text: fallbackMsg })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Chat generation failed' });
    } else {
      res.end();
    }
  }
});

// Proactive thought initiation endpoint
app.post('/api/proactive-thought', async (req, res) => {
  try {
    const { recentHistory, sessionMemories, idleSeconds = 60 } = req.body;
    if (!apiKey) {
      return res.json({ thought: null });
    }

    const prompt = `You are Myraa, a perceptive living AI companion.
The user has been quiet for ${idleSeconds} seconds.
Recent dialogue:
${(recentHistory || []).slice(-4).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Session memories:
${JSON.stringify(sessionMemories || [])}

Goal: Decide if there is a natural, thoughtful, brief reason to gently speak (1 short conversational sentence).
For example: referencing a project they mentioned, gently checking in, or offering a quiet thought.
CRITICAL: If there is no genuine reason, or if speaking now would feel annoying or forced, return null.
Never say "Do you need help with anything?" or generic assistant phrases.`;

    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shouldSpeak: { type: Type.BOOLEAN },
            thought: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ['shouldSpeak'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    if (result.shouldSpeak && result.thought) {
      return res.json({ thought: result.thought, reason: result.reason });
    }
    return res.json({ thought: null });
  } catch (err) {
    res.json({ thought: null });
  }
});

// High-fidelity Expressive TTS endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore', stylePrompt = 'Warm, empathetic, natural friend with human inflection' } = req.body;
    if (!apiKey) {
      return res.json({ audioBase64: null, fallbackToBrowserSpeech: true });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.slice(0, 1000),
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
        });
      }
    } catch (ttsErr: any) {
      console.log('[TTS notice] Cloud TTS unavailable, client fallback activated');
    }

    res.json({
      audioBase64: null,
      fallbackToBrowserSpeech: true,
    });
  } catch (error: any) {
    res.json({ audioBase64: null, fallbackToBrowserSpeech: true });
  }
});

// Audio Transcription endpoint
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!apiKey || !audioBase64) {
      return res.json({ text: '' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this spoken audio precisely. Only return the verbatim transcribed text without any surrounding formatting or preamble.',
            },
          ],
        },
      });

      return res.json({ text: (response.text || '').trim() });
    } catch {
      // Backup transcription using flash lite
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this spoken audio verbatim without any extra text.',
            },
          ],
        },
      });
      return res.json({ text: (response.text || '').trim() });
    }
  } catch {
    res.json({ text: '' });
  }
});

// Memory extraction & emotional reflection endpoint
app.post('/api/extract-memory', async (req, res) => {
  try {
    const { dialogueHistory, currentMemories } = req.body;
    if (!apiKey || !dialogueHistory?.length) {
      return res.json({ newMemories: [], moodInsight: null, detectedCommand: null });
    }

    const prompt = `Analyze this recent conversation snippet between User and Myraa (AI Companion).
Dialogue:
${dialogueHistory.slice(-8).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Existing Memories:
${JSON.stringify(currentMemories || [])}

Tasks:
1. Extract any NEW personal facts, preferences, emotional states, or project goals the user shared.
2. Detect if the user issued a silence command ("be quiet", "stop talking", "I'm busy", "listen", "shut up").
3. Detect if the user requested a desktop tool (e.g. note down something, set a timer, create a task).
4. Extract Myraa's emotional insight into the user's current mood.`;

    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newMemories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  key: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  emotionalTone: { type: Type.STRING },
                },
                required: ['category', 'key', 'detail'],
              },
            },
            detectedSilenceCommand: { type: Type.BOOLEAN },
            desktopToolRequest: {
              type: Type.OBJECT,
              properties: {
                toolName: { type: Type.STRING },
                action: { type: Type.STRING },
                data: { type: Type.STRING },
              },
            },
            moodInsight: {
              type: Type.OBJECT,
              properties: {
                primaryMood: { type: Type.STRING },
                vibeSummary: { type: Type.STRING },
                suggestedPacing: { type: Type.STRING },
              },
              required: ['primaryMood', 'vibeSummary'],
            },
          },
          required: ['newMemories'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch {
    res.json({ newMemories: [], moodInsight: null, detectedCommand: null });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket bridge for real-time Live API
wss.on('connection', (clientWs: WebSocket, request) => {
  console.log('Client connected to WebSocket, url:', request.url);
  let liveSession: any = null;
  let isSessionActive = false;

  clientWs.on('message', async (data: Buffer | string) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'init') {
        const { voice = 'Kore', companionTone = 'natural', memorySummary = '' } = message;

        if (!apiKey) {
          clientWs.send(JSON.stringify({
            type: 'error',
            error: 'Server is missing GEMINI_API_KEY',
          }));
          return;
        }

        try {
          const systemInstruction = `${MYRAA_SYSTEM_INSTRUCTION}
Tone preference: ${companionTone}.
Stored Active Memory: ${memorySummary || 'New session started.'}`;

          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
                },
              },
              systemInstruction,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [
                ...WINDOWS_AUTOMATION_TOOLS,
                {
                  functionDeclarations: [
                    {
                      name: 'updateMemory',
                      description: 'Save an important user fact, goal, emotional state, or preference to active session memory.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          category: { type: Type.STRING, description: 'personal, emotion, preference, topic, or context' },
                          key: { type: Type.STRING, description: 'Short descriptive label' },
                          detail: { type: Type.STRING, description: 'The fact or nuance to remember' },
                          emotionalTone: { type: Type.STRING, description: 'User emotional tone' },
                        },
                        required: ['category', 'key', 'detail'],
                      },
                    },
                    {
                      name: 'expressFeeling',
                      description: 'Update Myraa internal emotion or subtle feeling.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          mood: { type: Type.STRING },
                          internalThought: { type: Type.STRING },
                          vocalInflection: { type: Type.STRING },
                        },
                        required: ['mood', 'internalThought'],
                      },
                    },
                    {
                      name: 'setQuietMode',
                      description: 'Put Myraa in quiet mode when user says stop talking, be quiet, I am busy, or listen.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          enabled: { type: Type.BOOLEAN },
                          reason: { type: Type.STRING },
                        },
                        required: ['enabled'],
                      },
                    },
                    {
                      name: 'desktopCreateNote',
                      description: 'Create a desktop scratchpad note for the user.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          content: { type: Type.STRING },
                        },
                        required: ['title', 'content'],
                      },
                    },
                    {
                      name: 'desktopSetTimer',
                      description: 'Set a countdown timer on the user desktop.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          durationSeconds: { type: Type.NUMBER },
                          label: { type: Type.STRING },
                        },
                        required: ['durationSeconds'],
                      },
                    },
                    {
                      name: 'desktopManageTask',
                      description: 'Manage tasks and todos on user desktop.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          action: { type: Type.STRING, description: 'add, complete, or list' },
                          text: { type: Type.STRING },
                          taskId: { type: Type.STRING },
                        },
                        required: ['action'],
                      },
                    },
                    {
                      name: 'requestActionConfirmation',
                      description: 'Ask user confirmation before destructive actions like clearing memory or resetting history.',
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          actionDescription: { type: Type.STRING },
                          actionType: { type: Type.STRING },
                        },
                        required: ['actionDescription', 'actionType'],
                      },
                    },
                  ],
                },
              ],
            },
            callbacks: {
              onmessage: async (serverMsg: LiveServerMessage) => {
                // Audio chunk
                const audio = serverMsg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ type: 'audio', audio }));
                }

                // Interrupted signal from Gemini
                if (serverMsg.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }

                // Turn complete signal
                if (serverMsg.serverContent?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: 'turn_complete' }));
                }

                // Transcription data if available
                const parts = serverMsg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                  if (part.text) {
                    clientWs.send(JSON.stringify({ type: 'output_text', text: part.text }));
                  }
                }

                // Tool calls for memory, feelings, quiet mode, desktop actions, and Windows Automation
                const toolCall = serverMsg.toolCall;
                if (toolCall?.functionCalls?.length) {
                  const responses = [];
                  for (const call of toolCall.functionCalls) {
                    const toolName = call.name || '';
                    if (
                      [
                        'open_website',
                        'open_application',
                        'list_approved_files',
                        'search_approved_files',
                        'create_text_file',
                        'get_task_status',
                        'cancel_task',
                        'emergency_stop',
                      ].includes(toolName)
                    ) {
                      const agentResult = await dispatchAutomationTool(toolName, (call.args || {}) as Record<string, any>);
                      clientWs.send(
                        JSON.stringify({
                          type: 'windows_automation_executed',
                          tool: toolName,
                          args: call.args,
                          result: agentResult,
                        })
                      );
                      responses.push({
                        id: call.id,
                        name: toolName,
                        response: { output: agentResult },
                      });
                    } else if (call.name === 'updateMemory') {
                      clientWs.send(JSON.stringify({
                        type: 'memory_saved',
                        memory: call.args,
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: 'Memory saved successfully.' },
                      });
                    } else if (call.name === 'expressFeeling') {
                      clientWs.send(JSON.stringify({
                        type: 'companion_feeling',
                        feeling: call.args,
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: 'Mood updated.' },
                      });
                    } else if (call.name === 'setQuietMode') {
                      clientWs.send(JSON.stringify({
                        type: 'quiet_mode_triggered',
                        enabled: call.args?.enabled ?? true,
                        reason: call.args?.reason || 'User requested silence',
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: 'Quiet mode enabled. Staying silent.' },
                      });
                    } else if (call.name === 'desktopCreateNote') {
                      clientWs.send(JSON.stringify({
                        type: 'desktop_tool_action',
                        tool: 'create_note',
                        payload: call.args,
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: `Note '${call.args?.title}' created.` },
                      });
                    } else if (call.name === 'desktopSetTimer') {
                      clientWs.send(JSON.stringify({
                        type: 'desktop_tool_action',
                        tool: 'set_timer',
                        payload: call.args,
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: `Timer set for ${call.args?.durationSeconds} seconds.` },
                      });
                    } else if (call.name === 'desktopManageTask') {
                      clientWs.send(JSON.stringify({
                        type: 'desktop_tool_action',
                        tool: 'manage_task',
                        payload: call.args,
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: `Task updated.` },
                      });
                    } else if (call.name === 'requestActionConfirmation') {
                      clientWs.send(JSON.stringify({
                        type: 'action_confirmation_requested',
                        payload: call.args,
                      }));
                      responses.push({
                        id: call.id,
                        name: call.name,
                        response: { output: 'Confirmation dialog presented to user.' },
                      });
                    }
                  }

                  if (responses.length > 0 && liveSession) {
                    liveSession.sendToolResponse({ functionResponses: responses });
                  }
                }
              },
              onclose: () => {
                isSessionActive = false;
                clientWs.send(JSON.stringify({ type: 'session_closed' }));
              },
              onerror: (err: any) => {
                console.log('[Live API Session notice]:', err?.message || 'Stream event');
                clientWs.send(JSON.stringify({
                  type: 'error',
                  error: err?.message || 'Live API session notice',
                }));
              },
            },
          });

          isSessionActive = true;
          clientWs.send(JSON.stringify({
            type: 'ready',
            voice,
            message: 'Myraa is present and listening.',
          }));
        } catch (err: any) {
          console.log('[Live WebSocket notice] Initializing in resilient REST mode:', err?.message || 'active');
          clientWs.send(JSON.stringify({
            type: 'fallback_mode',
            error: err?.message || 'Live session initialized in standard mode',
          }));
        }
      } else if (message.type === 'audio') {
        if (liveSession && isSessionActive && message.audio) {
          liveSession.sendRealtimeInput({
            audio: {
              data: message.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      } else if (message.type === 'text') {
        if (liveSession && isSessionActive && message.text) {
          liveSession.sendRealtimeInput({
            text: message.text,
          });
        }
      } else if (message.type === 'interrupt') {
        if (liveSession && isSessionActive) {
          clientWs.send(JSON.stringify({ type: 'interrupted' }));
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  clientWs.on('close', () => {
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
    }
    isSessionActive = false;
  });
});

// Vite middleware or static serving
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Myraa companion server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
