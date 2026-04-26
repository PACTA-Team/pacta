#!/usr/bin/env python3
"""Create a QA test user in PACTA database for testing purposes."""
import sqlite3
import bcrypt
import sys
from pathlib import Path

DB_PATH = Path.home() / ".local" / "share" / "pacta" / "data" / "pacta.db"

def create_qa_user():
    if not DB_PATH.exists():
        print(f"ERROR: DB not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    # Check if QA user already exists
    cur.execute("SELECT id, email FROM users WHERE email = 'qa@pacta.test'")
    existing = cur.fetchone()
    if existing:
        print(f"QA user already exists with id={existing[0]}, email={existing[1]}")
        # Ensure active and admin role
        cur.execute("UPDATE users SET name=?, role=?, status='active' WHERE email='qa@pacta.test'", 
                    ("QA User", "admin"))
        conn.commit()
        print("Updated QA user to active admin.")
        conn.close()
        return

    # Get first company to assign
    cur.execute("SELECT id FROM companies LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("ERROR: No companies found. Run setup first.")
        sys.exit(1)
    company_id = row[0]
    print(f"Using company_id = {company_id}")

    # Hash password
    password = "QaTest123!"
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    # Insert user
    cur.execute("""
        INSERT INTO users (name, email, password_hash, role, status, company_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """, ("QA User", "qa@pacta.test", password_hash, "admin", "active", company_id))

    user_id = cur.lastrowid
    print(f"Created QA user id={user_id}, email=qa@pacta.test, role=admin, status=active")

    # Ensure user is associated with the company in user_companies (if that table exists)
    # Check if user_companies table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_companies'")
    if cur.fetchone():
        # Insert into user_companies with is_default=1
        cur.execute("""
            INSERT INTO user_companies (user_id, company_id, is_default)
            VALUES (?, ?, 1)
        """, (user_id, company_id))
        print(f"Associated user with company {company_id} in user_companies")

    conn.commit()
    conn.close()
    print("QA user ready. Credentials: qa@pacta.test / QaTest123!")

if __name__ == "__main__":
    create_qa_user()
