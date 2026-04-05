"""
Telegram Bot - Send daily email summaries via Telegram.
"""

import json
import os
import urllib.request
import urllib.parse

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")


def _load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_config(config):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def send_telegram_message(bot_token, chat_id, message):
    """Send a message via Telegram Bot API."""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
    }).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            if result.get("ok"):
                return True, "Message sent successfully"
            else:
                return False, f"Telegram API error: {result.get('description', 'Unknown error')}"
    except Exception as e:
        return False, f"Failed to send message: {str(e)}"


def send_daily_summary(summary_text):
    """Send daily summary using saved config."""
    config = _load_config()
    bot_token = config.get("telegram_bot_token")
    chat_id = config.get("telegram_chat_id")

    if not bot_token or not chat_id:
        return False, "Telegram not configured. Please set bot token and chat ID."

    # Telegram has a 4096 character limit per message
    if len(summary_text) > 4000:
        # Split into multiple messages
        parts = []
        while summary_text:
            if len(summary_text) <= 4000:
                parts.append(summary_text)
                break
            split_idx = summary_text.rfind("\n", 0, 4000)
            if split_idx == -1:
                split_idx = 4000
            parts.append(summary_text[:split_idx])
            summary_text = summary_text[split_idx:].lstrip()

        for part in parts:
            success, msg = send_telegram_message(bot_token, chat_id, part)
            if not success:
                return False, msg
        return True, f"Sent {len(parts)} messages"

    return send_telegram_message(bot_token, chat_id, summary_text)


def test_telegram(bot_token, chat_id):
    """Test Telegram connection by sending a test message."""
    return send_telegram_message(
        bot_token, chat_id,
        "✅ Email Assistant connected successfully!\n"
        "คุณจะได้รับสรุปอีเมลประจำวันที่นี่"
    )


def save_telegram_config(bot_token, chat_id):
    """Save Telegram configuration."""
    config = _load_config()
    config["telegram_bot_token"] = bot_token
    config["telegram_chat_id"] = chat_id
    _save_config(config)
    return True
