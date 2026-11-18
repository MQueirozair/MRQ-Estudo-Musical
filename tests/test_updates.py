import io
import json
from fastapi.testclient import TestClient
from backend.main import create_app


def test_update_comparison_and_offline(tmp_path, monkeypatch):
    app = create_app(tmp_path)
    client = TestClient(app)
    def release(tag):
        return io.BytesIO(json.dumps({'tag_name': tag, 'html_url': 'https://github.com/MQueirozair/MRQ-Estudo-Musical/releases'}).encode())
    monkeypatch.setattr('backend.main.urllib.request.urlopen', lambda *a, **kw: release('v1.0.1'))
    assert client.get('/api/updates/check').json()['update_available'] is True
    monkeypatch.setattr('backend.main.urllib.request.urlopen', lambda *a, **kw: release('v0.9.0'))
    assert client.get('/api/updates/check').json()['update_available'] is False
    monkeypatch.setattr('backend.main.urllib.request.urlopen', lambda *a, **kw: release('not-a-version'))
    assert 'comparar' in client.get('/api/updates/check').json()['message']
    def offline(*args, **kwargs):
        raise OSError('offline')
    monkeypatch.setattr('backend.main.urllib.request.urlopen', offline)
    assert client.get('/api/updates/check').json()['online'] is False
