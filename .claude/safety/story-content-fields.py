#!/usr/bin/env python3
"""Decide whether a journeyStory write touches STORY CONTENT or only media.

The story gate's contract is: the BODY of a JourneyStory (text/vocab) reaches
the database only through saveStory.ts. Its original check was a grep for
`text:` / `vocab:` anywhere in the script, which is a proxy, not the contract:
`scripts/backfillAudioSections.ts` writes `data: { audioFragments: [...] }`
and each fragment object carries its own `text` (the sentence that fragment
narrates, COPIED from the story). That is an audio column, not the body, yet
the grep read it as a content write and blocked the script (2026-08-17).

So instead of grepping the file, look at the actual write: find every
`journeyStory.<write>(...)` call, take its `data:` object, and report the
FIRST-LEVEL field names. A `text` nested inside `audioFragments` is not a
first-level field and does not count.

Output (one word on stdout):
  CONTENT    at least one data: has a first-level `text` or `vocab`
  MEDIA_ONLY every data: parsed, none has first-level `text`/`vocab`
  UNKNOWN    something could not be parsed (dynamic `data: payload`, a spread,
             an array, no write at all). The caller must fall back to its
             conservative grep: fail closed.

Usage:  story-content-fields.py <file>      (or `-` to read stdin)
"""
import re
import sys

CONTENT_FIELDS = {"text", "vocab"}
WRITE = re.compile(r"journeyStory\s*\.\s*(?:create|createMany|update|updateMany|upsert)\b")
# `data:` at the start of a property, not `metadata:` / `.data:`
DATA_KEY = re.compile(r"(?<![\w$.])data\s*:")
KEY = re.compile(r"""(?:^|[{,])\s*(?:(['"])(?P<q>[\w$]+)\1|(?P<b>[\w$]+))\s*:""")


def skip_to_close(src: str, i: int) -> int:
    """Index just past the `{`/`(`/`[` at src[i], honouring strings."""
    pairs = {"{": "}", "(": ")", "[": "]"}
    stack = [pairs[src[i]]]
    i += 1
    while i < len(src) and stack:
        c = src[i]
        if c in "\"'`":
            quote, i = c, i + 1
            while i < len(src):
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
        elif c in pairs:
            stack.append(pairs[c])
        elif stack and c == stack[-1]:
            stack.pop()
        i += 1
    return i if not stack else -1


def top_level_keys(obj: str):
    """Field names at depth 1 of an object literal; None if a spread appears."""
    body = obj[1:-1]
    keys, i, depth = [], 0, 0
    while i < len(body):
        c = body[i]
        if c in "\"'`":
            quote, i = c, i + 1
            while i < len(body):
                if body[i] == "\\":
                    i += 2
                    continue
                if body[i] == quote:
                    break
                i += 1
            i += 1
            continue
        if c in "{([":
            depth += 1
        elif c in "})]":
            depth -= 1
        elif depth == 0 and body.startswith("...", i):
            return None  # a spread can carry anything; refuse to guess
        elif depth == 0:
            m = KEY.match(body, max(0, i - 1)) or (KEY.match(body, i) if i == 0 else None)
            if m:
                keys.append(m.group("q") or m.group("b"))
                i = m.end()
                continue
        i += 1
    return keys


def verdict(src: str) -> str:
    seen_any = False
    for w in WRITE.finditer(src):
        # The call's argument object starts at the first `(` after the method.
        p = src.find("(", w.end())
        if p < 0:
            return "OPAQUE"
        end = skip_to_close(src, p)
        if end < 0:
            return "OPAQUE"
        args = src[p:end]
        d = DATA_KEY.search(args)
        if not d:
            return "OPAQUE"
        rest = args[d.end():]
        stripped = rest.lstrip()
        if not stripped.startswith("{"):
            return "OPAQUE"  # `data: payload` / `data: [...]`: cannot inspect
        off = d.end() + (len(rest) - len(stripped))
        close = skip_to_close(args, off)
        if close < 0:
            return "OPAQUE"
        keys = top_level_keys(args[off:close])
        if keys is None:
            return "OPAQUE"
        if CONTENT_FIELDS & set(keys):
            return "CONTENT"
        seen_any = True
    return "MEDIA_ONLY" if seen_any else "NO_WRITE"


def main() -> None:
    target = sys.argv[1] if len(sys.argv) > 1 else "-"
    src = sys.stdin.read() if target == "-" else open(target, encoding="utf-8", errors="replace").read()
    print(verdict(src))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("UNKNOWN")  # fail closed: the caller falls back to its grep
