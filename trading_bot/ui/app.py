import json
import os
from flask import Flask, render_template_string

app = Flask(__name__)

# The status file is expected in the root directory
STATUS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'bot_status.json')

TEMPLATE = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Trading Bot Dashboard</title>
    <style>
      body { font-family: sans-serif; margin: 2em; background-color: #f8f9fa; }
      h1, h2 { color: #343a40; }
      .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .info { background-color: #e9ecef; padding: 15px; border-radius: 4px; margin-bottom: 1em; }
      .signal { padding: 15px; border-radius: 4px; text-align: center; font-size: 1.5em; font-weight: bold; }
      .signal.buy { background-color: #28a745; color: white; }
      .signal.sell { background-color: #dc3545; color: white; }
      .signal.hold { background-color: #ffc107; color: black; }
      .error { color: #dc3545; }
      ul { list-style-type: none; padding: 0; }
      li { margin-bottom: 0.5em; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Trading Bot Status</h1>

      {% if status.error %}
        <p class="error"><strong>Error:</strong> {{ status.error }}</p>
      {% endif %}

      {% if not status %}
        <p class="error">Could not load bot status. Is the bot running?</p>
      {% else %}
        <h2>Account Balances</h2>
        <div class="info">
          <ul>
          {% for balance in status.balances %}
            <li><strong>{{ balance.asset }}:</strong> {{ balance.free }}</li>
          {% else %}
            <li>No balances with funds found.</li>
          {% endfor %}
          </ul>
        </div>

        <h2>Trading Signal for {{ status.symbol }}</h2>
        <div class="info">
          <p><strong>Strategy:</strong> SMA Crossover ({{ status.short_window }}/{{ status.long_window }})</p>
          <p><strong>Short SMA:</strong> {{ "%.2f"|format(status.short_sma) if status.short_sma else 'N/A' }}</p>
          <p><strong>Long SMA:</strong> {{ "%.2f"|format(status.long_sma) if status.long_sma else 'N/A' }}</p>
        </div>

        {% set signal_class = status.signal|default('hold') %}
        <div class="signal {{ signal_class }}">{{ signal_class.upper() }}</div>
      {% endif %}
    </div>
  </body>
</html>
"""

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
