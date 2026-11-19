from xml.etree import ElementTree as ET

from fastapi.testclient import TestClient
from backend.main import create_app
from core.audio_engine.musicxml_export import export_musicxml


def test_musicxml_ties_polyphony_rests_and_escape(tmp_path):
    project = {'name': 'Música & estudo', 'bpm': 120, 'time_signature': '4/4', 'notes': [
        {'pitch': 61, 'start_sec': 1.5, 'duration_sec': 1.0},  # spans barline
        {'pitch': 64, 'start_sec': 1.5, 'duration_sec': 0.25},  # simultaneous voice
    ]}
    root = ET.parse(export_musicxml(project, tmp_path / 'score.musicxml')).getroot()
    assert root.tag == 'score-partwise'
    assert root.findtext('./work/work-title') == 'Música & estudo'
    measures = root.findall('./part/measure')
    assert len(measures) == 2
    assert measures[0].findtext('./attributes/time/beats') == '4'
    assert measures[0].find('./direction/sound').get('tempo') == '120.0'
    assert measures[0].find('./note/pitch/alter').text == '1'
    assert len(measures[0].findall('./backup')) == 1
    assert measures[0].find('./note/tie').get('type') == 'start'
    assert measures[1].find('./note/tie').get('type') == 'stop'
    for m in measures:
        for voice in ('1', '2'):
            assert sum(int(n.findtext('duration')) for n in m.findall('note') if n.findtext('voice') == voice) == 1920


def test_musicxml_empty_invalid_and_limit(tmp_path):
    root = ET.parse(export_musicxml({'notes': [], 'time_signature': 'bad'}, tmp_path / 'empty.xml')).getroot()
    assert root.find('./part/measure/note/rest') is not None
    import pytest
    with pytest.raises(ValueError, match='longa'):
        export_musicxml({'notes': [{'pitch': 60, 'start_sec': 1000000, 'duration_sec': 1}]}, tmp_path / 'long.xml')


def test_musicxml_export_endpoint(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        project = client.get('/api/projects').json()['projects'][0]
        response = client.post(f"/api/projects/{project['id']}/export", json={'format': 'musicxml'})
        assert response.status_code == 200
        assert response.headers['content-type'].startswith('application/vnd.recordare.musicxml+xml')
        assert ET.fromstring(response.content).tag == 'score-partwise'
