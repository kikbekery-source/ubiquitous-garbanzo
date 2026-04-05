"""
Scheduler - Daily email processing and Telegram summary.
"""

import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
LOG_FILE = os.path.join(DATA_DIR, "scheduler_log.json")


def _load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def _log_run(status, details=""):
    os.makedirs(DATA_DIR, exist_ok=True)
    logs = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            logs = json.load(f)
    logs.append({
        "timestamp": datetime.now().isoformat(),
        "status": status,
        "details": details,
    })
    logs = logs[-50:]  # Keep last 50 logs
    with open(LOG_FILE, "w") as f:
        json.dump(logs, f, indent=2, ensure_ascii=False)


def run_daily_job():
    """Execute the daily email processing job."""
    from email_manager import load_accounts, fetch_emails
    from ai_assistant import analyze_emails, generate_daily_summary
    from telegram_bot import send_daily_summary

    config = _load_config()
    gemini_key = config.get("gemini_api_key")

    if not gemini_key:
        _log_run("error", "Gemini API key not configured")
        return False, "Gemini API key not configured"

    accounts = load_accounts()
    if not accounts:
        _log_run("error", "No email accounts configured")
        return False, "No email accounts configured"

    all_emails = []
    errors = []

    for account in accounts:
        try:
            emails = fetch_emails(
                provider=account["provider"],
                email_addr=account["email"],
                password=account["password"],
                since_days=1,
            )
            all_emails.extend(emails)
        except Exception as e:
            errors.append(f"{account['email']}: {str(e)}")

    if not all_emails and errors:
        _log_run("error", f"Failed to fetch emails: {'; '.join(errors)}")
        return False, f"Failed to fetch emails: {'; '.join(errors)}"

    # Analyze with Gemini
    try:
        analysis = analyze_emails(gemini_key, all_emails)
    except Exception as e:
        _log_run("error", f"Analysis failed: {str(e)}")
        return False, f"Analysis failed: {str(e)}"

    # Generate and send Telegram summary
    try:
        summary = generate_daily_summary(gemini_key, analysis)
        success, msg = send_daily_summary(summary)
        if success:
            _log_run("success", f"Processed {len(all_emails)} emails, summary sent via Telegram")
        else:
            _log_run("warning", f"Processed {len(all_emails)} emails, but Telegram failed: {msg}")
    except Exception as e:
        _log_run("warning", f"Processed {len(all_emails)} emails, Telegram error: {str(e)}")

    # Save last analysis result
    try:
        result_file = os.path.join(DATA_DIR, "last_analysis.json")
        with open(result_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "analysis": analysis,
                "email_count": len(all_emails),
                "errors": errors,
            }, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    _log_run("success", f"Completed: {len(all_emails)} emails processed")
    return True, analysis


def get_scheduler_logs():
    """Return scheduler run logs."""
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            return json.load(f)
    return []
