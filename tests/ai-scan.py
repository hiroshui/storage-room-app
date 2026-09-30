#!/usr/bin/env python3
import base64
import json
import threading
import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app

class MockHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        assert self.path == '/responses'
        size = int(self.headers['Content-Length'])
        payload = json.loads(self.rfile.read(size))
        assert payload['store'] is False
        assert payload['text']['format']['type'] == 'json_schema'
        user = payload['input'][1]['content']
        assert any(part['type'] == 'input_image' for part in user)
        result = {
            'summary': 'Detected two useful objects.',
            'items': [
                {'name':'Drill','quantity':1,'category':'Tools','shelf_name':'Shelf 2','confidence':0.96,'notes':''},
                {'name':'Gloves','quantity':2,'category':'Safety','shelf_name':'Shelf 1','confidence':0.88,'notes':''},
            ],
        }
        response = {
            'output': [{'type':'message','content':[{'type':'output_text','text':json.dumps(result)}]}],
            'usage': {'input_tokens': 123, 'output_tokens': 42},
        }
        raw = json.dumps(response).encode()
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def log_message(self, *args):
        pass

server = HTTPServer(('127.0.0.1',0), MockHandler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    app.OPENAI_API_KEY = 'test-key'
    app.OPENAI_BASE_URL = f'http://127.0.0.1:{server.server_port}'
    app.OPENAI_MODEL = 'test-model'
    image = 'data:image/jpeg;base64,' + base64.b64encode(b'fake-jpeg').decode()
    result, usage = app.call_openai_scan(image, 'test prompt', ['Shelf 1','Shelf 2'])
    assert result['items'][0]['name'] == 'Drill'
    assert usage['input_tokens'] == 123
    print('ai scan integration test: OK')
finally:
    server.shutdown()
