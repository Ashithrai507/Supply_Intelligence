"""CORS behaviour for local development (bug: frontend blocked on non-5173 port).

Vite bumps the dev-server port when 5173 is taken, so the browser can load the
app from ``http://localhost:5174`` (or a ``127.0.0.1`` origin). The backend must
echo an ``Access-Control-Allow-Origin`` for any loopback origin while running in
development, and must not open up to arbitrary remote origins.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _acao(origin: str) -> str | None:
    resp = client.get("/health", headers={"Origin": origin})
    assert resp.status_code == 200
    return resp.headers.get("access-control-allow-origin")


def test_cors_allows_vite_fallback_port() -> None:
    assert _acao("http://localhost:5174") == "http://localhost:5174"


def test_cors_allows_loopback_ip_origin() -> None:
    assert _acao("http://127.0.0.1:5173") == "http://127.0.0.1:5173"


def test_cors_still_allows_configured_origin() -> None:
    assert _acao("http://localhost:5173") == "http://localhost:5173"


def test_cors_rejects_remote_origin() -> None:
    assert _acao("https://evil.example.com") is None
