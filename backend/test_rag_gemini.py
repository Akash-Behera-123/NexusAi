
import os

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from google import genai
from dotenv import load_dotenv

from rag import DOCUMENTS_DIR, load_pdf_text, split_text

# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in backend/.env")

client = genai.Client(api_key=api_key)

# Load embedding model
print("Loading embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding model loaded!")

# Load and split PDF documents
all_chunks = []

for pdf_path in DOCUMENTS_DIR.glob("*.pdf"):
    text = load_pdf_text(pdf_path)
    all_chunks.extend(split_text(text))

if not all_chunks:
    raise RuntimeError(f"No PDF text found in {DOCUMENTS_DIR}")

print(f"Loaded {len(all_chunks)} chunks.")

# Create FAISS index
embeddings = model.encode(
    all_chunks,
    convert_to_numpy=True,
    normalize_embeddings=True,
)
embeddings = np.asarray(embeddings, dtype=np.float32)

index = faiss.IndexFlatIP(embeddings.shape[1])
index.add(embeddings)

print("RAG system ready!")


def answer_question(question: str) -> str:
    # Retrieve relevant passages
    query_embedding = model.encode(
        [question],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    query_embedding = np.asarray(
        query_embedding, dtype=np.float32
    )

    k = min(2, len(all_chunks))
    scores, indices = index.search(query_embedding, k)

    context = "\n\n".join(
        all_chunks[idx]
        for idx in indices[0]
        if idx >= 0
    )

    # Ask Gemini to answer from the retrieved context
    prompt = f"""
You are NEXUS AI, an enterprise assistant.

Answer using only the context below.
If the answer is not present in the context, say:
"I couldn't find that information in the provided documents."

Context:
{context}

Question:
{question}

Give a concise, direct answer.
"""

    print("Sending question to Gemini...", flush=True)

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
        config={"http_options": {"timeout": 30000}},
    )

    print("Gemini response received.", flush=True)

    return response.text or "No answer was generated."


# Interactive question-answer loop
while True:
    question = input(
        "\nAsk NEXUS AI (or type 'exit'): "
    ).strip()

    if question.lower() == "exit":
        break

    if not question:
        continue

    try:
        answer = answer_question(question)
        print(f"\nNEXUS AI: {answer}")
    except Exception as exc:
        print(f"\nError: {exc}")
