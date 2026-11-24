"""One shared TLS context for every outbound connection.

Building a context parses the whole CA bundle (about 0.2 s of CPU each time). Creating it once
and reusing it removed most of the CPU cost of an investigation (measured with cProfile).
Mozilla's CA bundle (certifi) is used, like httpx does: the OS store on some Windows machines is
out of date and wrongly reports valid Let's Encrypt certificates as expired.
"""

import ssl
from functools import lru_cache

import certifi


@lru_cache(maxsize=1)
def shared_context() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=certifi.where())
