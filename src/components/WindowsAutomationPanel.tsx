import React, { useState } from 'react';
import type {
  WindowsAgentConfig,
  WindowsAutomationAction,
  WindowsAutomationTool,
} from '../types';
import {
  Monitor,
  Shield,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  X,
  FileText,
  Search,
  Folder,
  Terminal,
  Download,
  Settings,
  HelpCircle,
  Square,
} from 'lucide-react';

interface WindowsAutomationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: WindowsAgentConfig;
  history: WindowsAutomationAction[];
  onCheckConnection: () => Promise<boolean>;
  onEmergencyStop: () => void;
  onResumeAutomation: () => void;
  onExecuteTool: (toolName: WindowsAutomationTool, params: Record<string, any>, description: string) => Promise<void>;
  onCancelAction: (id: string) => void;
  onSaveConfig: (updates: Partial<WindowsAgentConfig>) => void;
}

export const WindowsAutomationPanel: React.FC<WindowsAutomationPanelProps> = ({
  isOpen,
  onClose,
  config,
  history,
  onCheckConnection,
  onEmergencyStop,
  onResumeAutomation,
  onExecuteTool,
  onCancelAction,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'setup' | 'config'>('status');
  const [isChecking, setIsChecking] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [executingTool, setExecutingTool] = useState<string | null>(null);

  // Editable settings
  const [localUrl, setLocalUrl] = useState(config.agentUrl || 'http://127.0.0.1:41199');
  const [localToken, setLocalToken] = useState(config.authToken || 'myraa-secure-local-token');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Custom tool test state
  const [customTool, setCustomTool] = useState<WindowsAutomationTool>('open_application');
  const [customAppName, setCustomAppName] = useState('chrome');
  const [customUrlTest, setCustomUrlTest] = useState('https://www.google.com');
  const [customFileName, setCustomFileName] = useState('reminder.txt');
  const [customFileContent, setCustomFileContent] = useState('Buy groceries');
  const [customSearchQuery, setCustomSearchQuery] = useState('budget');

  if (!isOpen) return null;

  const handleVerify = async () => {
    setIsChecking(true);
    await onCheckConnection();
    setIsChecking(false);
  };

  const copySetupCommand = () => {
    navigator.clipboard.writeText('cd windows-agent && start_agent.bat');
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleSaveSettings = () => {
    onSaveConfig({ agentUrl: localUrl.trim(), authToken: localToken.trim() });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const runQuickTest = async (tool: WindowsAutomationTool, params: Record<string, any>, desc: string) => {
    setExecutingTool(desc);
    try {
      await onExecuteTool(tool, params, desc);
    } finally {
      setExecutingTool(null);
    }
  };

  const downloadFile = (filename: string) => {
    window.open(`/api/agent/download/${filename}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Windows PC Automation Agent</h3>
                <p className="text-xs text-slate-400">
                  Secure local bridge for desktop application and file workflows
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Emergency Stop Button */}
              <button
                onClick={onEmergencyStop}
                className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition-colors"
                title="Immediately halt all running tasks on the PC"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Emergency Stop</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Connection Status Pill & Verification */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                  config.isConnected ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                }`}
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-200">
                    {config.isConnected
                      ? config.isBridge
                        ? 'Desktop Bridge Active (সক্রিয়)'
                        : 'Local Agent Connected (সংযুক্ত)'
                      : 'Local Agent Standby (অপেক্ষমাণ)'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({config.agentUrl})
                  </span>
                  {config.isConnected && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">
                      ONLINE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {config.isConnected
                    ? `Ready for Windows tasks (Agent v${config.agentVersion || '2.1.0'} · সমস্ত অটোমেশন প্রস্তুত)`
                    : 'আপনার কম্পিউটারে start_agent.bat চালু করুন অথবা সরাসরি অটো-ফিক্স ক্লিক করুন।'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={handleVerify}
                disabled={isChecking}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                title="লোকালহোস্ট সংযোগ চেক ও স্বয়ংক্রিয় সমাধান করুন"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'যাচাই হচ্ছে...' : 'Auto-Fix / ঠিক করুন'}</span>
              </button>
            </div>
          </div>

          {/* Bilingual Help Note */}
          <div className="mt-2.5 px-3 py-2 rounded-lg bg-sky-950/20 border border-sky-500/20 flex items-start gap-2 text-[11px] text-sky-200">
            <CheckCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold text-sky-300">লোকালহোস্ট সমাধান টিপ: </span>
              <span>
                আপনি যদি ব্রাউজারে থাকেন, তবে Myraa-এর বিল্ট-ইন <strong>Desktop Bridge</strong> স্বয়ংক্রিয়ভাবে Chrome, Calculator, Notepad ও ফাইল তৈরি পরিচালনা করতে সক্ষম। পিসিতে সরাসরি চালাতে <code className="text-sky-300 font-mono">start_agent.bat</code> ব্যবহার করুন।
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 p-1 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <button
              onClick={() => setActiveTab('status')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'status'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Capabilities & Test</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Action Log ({history.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'setup'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install & Files</span>
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'config'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="mt-3.5 max-h-[46vh] overflow-y-auto pr-1">
            {/* Status & Capabilities Tab */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                {/* Security Guarantees */}
                <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-300 font-medium">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>Strict Subprocess & Directory Protection</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Applications are launched using safe subprocess argument lists (<code className="text-slate-300">shell=False</code>). File actions are strictly restricted to approved folders (Documents, Downloads, Desktop, Workspace). Arbitrary shell execution is forbidden.
                  </p>
                </div>

                {/* Approved Apps */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                    Approved Windows Applications
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['chrome', 'notepad', 'calculator', 'calc', 'explorer', 'code', 'vscode', 'edge'].map((app) => (
                      <span
                        key={app}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-mono"
                      >
                        {app}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quick Automation Test */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                    Quick Verification Actions
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">Launch Google Chrome</span>
                      <button
                        onClick={() => runQuickTest('open_application', { app_name: 'chrome' }, 'Open Google Chrome')}
                        disabled={Boolean(executingTool)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs transition-colors shrink-0"
                      >
                        {executingTool === 'Open Google Chrome' ? 'Opening...' : 'Launch'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">Launch Calculator</span>
                      <button
                        onClick={() => runQuickTest('open_application', { app_name: 'calc' }, 'Open Calculator')}
                        disabled={Boolean(executingTool)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs transition-colors shrink-0"
                      >
                        {executingTool === 'Open Calculator' ? 'Opening...' : 'Launch'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">Launch Notepad</span>
                      <button
                        onClick={() => runQuickTest('open_application', { app_name: 'notepad' }, 'Open Notepad')}
                        disabled={Boolean(executingTool)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs transition-colors shrink-0"
                      >
                        {executingTool === 'Open Notepad' ? 'Opening...' : 'Launch'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">Open Google in Browser</span>
                      <button
                        onClick={() => runQuickTest('open_website', { url: 'https://www.google.com' }, 'Open Google in browser')}
                        disabled={Boolean(executingTool)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs transition-colors shrink-0"
                      >
                        {executingTool === 'Open Google in browser' ? 'Opening...' : 'Open'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">List Approved Files</span>
                      <button
                        onClick={() => runQuickTest('list_approved_files', {}, 'List approved files')}
                        disabled={Boolean(executingTool)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs transition-colors shrink-0"
                      >
                        {executingTool === 'List approved files' ? 'Listing...' : 'List'}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">Create 'reminder.txt'</span>
                      <button
                        onClick={() =>
                          runQuickTest(
                            'create_text_file',
                            { filename: 'reminder.txt', content: 'Buy groceries' },
                            'Create reminder.txt with Buy groceries'
                          )
                        }
                        disabled={Boolean(executingTool)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs transition-colors shrink-0"
                      >
                        {executingTool === 'Create reminder.txt with Buy groceries' ? 'Writing...' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {history.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p>No automation actions recorded yet.</p>
                    <p className="mt-1 text-slate-600">
                      When you speak or type "Open Chrome", "Launch Calculator", or file commands, they will be logged here.
                    </p>
                  </div>
                ) : (
                  history.map((action) => (
                    <div
                      key={action.id}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 font-mono text-[11px]">{action.toolName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                              action.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : action.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-300'
                                : action.status === 'executing'
                                ? 'bg-sky-500/20 text-sky-300 animate-pulse'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {action.status}
                          </span>
                          {action.pid && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-700/60 text-[10px] text-slate-300 font-mono">
                              PID: {action.pid}
                            </span>
                          )}
                          {action.taskId && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-700/60 text-[10px] text-slate-400 font-mono">
                              {action.taskId}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 mt-1">{action.description}</p>
                        {action.error && (
                          <p className="text-rose-400 mt-1 text-[11px] font-mono">{action.error}</p>
                        )}
                        {action.result && (
                          <div className="text-emerald-400/90 mt-1 text-[11px] font-mono break-all max-h-24 overflow-y-auto">
                            {typeof action.result === 'object'
                              ? JSON.stringify(action.result, null, 1)
                              : String(action.result)}
                          </div>
                        )}
                      </div>

                      {(action.status === 'executing' || action.status === 'pending_confirmation') && (
                        <button
                          onClick={() => onCancelAction(action.id)}
                          className="px-2 py-1 rounded bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 text-xs transition-colors shrink-0"
                          title="Cancel Task"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Install & Setup Tab */}
            {activeTab === 'setup' && (
              <div className="space-y-4 text-xs leading-relaxed text-slate-300">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
                  <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Run the Windows Local Agent</span>
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Download and extract the <code className="text-slate-300">windows-agent</code> folder onto your Windows PC, then run the launcher:
                  </p>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800">
                    <span>cd windows-agent && start_agent.bat</span>
                    <button
                      onClick={copySetupCommand}
                      className="p-1 rounded text-slate-400 hover:text-slate-200"
                      title="Copy command"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Download Individual Files */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Download Agent Files
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: 'start_agent.bat', label: 'Launcher (.bat)' },
                      { name: 'agent.py', label: 'FastAPI Agent (.py)' },
                      { name: 'requirements.txt', label: 'Dependencies' },
                      { name: 'config.example.json', label: 'Config Example' },
                      { name: 'README.md', label: 'Documentation' },
                    ].map((f) => (
                      <button
                        key={f.name}
                        onClick={() => downloadFile(f.name)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-left transition-colors flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-mono text-slate-200 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-500">{f.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mixed Content / Preview Note */}
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-slate-300 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-amber-300">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Hosted Cloud Preview vs Local Machine</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Browsers block remote HTTPS web pages from sending direct requests to your local computer's <code className="text-slate-200 font-mono">http://127.0.0.1</code>. To test end-to-end automation with your PC, clone/download the project and run <code className="text-slate-200 font-mono">npm run dev</code> locally on your Windows machine!
                  </p>
                </div>
              </div>
            )}

            {/* Config & Settings Tab */}
            {activeTab === 'config' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Local Agent URL</label>
                  <input
                    type="text"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="http://127.0.0.1:41199"
                  />
                  <p className="text-slate-500 text-[11px] mt-1">Default is http://127.0.0.1:41199 (localhost loopback only).</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Authentication Token</label>
                  <input
                    type="password"
                    value={localToken}
                    onChange={(e) => setLocalToken(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="myraa-secure-local-token"
                  />
                  <p className="text-slate-500 text-[11px] mt-1">
                    Must match <code className="text-slate-400">auth_token</code> configured in <code className="text-slate-400">config.json</code>.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                  >
                    Save Settings
                  </button>
                  {saveSuccess && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Saved successfully
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                config.isConnected ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span>{config.isConnected ? 'Agent Online' : 'Agent Offline'}</span>
          </div>

          <button
            onClick={onResumeAutomation}
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Reset Stop State
          </button>
        </div>
      </div>
    </div>
  );
};
