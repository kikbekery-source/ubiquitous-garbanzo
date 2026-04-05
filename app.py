"""
Email Checker App - Main Flask Application
Personal AI-powered email assistant with Gemini integration.
"""

import json
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify

from email_manager import (
    test_connection, fetch_emails, delete_emails,
    load_accounts, save_accounts,
)
from ai_assistant import (
    analyze_emails, generate_daily_summary,
    get_memory, update_owner_info, reset_memory,
)
from telegram_bot import (
    send_daily_summary, test_telegram, save_telegram_config,
)
from scheduler import run_daily_job, get_scheduler_logs

app = Flask(__name__)

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


# ─── Pages ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─── Account Management ───────────────────────────────

@app.route("/api/accounts", methods=["GET"])
def get_accounts():
    accounts = load_accounts()
    # Don't expose passwords in response
    safe = [{"email": a["email"], "provider": a["provider"]} for a in accounts]
    return jsonify(safe)


@app.route("/api/accounts", methods=["POST"])
def add_account():
    data = request.json
    email_addr = data.get("email", "").strip()
    password = data.get("password", "").strip()
    provider = data.get("provider", "").strip().lower()

    if not all([email_addr, password, provider]):
        return jsonify({"error": "All fields are required"}), 400

    # Test connection first
    success, msg = test_connection(provider, email_addr, password)
    if not success:
        return jsonify({"error": msg}), 401

    accounts = load_accounts()
    # Check if already exists
    for acc in accounts:
        if acc["email"] == email_addr:
            return jsonify({"error": "Account already exists"}), 409

    accounts.append({
        "email": email_addr,
        "password": password,
        "provider": provider,
        "added_at": datetime.now().isoformat(),
    })
    save_accounts(accounts)
    return jsonify({"message": "Account added successfully", "email": email_addr})


@app.route("/api/accounts/<email_addr>", methods=["DELETE"])
def remove_account(email_addr):
    accounts = load_accounts()
    accounts = [a for a in accounts if a["email"] != email_addr]
    save_accounts(accounts)
    return jsonify({"message": "Account removed"})


# ─── Email Operations ─────────────────────────────────

@app.route("/api/emails/fetch", methods=["POST"])
def fetch_all_emails():
    data = request.json or {}
    since_days = data.get("since_days", 1)

    accounts = load_accounts()
    if not accounts:
        return jsonify({"error": "No email accounts configured"}), 400

    all_emails = []
    errors = []

    for account in accounts:
        try:
            emails = fetch_emails(
                provider=account["provider"],
                email_addr=account["email"],
                password=account["password"],
                since_days=since_days,
            )
            all_emails.extend(emails)
        except Exception as e:
            errors.append({"account": account["email"], "error": str(e)})

    return jsonify({
        "emails": all_emails,
        "count": len(all_emails),
        "errors": errors,
    })


@app.route("/api/emails/analyze", methods=["POST"])
def analyze():
    config = _load_config()
    gemini_key = config.get("gemini_api_key")
    if not gemini_key:
        return jsonify({"error": "Gemini API key not configured"}), 400

    data = request.json or {}
    since_days = data.get("since_days", 1)

    accounts = load_accounts()
    if not accounts:
        return jsonify({"error": "No email accounts configured"}), 400

    all_emails = []
    errors = []

    for account in accounts:
        try:
            emails = fetch_emails(
                provider=account["provider"],
                email_addr=account["email"],
                password=account["password"],
                since_days=since_days,
            )
            all_emails.extend(emails)
        except Exception as e:
            errors.append({"account": account["email"], "error": str(e)})

    if not all_emails:
        return jsonify({
            "analysis": {"summary": "No emails found", "emails": []},
            "errors": errors,
        })

    analysis = analyze_emails(gemini_key, all_emails)

    # Save result
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, "last_analysis.json"), "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "analysis": analysis,
            "email_count": len(all_emails),
        }, f, indent=2, ensure_ascii=False)

    return jsonify({"analysis": analysis, "email_count": len(all_emails), "errors": errors})


