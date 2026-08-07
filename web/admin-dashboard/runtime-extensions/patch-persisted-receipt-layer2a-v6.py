from pathlib import Path
import hashlib
import sys

if len(sys.argv) != 5:
    raise SystemExit(
        "usage: patcher BASE OUTPUT EXPECTED_SHA REPORT"
    )

base_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
expected_sha = sys.argv[3]
report_path = Path(sys.argv[4])

raw = base_path.read_bytes()

base_sha = hashlib.sha256(
    raw
).hexdigest()

if base_sha != expected_sha:
    raise SystemExit(
        "FATAL: approved JS SHA mismatch"
    )

text = raw.decode(
    "utf-8",
    errors="strict",
)

anchor = (
    'className:"pos-print-receipt-button",'
    'onClick:()=>rx(),'
    'disabled:!(bt!=null&&bt.receipt_number),'
    'children:"Print Receipt"'
)

if text.count(anchor) != 1:
    raise SystemExit(
        "FATAL: exact receipt button anchor count != 1"
    )

old_handler = 'onClick:()=>rx()'

new_handler = (
    'onClick:()=>{'
    'typeof it!="undefined"&&it&&it.id&&'
    'typeof t!="undefined"&&t&&t.token&&'
    'window.UbuzimaReceipt?'
    'void window.UbuzimaReceipt.printOriginal(it.id,t.token):'
    'rx()}'
)

anchor_start = text.find(anchor)

handler_start = text.find(
    old_handler,
    anchor_start,
    anchor_start + len(anchor),
)

if handler_start < 0:
    raise SystemExit(
        "FATAL: exact receipt handler not found inside anchor"
    )

handler_end = (
    handler_start
    + len(old_handler)
)

patched = (
    text[:handler_start]
    + new_handler
    + text[handler_end:]
)

if patched.count(
    'className:"pos-print-receipt-button"'
) != text.count(
    'className:"pos-print-receipt-button"'
):
    raise SystemExit(
        "FATAL: receipt button class changed"
    )

if patched.count(
    'children:"Print Receipt"'
) != text.count(
    'children:"Print Receipt"'
):
    raise SystemExit(
        "FATAL: receipt button label changed"
    )

call = (
    'window.UbuzimaReceipt.'
    'printOriginal(it.id,t.token)'
)

if patched.count(call) != 1:
    raise SystemExit(
        "FATAL: persisted receipt call count != 1"
    )

if patched[:handler_start] != text[:handler_start]:
    raise SystemExit(
        "FATAL: bytes before receipt handler changed"
    )

if (
    patched[
        handler_start
        + len(new_handler):
    ]
    != text[handler_end:]
):
    raise SystemExit(
        "FATAL: bytes after receipt handler changed"
    )

# WhatsApp behavior must be completely preserved.
old_whatsapp_count = text.count(
    "https://wa.me/"
)

new_whatsapp_count = patched.count(
    "https://wa.me/"
)

if (
    old_whatsapp_count
    != new_whatsapp_count
):
    raise SystemExit(
        "FATAL: WhatsApp handler changed"
    )

output_path.write_text(
    patched,
    encoding="utf-8",
)

patched_sha = hashlib.sha256(
    output_path.read_bytes()
).hexdigest()

report = "\n".join([
    "transform=EXACT_POS_PRINT_RECEIPT_ONCLICK_ONLY",

    "base_sha={}".format(
        base_sha
    ),

    "patched_sha={}".format(
        patched_sha
    ),

    "anchor_count=1",

    "handler_start={}".format(
        handler_start
    ),

    "handler_end={}".format(
        handler_end
    ),

    "old_handler=()=>rx()",

    "old_handler_length={}".format(
        len(old_handler)
    ),

    "new_handler_length={}".format(
        len(new_handler)
    ),

    "replacement_count=1",

    "persisted_receipt_call_count=1",

    "fallback_rx_preserved=YES",

    "prefix_byte_identity=PASS",

    "suffix_byte_identity=PASS",

    "whatsapp_handler_preserved=YES",

    "frontend_rebuild=NO",
])

report_path.write_text(
    report + "\n",
    encoding="utf-8",
)

print(report)
