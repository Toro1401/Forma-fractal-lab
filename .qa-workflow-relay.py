"""Relay hidden terminal input to the Sites helper without storing credentials."""
import getpass
import os
import pathlib
import subprocess
import sys

request = getpass.getpass("Ready for Site workflow JSON on stdin (input is hidden).\n")
env = dict(os.environ, ELECTRON_RUN_AS_NODE="1")
result = subprocess.run([
    r"C:\Users\TorelliDanilo\AppData\Local\Programs\antigravity\Antigravity.exe",
    r"C:\Users\TorelliDanilo\.codex\plugins\cache\openai-curated-remote\sites\1.1.2\scripts\site-workflow.mjs",
    "--project-id", "appgprj_6ae9ecc61ec081918c579b0a23b875ca"
], input=request + "\n", text=True, encoding="utf-8", env=env,
   cwd=str(pathlib.Path(__file__).resolve().parent), capture_output=True)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)
