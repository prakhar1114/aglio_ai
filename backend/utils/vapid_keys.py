"""
Generate VAPID keys for Web‑Push.

Usage
-----
    $ python -m backend.utils.vapid_keys

The script prints two base64‑URL strings:

    VAPID_PUBLIC_KEY  – copy into backend/urls/beeper.py
    VAPID_PRIVATE_KEY – copy into backend/urls/beeper.py

Dependencies
------------
• cryptography  (pip install cryptography)

Why not pywebpush?
------------------
Newer versions of *pywebpush* expose helpers, but they’re occasionally
missing.  This script uses *cryptography* directly so it works regardless
of pywebpush version.
"""

import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization


def _urlsafe_b64(data: bytes) -> str:
    """Base64‑URL encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_vapid_keys() -> tuple[str, str]:
    """Return (public_key_b64, private_key_b64)."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    # ── private component (d) ──
    d_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
    private_b64 = _urlsafe_b64(d_bytes)

    # ── public component (uncompressed point) ──
    public_numbers = private_key.public_key().public_numbers()
    x_bytes = public_numbers.x.to_bytes(32, "big")
    y_bytes = public_numbers.y.to_bytes(32, "big")
    public_bytes = b"\x04" + x_bytes + y_bytes  # 0x04 | X | Y
    public_b64 = _urlsafe_b64(public_bytes)

    return public_b64, private_b64


def main() -> None:
    public_key, private_key = generate_vapid_keys()
    print("VAPID_PUBLIC_KEY =", public_key)
    print("VAPID_PRIVATE_KEY =", private_key)


if __name__ == "__main__":
    main()