import re
from typing import List


def normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation for matching."""
    text = text.lower()
    text = re.sub(r"[^\w\s\.\-/&]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def contains_any(text: str, terms: List[str]) -> bool:
    """Case-insensitive substring check for any term in the list."""
    t = text.lower()
    return any(term.lower() in t for term in terms)


def count_matches(text: str, terms: List[str]) -> int:
    """Count how many distinct terms appear in text (case-insensitive)."""
    t = text.lower()
    return sum(1 for term in terms if term.lower() in t)


def extract_numbers(text: str) -> List[float]:
    """Pull all numeric values (incl. millions, billions) from text."""
    results = []
    # Match patterns like 500K, 1.2M, 3B, or plain numbers
    for m in re.finditer(r"(\d[\d,.]*)\s*([MmBbKk]?)", text):
        raw, suffix = m.group(1), m.group(2).upper()
        try:
            val = float(raw.replace(",", ""))
        except ValueError:
            continue
        if suffix == "K":
            val *= 1_000
        elif suffix == "M":
            val *= 1_000_000
        elif suffix == "B":
            val *= 1_000_000_000
        results.append(val)
    return results


def has_scale_mention(text: str) -> bool:
    """Returns True if text mentions large-scale numbers or scale keywords."""
    scale_words = [
        "million", "billion", "thousands", "at scale", "high throughput",
        "low latency", "qps", "rps", "tps", "50k", "100k", "1m ", " 1b ",
        "petabyte", "terabyte", "tb ", "pb ", " gb/s",
    ]
    if contains_any(text, scale_words):
        return True
    nums = extract_numbers(text)
    return any(n >= 10_000 for n in nums)


def truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "..."
