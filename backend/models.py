
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)

    # Link this database user to their Clerk account.
    clerk_user_id = Column(
        String,
        unique=True,
        nullable=True,
        index=True
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)

    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id"),
        nullable=False
    )

    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    # Store document citations as JSON text.
    sources = Column(Text, nullable=True, default="[]")






class AIUsage(Base):
    __tablename__ = "ai_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id"),
        nullable=True,
        index=True
    )
    model = Column(String, nullable=False)
    operation = Column(String, nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )