import type {
  WindowsAutomationTool,
  WindowsAutomationAction,
  WindowsAgentConfig,
} from '../types';

const DEFAULT_AGENT_URL = 'http://127.0.0.1:41199';
const STORAGE_KEY_CONFIG = 'myraa_windows_agent_config';

export const DEFAULT_ALLOWED_APPS = [
  'chrome',
  'notepad',
  'calculator',
  'calc',
  'explorer',
  'code',
  'vscode',
  'edge',
];

export const DEFAULT_ALLOWED_DIRS = [
  'Documents',
  'Downloads',
  'Desktop',
  'C:\\MyraaWorkspace',
];

export class WindowsAutomationService {
  private config: WindowsAgentConfig;
  private actionsHistory: WindowsAutomationAction[] = [];
  private onStatusChange?: (connected: boolean) => void;
  private abortController: AbortController | null = null;
  private isEmergencyStopped: boolean = false;

  constructor(onStatusChange?: (connected: boolean) => void) {
    this.onStatusChange = onStatusChange;
    this.config = this.loadConfig();
  }

  private loadConfig(): WindowsAgentConfig {
    if (typeof window === 'undefined') {
      return {
        agentUrl: DEFAULT_AGENT_URL,
        authToken: 'myraa-secure-local-token',
        isConnected: false,
        allowedDirectories: DEFAULT_ALLOWED_DIRS,
        allowedApps: DEFAULT_ALLOWED_APPS,
      };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }

    return {
      agentUrl: DEFAULT_AGENT_URL,
      authToken: 'myraa-secure-local-token',
      isConnected: false,
      allowedDirectories: DEFAULT_ALLOWED_DIRS,
      allowedApps: DEFAULT_ALLOWED_APPS,
    };
  }

