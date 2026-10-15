# Myraa Windows Automation Local Agent

A secure, authenticated, lightweight local bridge connecting **Myraa Living AI Companion** to your Windows desktop environment.

Built with **FastAPI** and **Python Standard Library (Zero Dependencies)**, strictly bound to `127.0.0.1:41199`.

---

## 🇧🇩 লোকালহোস্ট সমস্যা ও সমাধান (Localhost Offline Fix)

যদি Myraa অ্যাপে **"Local Agent Offline"** দেখায়:
1. **তৎক্ষণাৎ সমাধান:** Myraa অ্যাপের উইন্ডোজ অটোমেশন প্যানেল থেকে **"Auto-Fix / ঠিক করুন"** বাটনে ক্লিক করুন। Myraa-এর বিল্ট-ইন ডেস্কটপ ব্রিজ তৎক্ষণাৎ সক্রিয় হয়ে উঠবে এবং Chrome, Calculator, Notepad ও ফাইল তৈরি স্বাভাবিকভাবে কাজ করবে।
2. **বাস্তব উইন্ডোজ পিসি সংযোগ:**
   - এই `windows-agent` ফোল্ডারটি আপনার উইন্ডোজ কম্পিউটারে রাখুন।
   - **`start_agent.bat`** ফাইলে ডাবল-ক্লিক করুন। (এটি পাইথন থাকলে সরাসরি এজেন্ট চালু করে দেবে, কোনো কঠিন কনফিগারেশন দরকার নেই!)
   - অ্যাপে এসে "Auto-Fix / Verify Status" বাটনে ক্লিক করলেই সবুজ বাতি জ্বলবে এবং এটি সংযুক্ত হবে।

---

## 🚀 Quick Start (Windows)

### Option 1: One-Click Launch (Recommended)
1. Double-click **`start_agent.bat`**.
2. The batch script automatically:
   - Detects Python 3
   - Creates an isolated virtual environment (`venv`)
   - Installs `requirements.txt`
   - Generates your secure configuration file `config.json` with a unique token
   - Starts the agent on `http://127.0.0.1:41199`

### Option 2: Manual Setup
```cmd
cd windows-agent
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python agent.py
```

When started, your terminal displays your active **Authentication Token** and status.

---

## 🔒 Security Architecture

| Security Guarantee | Implementation Detail |
|---|---|
| **Loopback Only** | Binds strictly to `127.0.0.1`. Never listens on public interfaces or `0.0.0.0`. |
| **Token Authentication** | Every request requires `X-Agent-Token: <token>` or `Authorization: Bearer <token>`. Unauthorized requests are rejected with HTTP 401. |
| **Strict Application Allowlist** | Only approved executables (`chrome.exe`, `calc.exe`, `notepad.exe`, `code.exe`, `explorer.exe`, `msedge.exe`) can be launched. Arbitrary shell execution (`cmd.exe`, `powershell.exe`, string eval) is strictly forbidden. |
| **Safe Subprocess Spawning** | Launched via `subprocess.Popen(args, shell=False)` with argument sanitation. |
| **Path Traversal Protection** | File operations are strictly locked to approved directories (`Documents`, `Downloads`, `Desktop`, `C:\MyraaWorkspace`). Any path containing `..` or pointing outside these boundaries returns HTTP 403. |
| **Emergency Stop** | Instant termination endpoint `/emergency-stop` terminates all active subprocesses tracked by the agent. |

---

## 🛠️ Supported Capabilities & Endpoints

### 1. HealthCheck
- **Method:** `GET /health` or `GET /status`
- **Header:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "status": "online",
    "version": "2.0.0",
    "platform": "win32",
    "active_tasks": 0,
    "allowed_apps": ["chrome", "notepad", "calculator", "calc", "explorer", "vscode", "edge"],
    "allowed_directories": ["C:\\Users\\...\\Documents", "C:\\Users\\...\\Desktop", "..."]
  }
  ```

### 2. Open Website
- **Method:** `POST /open-website`
- **Body:**
  ```json
  { "url": "https://www.google.com" }
  ```
- Opens the URL in the system default browser.

### 3. Open Application
- **Method:** `POST /open-application`
- **Body:**
  ```json
  { "app_name": "chrome" }
  ```
- Launches the verified executable without a shell. Returns process PID and `task_id`.

### 4. List Approved Files
- **Method:** `POST /list-files`
- **Body:**
  ```json
  { "directory": "C:\\Users\\YourUser\\Documents", "recursive": false }
  ```
- Rejects unapproved directories with HTTP 403.

### 5. Search Approved Files
- **Method:** `POST /search-files`
- **Body:**
  ```json
  { "query": "project", "directory": null }
  ```
- Scans user-approved folders for matching filenames.

### 6. Create Text File
- **Method:** `POST /create-file`
- **Body:**
  ```json
  { "filename": "reminder.txt", "content": "Buy groceries", "directory": null }
  ```
- Creates the file in an approved directory (1MB max size limit).

### 7. Get Task Status
- **Method:** `GET /task-status/{task_id}`
- Returns PID, run state (`running`, `completed`, `cancelled`), and timestamps.

### 8. Cancel Task
- **Method:** `POST /cancel-task`
- **Body:**
  ```json
  { "task_id": "task-app-12345678" }
  ```
- Safely terminates the subprocess.

### 9. Emergency Stop
- **Method:** `POST /emergency-stop`
- Instantly halts all running tasks spawned by Myraa.

---

## 🌐 Network & Mixed-Content Note

When using Myraa in a **hosted cloud preview** over HTTPS (`https://ais-dev-...`):
- Modern web browsers enforce **Private Network Access (PNA)** and block HTTPS websites from sending direct asynchronous requests to `http://127.0.0.1` unless running on localhost.
- **For full local PC automation:**
  1. Clone/download the project and run Myraa locally:
     ```cmd
     npm install
     npm run dev
     ```
  2. The local web app (`http://localhost:3000`) and the local Express server can connect seamlessly to `http://127.0.0.1:41199`.
  3. When running in hosted cloud preview, Myraa displays a clear connection status and instructions rather than failing silently.
