
from sqlalchemy import inspect
from database import engine

inspector = inspect(engine)
tables = inspector.get_table_names()

print("Database tables:")
for table in tables:
    print("-", table)

if "ai_usage" in tables:
    print("\nSUCCESS: ai_usage table exists.")

    print("\nColumns:")
    for column in inspector.get_columns("ai_usage"):
        print("-", column["name"])
else:
    print("\nERROR: ai_usage table was not created.")