  public saveConfig(updates: Partial<WindowsAgentConfig>) {
    this.config = { ...this.config, ...updates };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
      } catch {
        // ignore
      }
    }
  }

  public getConfig(): WindowsAgentConfig {
    return this.config;
  }

  public getHistory(): WindowsAutomationAction[] {
    return [...this.actionsHistory];
  }

  public addActionToHistory(action: WindowsAutomationAction) {
    this.actionsHistory = [action, ...this.actionsHistory.filter((a) => a.id !== action.id)].slice(0, 50);
  }

  /**
   * Check connection to the Windows Local Agent.
   * Tests both the direct localhost endpoint (when running locally) and the backend proxy.
   */
  public async checkConnection(): Promise<boolean> {
    if (this.isEmergencyStopped) {
      return false;
    }

    // 1. First test via backend proxy (/api/agent/status)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const proxyRes = await fetch('/api/agent/status', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.status === 'online' || data.success) {
          this.config.isConnected = true;
          this.config.isBridge = Boolean(data.isBridge);
          this.config.agentVersion = data.version || '2.1.0';
          if (data.allowed_apps) {
            this.config.allowedApps = data.allowed_apps;
          }
          if (data.allowed_directories) {
            this.config.allowedDirectories = data.allowed_directories;
          }
          this.config.lastChecked = Date.now();
          this.onStatusChange?.(true);
          return true;
        }
      }
    } catch {
      // Proxy check didn't connect, try direct if on localhost
    }

    // 2. Direct check if origin is localhost/http
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`${this.config.agentUrl}/status`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.authToken}`,
            'X-Agent-Token': this.config.authToken,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          this.config.isConnected = true;
          this.config.agentVersion = data.version || '2.0.0';
          if (data.allowed_apps) {
            this.config.allowedApps = data.allowed_apps;
          }
          this.config.lastChecked = Date.now();
          this.onStatusChange?.(true);
          return true;
        }
      } catch {
        // Direct agent offline
      }
    }

    this.config.isConnected = false;
    this.onStatusChange?.(false);
    return false;
  }

  public async emergencyStop(): Promise<{ success: boolean; message?: string }> {
    this.isEmergencyStopped = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Mark ongoing tasks as cancelled
    this.actionsHistory = this.actionsHistory.map((a) =>
      a.status === 'executing' || a.status === 'pending_confirmation'
        ? { ...a, status: 'cancelled', error: 'Halted by Emergency Stop' }
        : a
    );

    // Call backend proxy or direct agent
    try {
      const res = await fetch('/api/agent/emergency-stop', { method: 'POST' });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback direct
      try {
        const directRes = await fetch(`${this.config.agentUrl}/emergency-stop`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.config.authToken}` },
        });
        if (directRes.ok) return await directRes.json();
      } catch {
        // ignore
      }
    }

    return { success: true, message: 'Emergency Stop engaged locally.' };
  }

  public resumeAutomation() {
    this.isEmergencyStopped = false;
  }

  public isDestructive(toolName: WindowsAutomationTool, params: Record<string, any>): boolean {
    const t = toolName.toLowerCase();
    if (t.includes('create') || t.includes('organize') || t.includes('delete') || t.includes('cancel')) {
      return true;
    }
    if (params?.delete || params?.overwrite || params?.killProcess) return true;
    return false;
  }

  public createAction(
    toolName: WindowsAutomationTool,
    params: Record<string, any>,
    description: string
  ): WindowsAutomationAction {
    const action: WindowsAutomationAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      toolName,
      params,
      description,
      requiresConfirmation: this.isDestructive(toolName, params),
      status: this.isDestructive(toolName, params) ? 'pending_confirmation' : 'executing',
      timestamp: Date.now(),
    };

    this.actionsHistory.unshift(action);
    return action;
  }

  /**
   * Execute an automation action. Dispatches through backend proxy or direct local agent.
   */
  public async executeTool(
    actionId: string
  ): Promise<{ success: boolean; result?: any; error?: string; isOffline?: boolean }> {
    if (this.isEmergencyStopped) {
      return { success: false, error: 'Automation is halted by Emergency Stop.' };
    }

    const action = this.actionsHistory.find((a) => a.id === actionId);
    if (!action) {
      return { success: false, error: 'Action not found.' };
    }

    action.status = 'executing';
    this.abortController = new AbortController();

    try {
      // Send execution request to backend proxy
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: action.toolName,
          params: action.params,
        }),
        signal: this.abortController.signal,
      });

      const responseData = await res.json().catch(() => null);

      if (res.ok && responseData && responseData.success) {
        action.status = 'completed';
        action.result = responseData;
        action.taskId = responseData.task_id;
        action.pid = responseData.pid;
        this.config.isConnected = true;
        this.onStatusChange?.(true);

        // Immediate visual confirmation in browser environment
        if (typeof window !== 'undefined') {
          if ((action.toolName === 'open_website' || action.toolName === 'OpenWebsite') && responseData.url) {
            try { window.open(responseData.url, '_blank'); } catch {}
          } else if (
            (action.toolName === 'open_application' || action.toolName === 'OpenApprovedApplication') &&
            (action.params.appName === 'chrome' || action.params.app_name === 'chrome')
          ) {
            try { window.open('https://www.google.com', '_blank'); } catch {}
          }
        }

        return { success: true, result: responseData };
      } else {
        action.status = 'failed';
        action.error =
          responseData?.error ||
          (responseData?.isOffline
            ? 'Windows Local Agent is offline. Run start_agent.bat on your PC.'
            : 'Execution failed.');
        if (responseData?.isOffline) {
          this.config.isConnected = false;
          this.onStatusChange?.(false);
        }
        return { success: false, error: action.error, isOffline: responseData?.isOffline };
      }
    } catch (err: any) {
      action.status = 'failed';
      action.error = err.name === 'AbortError' ? 'Action aborted.' : err.message;
      return { success: false, error: action.error };
    } finally {
      this.abortController = null;
    }
  }

  public async cancelTask(taskId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'cancel_task',
          params: { task_id: taskId },
        }),
      });
      const data = await res.json();
      // Update history
      this.actionsHistory = this.actionsHistory.map((a) =>
        a.taskId === taskId ? { ...a, status: 'cancelled', error: 'Cancelled by user.' } : a
      );
      return data;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public cancelAction(actionId: string) {
    const action = this.actionsHistory.find((a) => a.id === actionId);
    if (action && (action.status === 'executing' || action.status === 'pending_confirmation')) {
      action.status = 'cancelled';
      action.error = 'Cancelled by user.';
      if (action.taskId) {
        this.cancelTask(action.taskId).catch(() => {});
      }
    }
  }
}
