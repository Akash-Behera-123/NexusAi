
from sqlalchemy import text
from database import engine, Base
from models import User, Conversation, Message, AIUsage

# Create any missing tables.
Base.metadata.create_all(bind=engine)

with engine.begin() as connection:
    # Safely add sources to existing messages tables.
    connection.execute(
        text("""
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS sources TEXT DEFAULT '[]'
        """)
    )

    # Link database users to Clerk accounts.
    connection.execute(
        text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR
        """)
    )

    # Prevent the same Clerk ID from being assigned to multiple users.
    connection.execute(
        text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_users_clerk_user_id
            ON users (clerk_user_id)
        """)
    )

print("Database tables checked successfully!")
print("Message sources column is ready.")
print("Clerk user ID column and unique index are ready.")
