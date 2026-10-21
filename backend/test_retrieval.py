
from rag_service import (
    retrieve_user_context,
    rebuild_user_index,
)

clerk_user_id = "user_3KoDqJDPA9ZV7VNh5QGJmVyXoAw"

print("\nREBUILDING USER INDEX...")
print(rebuild_user_index(clerk_user_id))

questions = [
    "Summarize the main topics covered in this document.",
    "What are the account security requirements?",
    "How should employees report suspected security incidents?",
]

for question in questions:
    print(f"\n{'=' * 60}")
    print(f"QUESTION: {question}")

    results = retrieve_user_context(
        clerk_user_id,
        question,
        top_k=5,
        similarity_threshold=0.0,
    )

    if not results:
        print("No chunks retrieved.")
        continue

    for result in results:
        print(f"\nSimilarity: {result['similarity']:.3f}")
        print(f"Source: {result['source']}")
        print(f"Page: {result['page']}")
        print(f"Text: {result['text'][:500]}")
