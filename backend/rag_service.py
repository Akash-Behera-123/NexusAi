
from pathlib import Path
import re
import threading

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from rag import DOCUMENTS_DIR, load_pdf_pages, split_text

print("Loading NEXUS AI document search...")

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Each authenticated user gets an independent in-memory index.
_user_indexes = {}
_index_lock = threading.RLock()


def get_user_documents_dir(clerk_user_id: str) -> Path:
    """Return the document directory for a verified Clerk user."""

    if not clerk_user_id or not re.fullmatch(
        r"user_[A-Za-z0-9_-]+", clerk_user_id
    ):
        raise ValueError("Invalid Clerk user ID.")

    directory = DOCUMENTS_DIR / "users" / clerk_user_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def rebuild_user_index(clerk_user_id: str) -> dict:
    """Build a FAISS index using only one user's PDFs."""

    documents_dir = get_user_documents_dir(clerk_user_id)

    chunks = []
    chunk_sources = []
    chunk_pages = []

    for pdf_path in sorted(documents_dir.glob("*.pdf")):
        try:
            pages = load_pdf_pages(pdf_path)

            for page_data in pages:
                for chunk in split_text(page_data["text"]):
                    chunks.append(chunk)
                    chunk_sources.append(pdf_path.name)
                    chunk_pages.append(page_data["page"])

        except Exception as exc:
            print(
                f"Could not process {pdf_path.name} "
                f"for user {clerk_user_id}: {exc}"
            )

    index = None

    if chunks:
        embeddings = embedding_model.encode(
            chunks,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        embeddings = np.asarray(embeddings, dtype=np.float32)

        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)

    # Replace only this user's index, not another user's index.
    with _index_lock:
        _user_indexes[clerk_user_id] = {
            "chunks": chunks,
            "sources": chunk_sources,
            "pages": chunk_pages,
            "index": index,
        }

    return {
        "documents": len(set(chunk_sources)),
        "chunks": len(chunks),
    }


def retrieve_user_context(
    clerk_user_id: str,
    question: str,
    top_k: int = 3,
    similarity_threshold: float = 0.20,
) -> list[dict]:
    """Search the authenticated user's index, rebuilding it if missing."""

    with _index_lock:
        user_data = _user_indexes.get(clerk_user_id)

    # A backend restart clears the in-memory index.
    # Rebuild it from this user's saved PDFs when necessary.
    if user_data is None:
        print("User index missing; rebuilding index.")
        rebuild_user_index(clerk_user_id)

        with _index_lock:
            user_data = _user_indexes.get(clerk_user_id)

    if user_data is None:
        return []

    chunks = user_data["chunks"]
    sources = user_data["sources"]
    pages = user_data["pages"]
    index = user_data["index"]

    if index is None or not chunks:
        return []

    query_embedding = embedding_model.encode(
        [question],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    query_embedding = np.asarray(query_embedding, dtype=np.float32)

    k = min(top_k, len(chunks))
    scores, indices = index.search(query_embedding, k)

    results = []

    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue

        similarity = float(score)

        if similarity < similarity_threshold:
            continue

        results.append({
            "text": chunks[idx],
            "source": sources[idx],
            "page": pages[idx],
            "similarity": similarity,
        })

    return results

def list_user_documents(clerk_user_id: str) -> list[dict]:
    """List PDFs stored in one user's directory."""

    directory = get_user_documents_dir(clerk_user_id)

    return [
        {
            "name": path.name,
            "size_bytes": path.stat().st_size,
            "type": "PDF",
        }
        for path in sorted(directory.glob("*.pdf"))
    ]


def get_user_index_stats(clerk_user_id: str) -> dict:
    """Return index statistics for one user."""

    with _index_lock:
        data = _user_indexes.get(clerk_user_id)

        if data is None:
            return {"documents": 0, "chunks": 0}

        return {
            "documents": len(set(data["sources"])),
            "chunks": len(data["chunks"]),
        }
