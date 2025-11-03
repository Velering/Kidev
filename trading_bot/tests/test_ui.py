import sys
import os
import pytest

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from trading_bot.ui.app import app as flask_app

@pytest.fixture
def app():
    yield flask_app

@pytest.fixture
def client(app):
    return app.test_client()

def test_dashboard_loads(client):
    """Test if the dashboard page loads successfully."""
    response = client.get('/')
    assert response.status_code == 200
    assert b"Trading Bot Dashboard" in response.data
