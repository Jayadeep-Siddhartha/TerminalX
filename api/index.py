from flask import Flask, request, jsonify
import subprocess
import os
import glob
import platform

app = Flask(__name__)

WINDOWS = platform.system() == "Windows"

def normalize_cwd(cwd: str) -> str:
    """Expand ~ and normalize paths for cross-platform support."""
    if cwd.startswith('~'):
        cwd = os.path.expanduser(cwd)
    return os.path.normpath(cwd)

def map_command(cmd: str, cwd: str):
    """Map common Linux commands to Python equivalents."""
    cmd = cmd.strip()
    if cmd == "pwd":
        return cwd + "\n", ""
    if cmd == "ls":
        try:
            files = os.listdir(cwd)
            return "\n".join(files) + "\n", ""
        except Exception as e:
            return "", str(e)
    if cmd.startswith("echo "):
        return cmd[5:] + "\n", ""
    return None, None

def run_command(cmd: str, cwd: str) -> subprocess.CompletedProcess:
    """Run the command using subprocess."""
    return subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10
    )

# --- /api/execute route ---
@app.route('/api/execute', methods=['POST'])
def execute_command():
    data = request.get_json()
    command = data.get('command')
    cwd = normalize_cwd(data.get('cwd', os.path.expanduser('~')))

    if not command:
        return jsonify({'output': '', 'error': 'No command provided'}), 400

    try:
        if command.strip().startswith('cd '):
            new_dir_path = command.strip().split(' ', 1)[1]
            if new_dir_path.startswith('~'):
                new_dir_path = os.path.expanduser(new_dir_path)
            if not os.path.isabs(new_dir_path):
                new_dir_path = os.path.join(cwd, new_dir_path)
            if os.path.isdir(new_dir_path):
                new_cwd = os.path.normpath(new_dir_path)
                return jsonify({'output': '', 'error': '', 'new_cwd': new_cwd})
            else:
                error_msg = f"cd: no such file or directory: {new_dir_path}"
                return jsonify({'output': '', 'error': error_msg, 'new_cwd': cwd})

        output, error = map_command(command, cwd)
        if output is not None:
            return jsonify({'output': output, 'error': error, 'new_cwd': cwd})

        result = run_command(command, cwd)
        return jsonify({'output': result.stdout, 'error': result.stderr, 'new_cwd': cwd})

    except subprocess.TimeoutExpired:
        return jsonify({'output': '', 'error': 'Command timed out', 'new_cwd': cwd}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'output': '', 'error': str(e), 'new_cwd': cwd}), 500

# --- /api/autocomplete route ---
@app.route('/api/autocomplete', methods=['POST'])
def autocomplete():
    data = request.get_json()
    text = data.get('text', '')
    cwd = normalize_cwd(data.get('cwd', os.path.expanduser('~')))

    if not text:
        return jsonify([])

    path_to_complete = text.split(' ')[-1]
    if not path_to_complete.startswith('~') and not os.path.isabs(path_to_complete):
        search_path = os.path.join(cwd, path_to_complete)
    else:
        search_path = os.path.expanduser(path_to_complete)

    matches = glob.glob(search_path + '*')
    suggestions = [os.path.basename(match) for match in matches]

    for i, s in enumerate(suggestions):
        full_path = os.path.join(os.path.dirname(search_path), s)
        if os.path.isdir(full_path):
            suggestions[i] = s + '/'

    return jsonify(suggestions)

# --- Run app ---
if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5353))  # Use Render's port or default 5353
    app.run(host="0.0.0.0", port=port)
