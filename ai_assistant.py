"""
AI Assistant - Gemini API integration with memory system.
Analyzes emails, prioritizes, detects spam, learns user behavior.
"""

import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
MEMORY_FILE = os.path.join(DATA_DIR, "memory.json")


def _load_memory():
    """Load persistent memory about the user."""
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return {
        "owner": {},
        "email_patterns": {},
        "important_senders": [],
        "spam_senders": [],
        "preferences": {},
        "interaction_history": [],
        "last_updated": None,
    }


def _save_memory(memory):
    """Save memory to disk."""
    os.makedirs(DATA_DIR, exist_ok=True)
    memory["last_updated"] = datetime.now().isoformat()
    with open(MEMORY_FILE, "w") as f:
        json.dump(memory, f, indent=2, ensure_ascii=False)


def _get_genai_model(api_key):
    """Initialize and return Gemini model."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.0-flash")


def analyze_emails(api_key, emails, language="th"):
    """
    Analyze emails using Gemini AI.
    Returns prioritized list with categories, spam detection, and summary.
    """
    if not emails:
        return {"summary": "No emails to analyze.", "emails": [], "spam": []}

    memory = _load_memory()
    model = _get_genai_model(api_key)

    # Build email summaries for the prompt
    email_summaries = []
    for i, em in enumerate(emails):
        email_summaries.append(
            f"[{i}] From: {em.get('from', 'Unknown')}\n"
            f"    Subject: {em.get('subject', 'No subject')}\n"
            f"    Date: {em.get('date', 'Unknown')}\n"
            f"    Body preview: {em.get('body', '')[:500]}"
        )

    emails_text = "\n\n".join(email_summaries)

    memory_context = ""
    if memory.get("owner"):
        memory_context += f"\nOwner info: {json.dumps(memory['owner'], ensure_ascii=False)}"
    if memory.get("important_senders"):
        memory_context += f"\nKnown important senders: {', '.join(memory['important_senders'][:20])}"
    if memory.get("spam_senders"):
        memory_context += f"\nKnown spam senders: {', '.join(memory['spam_senders'][:20])}"
    if memory.get("preferences"):
        memory_context += f"\nUser preferences: {json.dumps(memory['preferences'], ensure_ascii=False)}"

    prompt = f"""You are a personal email assistant AI. Analyze the following emails and provide a structured response.

{memory_context}

EMAILS:
{emails_text}

Please respond in JSON format with the following structure:
{{
    "summary": "A brief overall summary of today's emails in Thai language",
    "owner_insights": "Any new insights about the email owner (name, job, interests) based on these emails",
    "emails": [
        {{
            "index": 0,
            "priority": "high/medium/low",
            "category": "work/personal/finance/social/newsletter/promotion/other",
            "is_spam": false,
            "spam_reason": null,
            "brief_summary": "Brief summary in Thai",
            "action_needed": "What action is needed, if any, in Thai"
        }}
    ],
    "spam_indices": [list of indices that are spam/junk],
    "important_indices": [list of high-priority email indices],
    "new_important_senders": [list of sender emails to remember as important],
    "new_spam_senders": [list of sender emails to remember as spam]
}}

Rules:
- Prioritize by urgency and importance
- Detect spam, promotions, and junk mail
- Provide summaries in Thai language
- Learn from context who the owner is and what matters to them
- Be thorough in spam detection (newsletters, marketing, phishing)
"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text

        # Clean JSON from markdown code blocks if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        result = json.loads(response_text.strip())

        # Update memory with new insights
        _update_memory(memory, result, emails)

        # Attach original email data to results
        for item in result.get("emails", []):
            idx = item.get("index", 0)
            if 0 <= idx < len(emails):
                item["original"] = {
                    "from": emails[idx].get("from"),
                    "subject": emails[idx].get("subject"),
                    "date": emails[idx].get("date"),
                    "account": emails[idx].get("account"),
                    "id": emails[idx].get("id"),
                }

        return result

    except json.JSONDecodeError:
        # If AI response isn't valid JSON, return basic analysis
        return {
            "summary": response_text if 'response_text' in dir() else "Analysis failed",
            "emails": [],
            "spam_indices": [],
            "important_indices": [],
            "raw_response": response_text if 'response_text' in dir() else None,
        }
    except Exception as e:
        return {"summary": f"Analysis error: {str(e)}", "emails": [], "spam_indices": []}


def _update_memory(memory, analysis_result, emails):
    """Update memory based on analysis results."""
    # Update owner insights
    owner_insights = analysis_result.get("owner_insights", "")
    if owner_insights and owner_insights != "null":
        memory.setdefault("owner", {})
        memory["owner"]["last_insight"] = owner_insights
        memory["owner"]["updated_at"] = datetime.now().isoformat()

    # Update important senders
    new_important = analysis_result.get("new_important_senders", [])
    if new_important:
        existing = set(memory.get("important_senders", []))
        existing.update(new_important)
        memory["important_senders"] = list(existing)[:100]

    # Update spam senders
    new_spam = analysis_result.get("new_spam_senders", [])
    if new_spam:
        existing = set(memory.get("spam_senders", []))
        existing.update(new_spam)
        memory["spam_senders"] = list(existing)[:200]

    # Track email patterns
    patterns = memory.get("email_patterns", {})
    for em in emails:
        sender = em.get("from", "")
        patterns[sender] = patterns.get(sender, 0) + 1
    memory["email_patterns"] = dict(
        sorted(patterns.items(), key=lambda x: x[1], reverse=True)[:100]
    )

    # Log interaction
    memory.setdefault("interaction_history", [])
    memory["interaction_history"].append({
        "date": datetime.now().isoformat(),
        "emails_processed": len(emails),
        "spam_found": len(analysis_result.get("spam_indices", [])),
        "important_found": len(analysis_result.get("important_indices", [])),
    })
    # Keep last 30 interactions
    memory["interaction_history"] = memory["interaction_history"][-30:]

    _save_memory(memory)


def generate_daily_summary(api_key, analysis_result):
    """Generate a concise daily summary suitable for Telegram."""
    model = _get_genai_model(api_key)
    memory = _load_memory()

    prompt = f"""Based on the following email analysis, create a concise daily summary in Thai for sending via Telegram.

Analysis: {json.dumps(analysis_result, ensure_ascii=False, default=str)[:4000]}

Owner info: {json.dumps(memory.get('owner', {}), ensure_ascii=False)}

Format the summary as follows (in Thai):
📬 สรุปอีเมลประจำวัน
━━━━━━━━━━━━━━━
📊 ภาพรวม: (total emails, spam count, important count)

🔴 สำคัญมาก:
- (list important emails briefly)

📋 ทั่วไป:
- (list normal emails briefly)

🗑️ ขยะ/สแปม:
- (count of spam deleted)

💡 คำแนะนำ:
- (any suggestions)

Keep it concise and readable on mobile. Use emojis for visual clarity.
"""

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"❌ Error generating summary: {str(e)}"


def get_memory():
    """Return current memory state."""
    return _load_memory()


def update_owner_info(info):
    """Manually update owner information."""
    memory = _load_memory()
    memory["owner"].update(info)
    _save_memory(memory)
    return memory["owner"]


def reset_memory():
    """Reset all memory."""
    memory = {
        "owner": {},
        "email_patterns": {},
        "important_senders": [],
        "spam_senders": [],
        "preferences": {},
        "interaction_history": [],
        "last_updated": None,
    }
    _save_memory(memory)
    return memory
