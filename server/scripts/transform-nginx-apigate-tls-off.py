#!/usr/bin/env python3
"""Apply the reviewed apigate TLS-off NGINX config transformation."""

from pathlib import Path
import argparse


OLD_API = """location ^~ /api {
  add_header Access-Control-Allow-Origin "*" always;
  proxy_redirect off;
  proxy_pass https://apigate;
  include /etc/nginx/conf2.d/aio_cache_proxy.conf;
}
"""

NEW_API = """location ^~ /api {
  add_header Access-Control-Allow-Origin "*" always;
  proxy_redirect off;
  proxy_pass http://apigate;
  include /etc/nginx/conf2.d/aio_cache_proxy.conf;
}
"""

OLD_RETIRED = """
location /bio {
  proxy_redirect off;
  proxy_pass https://apigate;
  include /etc/nginx/conf2.d/aio_cache_proxy.conf;
}

# GraphQL/search-like calls are intentionally not cached.
location /gql {
  add_header Access-Control-Allow-Origin "*" always;
  proxy_redirect off;
  proxy_pass https://apigate;
  include /etc/nginx/conf2.d/proxy_pass_snippet.conf;
}
"""

OLD_UPSTREAM = """upstream apigate {
    server 127.0.0.1:3023;
}
"""

NEW_UPSTREAM = """upstream apigate {
    server 127.0.0.1:3024;
}
"""


def replace_exactly_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label}; found {count}. Refusing to edit.")
    return text.replace(old, new, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("routes", type=Path)
    parser.add_argument("upstreams", type=Path)
    args = parser.parse_args()

    routes = args.routes.read_text()
    routes = replace_exactly_once(routes, OLD_API, NEW_API, "/api proxy block")
    routes = replace_exactly_once(routes, OLD_RETIRED, "\n", "retired /bio and /gql blocks")

    upstreams = args.upstreams.read_text()
    upstreams = replace_exactly_once(
        upstreams, OLD_UPSTREAM, NEW_UPSTREAM, "apigate upstream block"
    )

    args.routes.write_text(routes)
    args.upstreams.write_text(upstreams)


if __name__ == "__main__":
    main()
