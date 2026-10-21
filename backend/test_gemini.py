
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client()

prompt = """
You are NEXUS AI, an enterprise document assistant.

Answer using only the document context below.
Keep the answer concise.

DOCUMENT CONTEXT:
Employees should report suspected security incidents to
the IT team immediately using the designated reporting channel.

QUESTION:
How should employees report a suspected security incident?
"""

try:
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )
    print("SUCCESS:", response.text)

except Exception as exc:
    print("FAILED:", type(exc).__name__, str(exc))
