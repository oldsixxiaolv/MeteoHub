#!/usr/bin/env python3
"""
MeteoHub Python 代码运行平台后端
提供代码执行和超级用户管理功能
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import subprocess
import json
import os
import sys
import tempfile
import time
from threading import Lock

app = Flask(__name__)
CORS(app)

# 存储用户代码执行历史（内存存储，重启清空）
code_history = []
history_lock = Lock()

# 活跃用户追踪（用于统计）
active_users = {}
users_lock = Lock()

# 代码运行计数（持久化到文件）
CODE_RUNS_FILE = '/tmp/meteohub_code_runs.txt'

def get_total_code_runs():
    """获取总代码运行次数"""
    try:
        with open(CODE_RUNS_FILE, 'r') as f:
            return int(f.read().strip())
    except:
        return 0

def increment_code_runs():
    """增加代码运行计数"""
    count = get_total_code_runs() + 1
    try:
        with open(CODE_RUNS_FILE, 'w') as f:
            f.write(str(count))
    except:
        pass
    return count


@app.route('/')
def index():
    """提供主页"""
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    """提供静态文件"""
    return send_from_directory('.', path)


@app.route('/api/run-code', methods=['POST'])
def run_code():
    """
    执行 Python 代码
    接收: { "code": "print('hello')" }
    返回: { "output": "...", "error": "...", "execution_time": 0.5 }
    """
    data = request.get_json()
    if not data or 'code' not in data:
        return jsonify({"error": "没有提供代码"}), 400
    
    code = data['code']
    
    # 安全检查 - 禁止危险操作
    forbidden_keywords = [
        'import os', 'import sys', 'import subprocess',
        '__import__', 'eval(', 'exec(', 'compile(',
        'open(', 'file(', 'read(', 'write(',
        'delete', 'remove', 'rmdir', 'system',
        'socket', 'http', 'ftp', 'requests'
    ]
    
    for keyword in forbidden_keywords:
        if keyword in code.lower():
            return jsonify({
                "error": f"安全警告：代码包含禁止的关键词 '{keyword}'",
                "output": "",
                "execution_time": 0
            }), 403
    
    # 创建临时文件执行代码
    start_time = time.time()
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        # 使用系统 Python 执行代码
        result = subprocess.run(
            [sys.executable, temp_file],
            capture_output=True,
            text=True,
            timeout=10,  # 10秒超时
            cwd='/tmp'
        )
        
        execution_time = time.time() - start_time
        
        # 增加运行计数
        increment_code_runs()
        
        # 保存到历史记录
        with history_lock:
            code_history.append({
                'timestamp': time.time(),
                'code': code[:500],  # 只保存前500字符
                'output': result.stdout[:1000] if result.stdout else '',
                'error': result.stderr[:500] if result.stderr else '',
                'execution_time': execution_time
            })
            # 只保留最近100条
            if len(code_history) > 100:
                code_history.pop(0)
        
        return jsonify({
            "output": result.stdout,
            "error": result.stderr,
            "execution_time": round(execution_time, 3)
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "代码执行超时（限制10秒）",
            "output": "",
            "execution_time": 10
        }), 408
        
    except Exception as e:
        return jsonify({
            "error": f"执行错误: {str(e)}",
            "output": "",
            "execution_time": 0
        }), 500
        
    finally:
        # 清理临时文件
        try:
            if os.path.exists(temp_file):
                os.unlink(temp_file)
        except:
            pass


@app.route('/api/code-history', methods=['GET'])
def get_code_history():
    """获取代码执行历史（用于超级用户管理）"""
    auth = request.headers.get('Authorization')
    if auth != 'Bearer Lyh200411':
        return jsonify({"error": "未授权"}), 401
    
    with history_lock:
        return jsonify({
            "history": list(reversed(code_history)),
            "total": len(code_history)
        })


@app.route('/api/code-runs', methods=['GET'])
def get_code_runs_api():
    """获取代码运行次数"""
    return jsonify({"count": get_total_code_runs()})

@app.route('/api/admin/clear-history', methods=['POST'])
def clear_history():
    """清空代码执行历史"""
    auth = request.headers.get('Authorization')
    if auth != 'Bearer Lyh200411':
        return jsonify({"error": "未授权"}), 401
    
    with history_lock:
        code_history.clear()
    
    return jsonify({"message": "历史记录已清空"})


@app.route('/api/admin/stats', methods=['GET'])
def get_stats():
    """获取平台统计信息"""
    auth = request.headers.get('Authorization')
    if auth != 'Bearer Lyh200411':
        return jsonify({"error": "未授权"}), 401
    
    return jsonify({
        "total_code_runs": get_total_code_runs(),
        "python_version": sys.version,
        "platform": sys.platform,
        "timestamp": time.time()
    })


@app.route('/api/track-active', methods=['POST'])
def track_active():
    """记录用户活跃"""
    data = request.get_json() or {}
    user_id = data.get('user_id', 'anonymous')
    
    with users_lock:
        active_users[user_id] = time.time()
    
    return jsonify({"status": "ok"})


@app.route('/api/active-count', methods=['GET'])
def get_active_count():
    """获取当前活跃用户数（30秒内）"""
    now = time.time()
    timeout = 30
    
    with users_lock:
        # 清理过期用户
        expired = [uid for uid, t in active_users.items() if now - t > timeout]
        for uid in expired:
            del active_users[uid]
        
        return jsonify({
            "active_count": len(active_users),
            "users": list(active_users.keys())
        })


if __name__ == '__main__':
    print(f"🚀 MeteoHub Server Starting...")
    print(f"   Python: {sys.version}")
    print(f"   URL: http://localhost:8080")
    print(f"   Code Platform: http://localhost:8080/#code")
    print()
    
    # 生产模式运行（端口8080）
    app.run(host='0.0.0.0', port=8080, debug=False)
