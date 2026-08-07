from pathlib import Path
import hashlib
import sys

if len(sys.argv) != 5:
    raise SystemExit(
        "usage: builder HELPER MAIN OUTPUT REPORT"
    )

helper_path = Path(sys.argv[1])
main_path = Path(sys.argv[2])
output_path = Path(sys.argv[3])
report_path = Path(sys.argv[4])

helper = helper_path.read_text(
    encoding="utf-8",
    errors="strict",
)

main = main_path.read_text(
    encoding="utf-8",
    errors="strict",
)

required_helper = [
    "window.UbuzimaReceipt",
    "openReceipt(context)",
    "openReceiptDialog",
    "Hard Copy Print",
    "WhatsApp",
    "Email",
]

for marker in required_helper:
    if marker not in helper:
        raise SystemExit(
            "FATAL: helper missing: "
            + marker
        )

required_main = [
    'className:"pos-print-receipt-button"',
    "window.UbuzimaReceipt.openReceipt",
]

for marker in required_main:
    if marker not in main:
        raise SystemExit(
            "FATAL: main missing: "
            + marker
        )

if "rx()" in main[
    max(
        0,
        main.find(
            'className:"pos-print-receipt-button"'
        )
    ):
    main.find(
        'className:"pos-print-receipt-button"'
    ) + 600
]:
    raise SystemExit(
        "FATAL: old receipt rx fallback returned"
    )

banner = (
    "/* Ubuzima+ V6.6 integrated receipt runtime. "
    "V6.5 helper executes before approved derived main. */\n"
)

combined = (
    banner
    + helper
    + "\n;\n"
    + main
)

if combined.count(
    "window.UbuzimaReceipt.openReceipt"
) != 1:
    raise SystemExit(
        "FATAL: popup button call count != 1"
    )

if combined.count(
    "window.UbuzimaReceipt"
) < 2:
    raise SystemExit(
        "FATAL: integrated global receipt API not proven"
    )

output_path.write_text(
    combined,
    encoding="utf-8",
)

helper_sha = hashlib.sha256(
    helper_path.read_bytes()
).hexdigest()

main_sha = hashlib.sha256(
    main_path.read_bytes()
).hexdigest()

combined_sha = hashlib.sha256(
    output_path.read_bytes()
).hexdigest()

report = "\n".join([
    "build=INTEGRATED_RECEIPT_RUNTIME",
    "receipt_logic_changed=NO",
    "receipt_layout_changed=NO",
    "helper_executes_before_main=YES",
    "separate_helper_dependency=REMOVED",
    "helper_sha={}".format(helper_sha),
    "main_sha={}".format(main_sha),
    "combined_sha={}".format(combined_sha),
    "popup_call_count=1",
    "old_rx_fallback=NO",
])

report_path.write_text(
    report + "\n",
    encoding="utf-8",
)

print(report)
