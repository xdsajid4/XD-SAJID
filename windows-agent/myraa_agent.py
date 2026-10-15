"""
Myraa Windows Automation Local Agent Entry Wrapper
Redirects to the FastAPI agent in agent.py
"""
import sys
import os

try:
    from agent import main
    if __name__ == "__main__":
        main()
except Exception as e:
    import subprocess
    script_dir = os.path.dirname(os.path.abspath(__file__))
    agent_path = os.path.join(script_dir, "agent.py")
    subprocess.run([sys.executable, agent_path])
