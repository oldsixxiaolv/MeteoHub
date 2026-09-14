"""Exercise stop's refusal without touching the real project's PID file."""
import shutil
import subprocess
import sys
from pathlib import Path


def test_stop_refuses_other_directory_relative_server(tmp_path):
    project = tmp_path / 'project'
    other = tmp_path / 'other'
    project.mkdir()
    other.mkdir()
    shutil.copy(Path(__file__).resolve().parents[1] / 'stop.sh', project / 'stop.sh')
    (other / 'server.py').write_text('import time\ntime.sleep(60)\n')
    process = subprocess.Popen([sys.executable, 'server.py'], cwd=other)
    try:
        (project / 'server.pid').write_text(str(process.pid))
        result = subprocess.run(['bash', 'stop.sh'], cwd=project, capture_output=True, text=True, timeout=10)
        assert result.returncode == 1, result.stdout + result.stderr
        assert process.poll() is None, 'Unrelated process must remain alive'
        assert '拒绝' in result.stdout
    finally:
        process.terminate()
        process.wait(timeout=5)
