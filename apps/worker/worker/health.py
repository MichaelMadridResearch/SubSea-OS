from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import redis


def redis_ready(url: str) -> bool:
    try:
        client = redis.Redis.from_url(url, socket_connect_timeout=2)
        return bool(client.ping())
    except redis.RedisError:
        return False


def make_handler(redis_url: str):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/health/live":
                body = b'{"status":"live"}'
                status = 200
            elif self.path == "/health/ready":
                if redis_ready(redis_url):
                    body = b'{"status":"ready","redis":"ok"}'
                    status = 200
                else:
                    body = b'{"status":"not-ready","redis":"down"}'
                    status = 503
            else:
                body = b'{"detail":"not found"}'
                status = 404
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, template: str, *args) -> None:
            return

    return Handler


def serve(redis_url: str, port: int = 8001) -> None:
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(redis_url))
    server.serve_forever()