@app.route("/api/emails/delete-spam", methods=["POST"])
def delete_spam():
    data = request.json or {}
    spam_list = data.get("spam", [])

    if not spam_list:
        return jsonify({"message": "No spam to delete"})

    accounts = load_accounts()
    account_map = {a["email"]: a for a in accounts}
    results = []

    for spam in spam_list:
        account_email = spam.get("account")
        email_id = spam.get("id")
        if account_email in account_map:
            acc = account_map[account_email]
            success, msg = delete_emails(
                acc["provider"], acc["email"], acc["password"], [email_id]
            )
            results.append({"account": account_email, "id": email_id, "success": success, "message": msg})

    return jsonify({"results": results})


# ─── Configuration ─────────────────────────────────────

@app.route("/api/config", methods=["GET"])
def get_config():
    config = _load_config()
    # Mask sensitive keys
    safe = {}
    if config.get("gemini_api_key"):
        key = config["gemini_api_key"]
        safe["gemini_api_key"] = key[:8] + "..." + key[-4:] if len(key) > 12 else "***"
        safe["gemini_configured"] = True
    else:
        safe["gemini_configured"] = False

    if config.get("telegram_bot_token"):
        safe["telegram_configured"] = True
        safe["telegram_chat_id"] = config.get("telegram_chat_id", "")
    else:
        safe["telegram_configured"] = False

    safe["scheduler_time"] = config.get("scheduler_time", "08:00")
    return jsonify(safe)


@app.route("/api/config", methods=["POST"])
def update_config():
    data = request.json
    config = _load_config()

    if "gemini_api_key" in data:
        config["gemini_api_key"] = data["gemini_api_key"]
    if "telegram_bot_token" in data:
        config["telegram_bot_token"] = data["telegram_bot_token"]
    if "telegram_chat_id" in data:
        config["telegram_chat_id"] = data["telegram_chat_id"]
    if "scheduler_time" in data:
        config["scheduler_time"] = data["scheduler_time"]

    _save_config(config)
    return jsonify({"message": "Configuration saved"})


@app.route("/api/config/test-telegram", methods=["POST"])
def test_telegram_connection():
    data = request.json
    bot_token = data.get("bot_token", "").strip()
    chat_id = data.get("chat_id", "").strip()

    if not bot_token or not chat_id:
        return jsonify({"error": "Bot token and chat ID required"}), 400

    success, msg = test_telegram(bot_token, chat_id)
    if success:
        save_telegram_config(bot_token, chat_id)
    return jsonify({"success": success, "message": msg})


# ─── AI Memory ─────────────────────────────────────────

@app.route("/api/memory", methods=["GET"])
def get_ai_memory():
    return jsonify(get_memory())


@app.route("/api/memory/owner", methods=["POST"])
def set_owner_info():
    data = request.json
    updated = update_owner_info(data)
    return jsonify(updated)


@app.route("/api/memory/reset", methods=["POST"])
def reset_ai_memory():
    return jsonify(reset_memory())


# ─── Scheduler / Manual Trigger ────────────────────────

@app.route("/api/run-daily", methods=["POST"])
def trigger_daily_job():
    success, result = run_daily_job()
    return jsonify({"success": success, "result": result})


@app.route("/api/scheduler-logs", methods=["GET"])
def scheduler_logs():
    return jsonify(get_scheduler_logs())


@app.route("/api/last-analysis", methods=["GET"])
def last_analysis():
    filepath = os.path.join(DATA_DIR, "last_analysis.json")
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return jsonify(json.load(f))
    return jsonify({"message": "No analysis available yet"})


# ─── Scheduler Setup ──────────────────────────────────

def setup_scheduler(app):
    """Setup APScheduler for daily email processing."""
    try:
        from flask_apscheduler import APScheduler

        class Config:
            SCHEDULER_API_ENABLED = False

        config = _load_config()
        schedule_time = config.get("scheduler_time", "08:00")
        hour, minute = schedule_time.split(":")

        app.config.from_object(Config())
        app.config["JOBS"] = [
            {
                "id": "daily_email_job",
                "func": "scheduler:run_daily_job",
                "trigger": "cron",
                "hour": int(hour),
                "minute": int(minute),
            }
        ]

        sched = APScheduler()
        sched.init_app(app)
        sched.start()
    except ImportError:
        print("flask_apscheduler not installed. Scheduler disabled.")
    except Exception as e:
        print(f"Scheduler setup error: {e}")


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    setup_scheduler(app)
    app.run(debug=True, host="0.0.0.0", port=5000)
