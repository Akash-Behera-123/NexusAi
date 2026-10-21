
from pathlib import Path
from pypdf import PdfReader

# Project's PDF directory
DOCUMENTS_DIR = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "documents"
)


def load_pdf_pages(pdf_path: Path) -> list[dict]:
    """Extract PDF text while preserving actual page numbers."""

    reader = PdfReader(str(pdf_path))
    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text()

        if text and text.strip():
            pages.append({
                "page": page_number,
                "text": text.strip()
            })

    return pages


def split_text(
    text: str,
    chunk_size: int = 300,
    overlap: int = 60
) -> list[str]:
    """Split text into smaller, overlapping character-based chunks."""

    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError(
            "Require chunk_size > 0 and 0 <= overlap < chunk_size."
        )

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        start = end - overlap

    return chunks


if __name__ == "__main__":
    pdf_files = list(DOCUMENTS_DIR.glob("*.pdf"))

    if not pdf_files:
        print(f"No PDF files found in: {DOCUMENTS_DIR}")
        print("Add a text-based PDF and run this script again.")
    else:
        for pdf_path in pdf_files:
            pages = load_pdf_pages(pdf_path)
            total_chunks = 0

            print(f"\nPDF: {pdf_path.name}")
            print(f"Pages with extractable text: {len(pages)}")

            for page_data in pages:
                chunks = split_text(page_data["text"])
                total_chunks += len(chunks)

            print(f"Number of chunks: {total_chunks}")

            if pages:
                print("\nFirst page preview:")
                print(f"Page number: {pages[0]['page']}")
                print(pages[0]["text"][:500])
