import json
import os
from flask import Flask, render_template_string
import datetime

app = Flask(__name__)

# The status file is expected in the root directory
STATUS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'bot_status.json')

TEMPLATE = """
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Trading Bot Dashboard</title>
    <style>
      :root {
        --dark-bg: #1a1a1b;
        --container-bg: #272729;
        --border-color: #343536;
        --text-color: #d7dadc;
        --text-color-header: #ffffff;
        --green: #28a745;
        --red: #dc3545;
        --yellow: #ffc107;
        --grey: #818384;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        background-color: var(--dark-bg);
        color: var(--text-color);
        line-height: 1.6;
      }

      .container {
        max-width: 960px;
        margin: 40px auto;
        padding: 20px;
      }

      header {
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 20px;
        margin-bottom: 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      h1 {
        color: var(--text-color-header);
        margin: 0;
        font-size: 2em;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.9em;
      }

      .status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: var(--red);
      }

      .status-dot.live {
        background-color: var(--green);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(40, 167, 69, 0); }
        100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
      }

      .card {
        background-color: var(--container-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }

      .card h2 {
        color: var(--text-color-header);
        margin-top: 0;
        font-size: 1.5em;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 15px;
        margin-bottom: 20px;
      }

      .signal {
        text-align: center;
        padding: 40px 20px;
        border-radius: 6px;
        font-size: 2.5em;
        font-weight: bold;
        text-transform: uppercase;
      }

      .signal.buy { background-color: var(--green); color: white; }
      .signal.sell { background-color: var(--red); color: white; }
      .signal.hold { background-color: var(--grey); color: var(--text-color-header); }

      .metrics {
        display: flex;
        justify-content: space-around;
        text-align: center;
      }

      .metric span {
        display: block;
        font-size: 0.9em;
        color: var(--grey);
        margin-bottom: 5px;
      }

      .metric p {
        font-size: 1.8em;
        color: var(--text-color-header);
        margin: 0;
      }

      .balances-list {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 200px;
        overflow-y: auto;
      }

      .balances-list li {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-color);
      }

      .balances-list li:last-child {
        border-bottom: none;
      }

      .balances-list span {
        font-weight: bold;
        color: var(--text-color-header);
      }

      .error {
        color: var(--red);
        background-color: rgba(220, 53, 69, 0.1);
        border: 1px solid var(--red);
        padding: 15px;
        border-radius: 6px;
      }

    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Trading Bot Dashboard</h1>
        <div class="status-indicator">
          {% if status and not status.error %}
            <div class="status-dot live"></div>
            <span>Live</span>
          {% else %}
            <div class="status-dot"></div>
            <span>Offline / Fehler</span>
          {% endif %}
        </div>
      </header>

      {% if not status %}
        <div class="card error">Could not load bot status. Is the bot running?</div>
      {% elif status.error %}
        <div class="card error"><strong>Error:</strong> {{ status.error }}</div>
      {% else %}
        <div class="grid">
          <div class="card">
            <h2>Signal: {{ status.symbol }}</h2>
            {% set signal_class = status.signal|default('hold') %}
            <div class="signal {{ signal_class }}">{{ signal_class }}</div>
          </div>

          <div class="card">
            <h2>Market Indicators</h2>
            <div class="metrics">
              <div class="metric">
                <span>Short SMA ({{ status.short_window }})</span>
                <p>{{ "%.2f"|format(status.short_sma) if status.short_sma else 'N/A' }}</p>
              </div>
              <div class="metric">
                <span>Long SMA ({{ status.long_window }})</span>
                <p>{{ "%.2f"|format(status.long_sma) if status.long_sma else 'N/A' }}</p>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>Account Balances</h2>
            <ul class="balances-list">
              {% for balance in status.balances %}
                <li>{{ balance.asset }} <span>{{ "%.8f"|format(balance.free|float) }}</span></li>
              {% else %}
                <li>No balances found.</li>
              {% endfor %}
            </ul>
          </div>
        </div>
        <p style="text-align: center; color: var(--grey); margin-top: 30px;">
          Last updated: {{ status.get('timestamp') | format_timestamp }}
        </p>
      {% endif %}
    </div>
  </body>
</html>
"""

@app.template_filter('format_timestamp')
def format_timestamp(ts):
    if not ts:
        return "N/A"
    return datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')

@app.route('/')
def dashboard():
    status_data = {}
    try:
        if os.path.exists(STATUS_FILE):
            with open(STATUS_FILE, 'r') as f:
                status_data = json.load(f)
    except Exception as e:
        status_data = {'error': f"Failed to read status file: {e}"}

    return render_template_string(TEMPLATE, status=status_data)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
