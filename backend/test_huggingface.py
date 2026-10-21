
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

token = os.getenv("HF_TOKEN")

if not token:
    raise ValueError("HF_TOKEN is missing from .env")

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=token,
)

response = client.chat.completions.create(
    model="openai/gpt-oss-20b:groq",
    messages=[
        {
            "role": "user",
            "content": "Explain artificial intelligence in three simple sentences."
        }
    ],
)

print(response.choices[0].message.content)
