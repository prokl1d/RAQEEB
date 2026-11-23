"""Arabic text normalisation for rule matching.

Every mapping is one character to one character, so match positions in the normalised text are
the same as in the original text (the website uses them to highlight red flags).
- alef forms (أ إ آ ٱ) -> ا ; alef maqsura ى -> ي ; ta marbuta ة -> ه ; hamza carriers ؤ ئ -> و ي
- Arabic-Indic and Persian digits -> 0-9
"""

_MAP = {
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي",
}
_MAP.update({chr(0x0660 + i): str(i) for i in range(10)})  # ٠-٩
_MAP.update({chr(0x06F0 + i): str(i) for i in range(10)})  # ۰-۹
_TABLE = str.maketrans(_MAP)


def normalize(text: str) -> str:
    """Normalise Arabic letter variants and digits; keeps the string length unchanged."""
    out = text.translate(_TABLE)
    assert len(out) == len(text)
    return out
