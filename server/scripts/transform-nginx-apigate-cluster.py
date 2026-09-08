#!/usr/bin/env python3
"""Switch the reviewed apigate NGINX upstream from staging to cluster."""

from pathlib import Path
import argparse


OLD_UPSTREAM = """upstream apigate {
    server 127.0.0.1:3024;
}
"""

NEW_UPSTREAM = """upstream apigate {
    server 127.0.0.1:3025;
}
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("upstreams", type=Path)
    args = parser.parse_args()

    text = args.upstreams.read_text()
    count = text.count(OLD_UPSTREAM)
    if count != 1:
        raise SystemExit(
            f"Expected exactly one apigate port-3024 upstream; found {count}. Refusing to edit."
        )
    args.upstreams.write_text(text.replace(OLD_UPSTREAM, NEW_UPSTREAM, 1))


if __name__ == "__main__":
    main()
