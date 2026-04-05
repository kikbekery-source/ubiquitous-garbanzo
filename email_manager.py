"""
Email Manager - IMAP connection for Gmail, Hotmail, Outlook
Handles login, fetching, deleting, and organizing emails.
"""

import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import json
import os
from datetime import datetime, timedelta

IMAP_SERVERS = {
    "gmail": "imap.gmail.com",
    "hotmail": "imap-mail.outlook.com",
    "outlook": "imap-mail.outlook.com",
}

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def _decode_mime_words(s):
    if s is None:
        return ""
    decoded_parts = []
    for part, charset in decode_header(s):
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded_parts.append(part)
    return " ".join(decoded_parts)


def _get_email_body(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == "text/plain":
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    body = payload.decode(charset, errors="replace")
                    break
                except Exception:
                    continue
            elif content_type == "text/html" and not body:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    body = payload.decode(charset, errors="replace")
                except Exception:
                    continue
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace")
        except Exception:
            body = ""
    return body[:3000]  # Limit body size for AI processing


def get_imap_server(provider):
    provider = provider.lower().strip()
    return IMAP_SERVERS.get(provider, IMAP_SERVERS.get("outlook"))


def test_connection(provider, email_addr, password):
    """Test IMAP connection and return success/failure."""
    server = get_imap_server(provider)
    try:
        mail = imaplib.IMAP4_SSL(server, 993)
        mail.login(email_addr, password)
        mail.logout()
        return True, "Connection successful"
    except imaplib.IMAP4.error as e:
        return False, f"Login failed: {str(e)}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"


def fetch_emails(provider, email_addr, password, folder="INBOX", limit=50, since_days=1):
    """Fetch emails from the given account."""
    server = get_imap_server(provider)
    emails = []

    try:
        mail = imaplib.IMAP4_SSL(server, 993)
        mail.login(email_addr, password)
        mail.select(folder, readonly=True)

        since_date = (datetime.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
        _, message_numbers = mail.search(None, f'(SINCE "{since_date}")')

        msg_nums = message_numbers[0].split()
        if not msg_nums:
            mail.logout()
            return emails

        # Get latest emails up to limit
        msg_nums = msg_nums[-limit:]

        for num in msg_nums:
            try:
                _, msg_data = mail.fetch(num, "(RFC822)")
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                subject = _decode_mime_words(msg.get("Subject"))
                from_addr = _decode_mime_words(msg.get("From"))
                to_addr = _decode_mime_words(msg.get("To"))
                date_str = msg.get("Date")
                body = _get_email_body(msg)

                date = None
                if date_str:
                    try:
                        date = parsedate_to_datetime(date_str).isoformat()
                    except Exception:
                        date = date_str

                emails.append({
                    "id": num.decode() if isinstance(num, bytes) else str(num),
                    "subject": subject,
                    "from": from_addr,
                    "to": to_addr,
                    "date": date,
                    "body": body,
                    "provider": provider,
                    "account": email_addr,
                })
            except Exception:
                continue

        mail.logout()
    except Exception as e:
        raise Exception(f"Failed to fetch emails from {email_addr}: {str(e)}")

    return emails


def delete_emails(provider, email_addr, password, email_ids, folder="INBOX"):
    """Delete emails by their IDs."""
    server = get_imap_server(provider)
    try:
        mail = imaplib.IMAP4_SSL(server, 993)
        mail.login(email_addr, password)
        mail.select(folder)

        for eid in email_ids:
            mail.store(str(eid).encode(), "+FLAGS", "\\Deleted")

        mail.expunge()
        mail.logout()
        return True, f"Deleted {len(email_ids)} emails"
    except Exception as e:
        return False, f"Delete failed: {str(e)}"


def move_to_folder(provider, email_addr, password, email_ids, target_folder, source_folder="INBOX"):
    """Move emails to a different folder."""
    server = get_imap_server(provider)
    try:
        mail = imaplib.IMAP4_SSL(server, 993)
        mail.login(email_addr, password)
        mail.select(source_folder)

        for eid in email_ids:
            mail.copy(str(eid).encode(), target_folder)
            mail.store(str(eid).encode(), "+FLAGS", "\\Deleted")

        mail.expunge()
        mail.logout()
        return True, f"Moved {len(email_ids)} emails to {target_folder}"
    except Exception as e:
        return False, f"Move failed: {str(e)}"


def load_accounts():
    """Load saved email accounts from file."""
    filepath = os.path.join(DATA_DIR, "accounts.json")
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    return []


def save_accounts(accounts):
    """Save email accounts to file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, "accounts.json")
    with open(filepath, "w") as f:
        json.dump(accounts, f, indent=2)
