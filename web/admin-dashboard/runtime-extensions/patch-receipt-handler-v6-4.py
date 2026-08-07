from pathlib import Path
import hashlib
import sys

base = Path(sys.argv[1])
output = Path(sys.argv[2])
expected_sha = sys.argv[3]
report = Path(sys.argv[4])

raw = base.read_bytes()

if hashlib.sha256(raw).hexdigest() != expected_sha:
    raise SystemExit(
        "FATAL: current V6 main JS SHA mismatch"
    )

text = raw.decode("utf-8")

old = (
    'onClick:()=>{'
    'typeof it!="undefined"&&it&&it.id&&'
    'typeof t!="undefined"&&t&&t.token&&'
    'window.UbuzimaReceipt?'
    'void window.UbuzimaReceipt.printOriginal(it.id,t.token):'
    'rx()}'
)

new = (
    'onClick:()=>{'
    'typeof it!="undefined"&&it&&it.id&&'
    'window.UbuzimaReceipt?'
    'void window.UbuzimaReceipt.printOriginal(it.id):'
    'rx()}'
)

if text.count(old) != 1:
    raise SystemExit(
        "FATAL: current receipt handler count != 1"
    )

start = text.find(old)
end = start + len(old)

patched = (
    text[:start]
    + new
    + text[end:]
)

if patched[:start] != text[:start]:
    raise SystemExit(
        "FATAL: prefix changed"
    )

if patched[
    start + len(new):
] != text[end:]:
    raise SystemExit(
        "FATAL: suffix changed"
    )

if patched.count(
    "window.UbuzimaReceipt.printOriginal(it.id)"
) != 1:
    raise SystemExit(
        "FATAL: new receipt call count != 1"
    )

output.write_text(
    patched,
    encoding="utf-8",
)

report.write_text(
    "\n".join([
        "transform=RECEIPT_ENTRY_GUARD_ONLY",
        "old_requires_t_token=YES",
        "new_requires_t_token=NO",
        "sale_identifier=it.id",
        "fallback_rx_preserved=YES",
        "replacement_count=1",
        "prefix_identity=PASS",
        "suffix_identity=PASS",
    ]) + "\n",
    encoding="utf-8",
)

print("handler_transform=PASS")
print("t_token_guard_removed=YES")
print("fallback_rx_preserved=YES")
