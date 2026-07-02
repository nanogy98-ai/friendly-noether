import http.server
import json
import os
import urllib.parse

PORT = 8000

# Server-side persistent game state (resets only when server restarts)
game_state = {
    "board": [[0]*7 for _ in range(6)],
    "activePlayer": 1,
    "gameOver": False,
    "winner": None,
    "winningCells": [],
    "moves": [],
    "p1_name": "Red Player",
    "p2_name": "Yellow Player",
    "p1_score": 0,
    "p2_score": 0,
    "draws": 0,
    "timerSeconds": 0
}

class LANGameHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for API calls to ensure real-time polling accuracy
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/state':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(game_state).encode('utf-8'))
        else:
            # Fall back to serving index.html, style.css, app.js, pngs, etc.
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/move':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            col = data.get('col')
            row = data.get('row')
            player = data.get('player')
            
            # Record move
            game_state['board'][row][col] = player
            game_state['moves'].append({"row": row, "col": col, "player": player})
            
            # Check for win on server-side as source of truth
            win_info = self.check_win_condition(game_state['board'])
            if win_info:
                game_state['gameOver'] = True
                game_state['winner'] = win_info['player']
                game_state['winningCells'] = win_info['cells']
                
                # Increment scores
                if win_info['player'] == 1:
                    game_state['p1_score'] += 1
                else:
                    game_state['p2_score'] += 1
            elif len(game_state['moves']) == 42:
                game_state['gameOver'] = True
                game_state['draws'] += 1
            else:
                # Toggle player if game goes on
                game_state['activePlayer'] = 3 - player // 1 if player == 1 or player == 2 else 1
                game_state['activePlayer'] = 2 if player == 1 else 1

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "state": game_state}).encode('utf-8'))
            
        elif self.path == '/api/reset':
            # Restart game board, keep scores and names
            game_state['board'] = [[0]*7 for _ in range(6)]
            game_state['moves'] = []
            game_state['activePlayer'] = 1
            game_state['gameOver'] = False
            game_state['winner'] = None
            game_state['winningCells'] = []
            game_state['timerSeconds'] = 0
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "state": game_state}).encode('utf-8'))
            
        elif self.path == '/api/reset_scores':
            game_state['p1_score'] = 0
            game_state['p2_score'] = 0
            game_state['draws'] = 0
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "state": game_state}).encode('utf-8'))

        elif self.path == '/api/update_names':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            game_state['p1_name'] = data.get('p1_name', game_state['p1_name'])
            game_state['p2_name'] = data.get('p2_name', game_state['p2_name'])
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "state": game_state}).encode('utf-8'))

        elif self.path == '/api/sync_timer':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            game_state['timerSeconds'] = data.get('timerSeconds', game_state['timerSeconds'])
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def check_win_condition(self, b):
        # Horizontal Check
        for r in range(6):
            for c in range(4):
                if b[r][c] != 0 and b[r][c] == b[r][c+1] == b[r][c+2] == b[r][c+3]:
                    return {"player": b[r][c], "cells": [[r, c], [r, c+1], [r, c+2], [r, c+3]]}
        # Vertical Check
        for c in range(7):
            for r in range(3):
                if b[r][c] != 0 and b[r][c] == b[r+1][c] == b[r+2][c] == b[r+3][c]:
                    return {"player": b[r][c], "cells": [[r, c], [r+1, c], [r+2, c], [r+3, c]]}
        # Diagonal Check (descending down-right)
        for r in range(3):
            for c in range(4):
                if b[r][c] != 0 and b[r][c] == b[r+1][c+1] == b[r+2][c+2] == b[r+3][c+3]:
                    return {"player": b[r][c], "cells": [[r, c], [r+1, c+1], [r+2, c+2], [r+3, c+3]]}
        # Diagonal Check (ascending up-right)
        for r in range(3, 6):
            for c in range(4):
                if b[r][c] != 0 and b[r][c] == b[r-1][c+1] == b[r-2][c+2] == b[r-3][c+3]:
                    return {"player": b[r][c], "cells": [[r, c], [r-1, c+1], [r-2, c+2], [r-3, c+3]]}
        return None

if __name__ == '__main__':
    print(f"Starting Connect Four LAN Server on http://0.0.0.0:{PORT}...")
    server = http.server.HTTPServer(('0.0.0.0', PORT), LANGameHandler)
    server.serve_forever()
