(() => {
  "use strict";

  const VERSION =
    "2026.08.receipt-pdf-delivery-v1-r4-rev5";

  const PAGE_WIDTH_PT =
    226.771654;

  const CART_STYLE_ID =
    "ubuzima-r4-rev2-cart-product-wrap";

  if (
    window.__UBUZIMA_RECEIPT_PDF_R4_REV5_ACTIVE__
  ) {
    return;
  }

  window.__UBUZIMA_RECEIPT_PDF_R4_REV5_ACTIVE__ =
    true;

  /*
   * ==========================================================
   * CART PRODUCT NAME WRAPPING
   *
   * Styling only.
   *
   * It does NOT change:
   * - cart records
   * - product names
   * - quantity
   * - price
   * - totals
   * - React state
   * - cart event handlers
   * ==========================================================
   */

  function installCartWrapStyle() {
    if (
      !document ||
      !document.head
    ) {
      return;
    }

    if (
      document.getElementById(
        CART_STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      CART_STYLE_ID;

    style.textContent = `
      .pos-sale-cart-section .pos-cart-table {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      th:nth-child(1),

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(1) {
        width: 44% !important;
        max-width: 44% !important;
        min-width: 0 !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      th:nth-child(2),

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(2) {
        width: 16% !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      th:nth-child(3),

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(3) {
        width: 22% !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      th:nth-child(4),

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(4) {
        width: 18% !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(1) {
        min-width: 0 !important;
        max-width: 44% !important;
        overflow: hidden !important;
        vertical-align: top !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(1)
      strong,

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(1)
      small,

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(1)
      span,

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(1)
      div {
        min-width: 0 !important;
        max-width: 100% !important;

        white-space: normal !important;

        overflow-wrap: anywhere !important;
        word-wrap: break-word !important;
        word-break: normal !important;

        text-overflow: clip !important;

        line-height: 1.22 !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(2),

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(3),

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(4) {
        overflow: hidden !important;
      }

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(2)
      input,

      .pos-sale-cart-section
      .pos-cart-table
      td:nth-child(4)
      button {
        max-width: 100% !important;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /*
   * ==========================================================
   * RECEIPT ACCESS
   * ==========================================================
   */

  function receiptDialog(
    button
  ) {
    if (
      !button ||
      typeof button.closest !==
        "function"
    ) {
      return null;
    }

    return (
      button.closest(
        '[data-ubuzima-receipt-content-v5-dialog="1"]'
      ) ||
      button.closest(
        '[role="dialog"]'
      )
    );
  }

  function receiptPaper(
    button
  ) {
    const dialog =
      receiptDialog(
        button
      );

    if (!dialog) {
      throw new Error(
        "Receipt dialog was not found."
      );
    }

    const paper =
      dialog.querySelector(
        "[data-receipt-paper]"
      );

    if (!paper) {
      throw new Error(
        "Receipt paper was not found."
      );
    }

    return paper;
  }

  function setStatus(
    button,
    message,
    state
  ) {
    const dialog =
      receiptDialog(
        button
      );

    if (!dialog) {
      return;
    }

    const status =
      dialog.querySelector(
        "[data-receipt-status]"
      );

    if (!status) {
      return;
    }

    status.textContent =
      message;

    status.dataset.state =
      state ||
      "ready";
  }

  function cleanText(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /\u00a0/g,
        " "
      )
      .replace(
        /\r\n?/g,
        "\n"
      )
      .replace(
        /[ \t]+/g,
        " "
      )
      .trim();
  }

  function stripExpectedSerial(
    value,
    rowNumber
  ) {
    const source =
      cleanText(
        value
      );

    if (!source) {
      return "";
    }

    const serial =
      String(
        Number(
          rowNumber
        ) || ""
      );

    if (!serial) {
      return source;
    }

    const pattern =
      new RegExp(
        "^\\s*" +
        serial +
        "\\s*[.)]\\s+"
      );

    return source
      .replace(
        pattern,
        ""
      )
      .trim();
  }

  function textLines(
    element
  ) {
    return String(
      element.innerText ||
      element.textContent ||
      ""
    )
      .replace(
        /\u00a0/g,
        " "
      )
      .replace(
        /\r\n?/g,
        "\n"
      )
      .split(
        "\n"
      )
      .map(
        value =>
          cleanText(
            value
          )
      )
      .filter(
        Boolean
      );
  }

  function referenceForText(
    text
  ) {
    const match =
      String(
        text || ""
      ).match(
        /\bSALE-[A-Z0-9-]+\b/i
      );

    if (
      match &&
      match[0]
    ) {
      return match[0]
        .toUpperCase();
    }

    return "SALE";
  }

  function filenameForText(
    text
  ) {
    const reference =
      referenceForText(
        text
      )
        .replace(
          /[^A-Z0-9_-]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        );

    return (
      "Sales-Invoice-" +
      (
        reference ||
        "SALE"
      ) +
      ".pdf"
    );
  }

  /*
   * ==========================================================
   * RECEIPT MODEL
   * ==========================================================
   */

  function valueAfterLabel(
    lines,
    label
  ) {
    const wanted =
      label.toLowerCase();

    for (
      let index = 0;
      index < lines.length;
      index += 1
    ) {
      const current =
        lines[index];

      const lower =
        current.toLowerCase();

      if (
        lower ===
        wanted
      ) {
        return (
          lines[index + 1] ||
          ""
        );
      }

      if (
        lower.indexOf(
          wanted + " "
        ) === 0 ||
        lower.indexOf(
          wanted + ":"
        ) === 0
      ) {
        return cleanText(
          current
            .slice(
              label.length
            )
            .replace(
              /^[:\s]+/,
              ""
            )
        );
      }
    }

    return "";
  }

  function headerLinesFor(
    lines
  ) {
    const titleIndex =
      lines.findIndex(
        line =>
          line.toUpperCase() ===
          "SALES INVOICE"
      );

    if (
      titleIndex <= 0
    ) {
      return [];
    }

    return lines
      .slice(
        0,
        titleIndex
      )
      .filter(
        line =>
          !/^\d+\s+product line\(s\)/i.test(
            line
          )
      );
  }

  function findProductTable(
    paper
  ) {
    const tables =
      Array.from(
        paper.querySelectorAll(
          "table"
        )
      );

    for (
      const table of tables
    ) {
      const header =
        cleanText(
          (
            table.querySelector(
              "thead"
            ) ||
            table
          ).textContent
        ).toLowerCase();

      if (
        header.indexOf(
          "product"
        ) >= 0 &&
        header.indexOf(
          "qty"
        ) >= 0 &&
        header.indexOf(
          "amount"
        ) >= 0
      ) {
        return table;
      }
    }

    return null;
  }

  function productRowsFor(
    paper
  ) {
    const table =
      findProductTable(
        paper
      );

    if (!table) {
      return [];
    }

    return Array.from(
      table.querySelectorAll(
        "tbody tr"
      )
    )
      .map(
        (
          row,
          rowIndex
        ) => {
          const cells =
            Array.from(
              row.querySelectorAll(
                "th,td"
              )
            )
              .map(
                cell =>
                  cleanText(
                    cell.textContent
                  )
              );

          if (
            cells.length < 3
          ) {
            return null;
          }

          const serial =
            rowIndex + 1;

          /*
           * If the receipt table itself has a dedicated
           * serial-number column, consume it rather than
           * treating it as Product.
           */

          if (
            cells.length >= 5
          ) {
            const serialCell =
              cells[0];

            const serialPattern =
              new RegExp(
                "^\s*" +
                String(
                  serial
                ) +
                "\s*[.)]?\s*$"
              );

            if (
              serialPattern.test(
                serialCell
              )
            ) {
              return {
                product:
                  stripExpectedSerial(
                    cells[1],
                    serial
                  ) ||
                  "Product",

                quantity:
                  cells[2] ||
                  "",

                unit:
                  cells[3] ||
                  "",

                amount:
                  cells[4] ||
                  ""
              };
            }
          }

          /*
           * Normal four-column structure.
           *
           * Product may already contain "1. Product".
           * Remove that row prefix before the canonical
           * renderer adds exactly one serial number.
           */

          return {
            product:
              stripExpectedSerial(
                cells[0],
                serial
              ) ||
              "Product",

            quantity:
              cells[1] ||
              "",

            unit:
              cells.length >= 4
                ? cells[2]
                : "",

            amount:
              cells.length >= 4
                ? cells[3]
                : cells[2]
          };
        }
      )
      .filter(
        Boolean
      );
  }

  function paymentFor(
    lines
  ) {
    const index =
      lines.findIndex(
        line =>
          line.toLowerCase() ===
          "payment"
      );

    if (
      index < 0
    ) {
      return {
        method:
          "",
        amount:
          ""
      };
    }

    return {
      method:
        lines[index + 1] ||
        "",

      amount:
        lines[index + 2] ||
        ""
    };
  }

  function buildReceiptModel(
    paper
  ) {
    const lines =
      textLines(
        paper
      );

    if (
      !lines.length
    ) {
      throw new Error(
        "Receipt content is empty."
      );
    }

    const products =
      productRowsFor(
        paper
      );

    if (
      !products.length
    ) {
      throw new Error(
        "Receipt product table could not be resolved."
      );
    }

    const payment =
      paymentFor(
        lines
      );

    const fullText =
      lines.join(
        "\n"
      );

    return {
      header:
        headerLinesFor(
          lines
        ),

      title:
        "SALES INVOICE",

      invoice:
        valueAfterLabel(
          lines,
          "Invoice"
        ),

      reference:
        valueAfterLabel(
          lines,
          "Reference"
        ) ||
        referenceForText(
          fullText
        ),

      date:
        valueAfterLabel(
          lines,
          "Date"
        ),

      cashier:
        valueAfterLabel(
          lines,
          "Cashier"
        ),

      customerName:
        valueAfterLabel(
          lines,
          "Customer Name"
        ) ||
        "-",

      customerTin:
        valueAfterLabel(
          lines,
          "Customer TIN"
        ) ||
        "-",

      products,

      subtotal:
        valueAfterLabel(
          lines,
          "Subtotal"
        ),

      discount:
        valueAfterLabel(
          lines,
          "Discount"
        ),

      tax:
        valueAfterLabel(
          lines,
          "Tax"
        ),

      total:
        valueAfterLabel(
          lines,
          "Total"
        ),

      paymentMethod:
        payment.method,

      paymentAmount:
        payment.amount,

      paid:
        valueAfterLabel(
          lines,
          "Paid"
        ),

      balance:
        valueAfterLabel(
          lines,
          "Balance"
        ),

      footer:
        "Thank you.",

      fullText
    };
  }

  /*
   * ==========================================================
   * DIRECT PDF GENERATOR
   * ==========================================================
   */

  function pdfText(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /\u00a0/g,
        " "
      )
      .replace(
        /[\u2018\u2019]/g,
        "'"
      )
      .replace(
        /[\u201c\u201d]/g,
        '"'
      )
      .replace(
        /[\u2013\u2014]/g,
        "-"
      )
      .replace(
        /\u2026/g,
        "..."
      )
      .replace(
        /[^\x20-\x7E]/g,
        "?"
      )
      .replace(
        /\\/g,
        "\\\\"
      )
      .replace(
        /\(/g,
        "\\("
      )
      .replace(
        /\)/g,
        "\\)"
      );
  }

  function estimatedWidth(
    value,
    size,
    bold
  ) {
    const factor =
      bold
        ? 0.55
        : 0.52;

    return (
      String(
        value || ""
      ).length *
      size *
      factor
    );
  }

  function wrapText(
    value,
    maxWidth,
    fontSize,
    bold
  ) {
    const source =
      cleanText(
        value
      );

    if (!source) {
      return [
        ""
      ];
    }

    const words =
      source.split(
        /\s+/
      );

    const lines = [];
    let current = "";

    function flush() {
      if (current) {
        lines.push(
          current
        );

        current = "";
      }
    }

    for (
      const originalWord of words
    ) {
      let word =
        originalWord;

      if (
        estimatedWidth(
          word,
          fontSize,
          bold
        ) >
        maxWidth
      ) {
        flush();

        let fragment = "";

        for (
          const character of word
        ) {
          const candidate =
            fragment +
            character;

          if (
            fragment &&
            estimatedWidth(
              candidate,
              fontSize,
              bold
            ) >
            maxWidth
          ) {
            lines.push(
              fragment
            );

            fragment =
              character;
          } else {
            fragment =
              candidate;
          }
        }

        current =
          fragment;

        continue;
      }

      const candidate =
        current
          ? current +
            " " +
            word
          : word;

      if (
        current &&
        estimatedWidth(
          candidate,
          fontSize,
          bold
        ) >
        maxWidth
      ) {
        lines.push(
          current
        );

        current =
          word;
      } else {
        current =
          candidate;
      }
    }

    flush();

    return lines.length
      ? lines
      : [
          source
        ];
  }

  function createLayout(
    model
  ) {
    const operations = [];

    const left =
      11;

    const right =
      PAGE_WIDTH_PT -
      11;

    let top =
      13;

    function addText(
      value,
      x,
      size,
      bold,
      align,
      customTop
    ) {
      operations.push({
        type:
          "text",

        value:
          String(
            value || ""
          ),

        x,

        top:
          typeof customTop ===
            "number"
            ? customTop
            : top,

        size,

        bold:
          Boolean(
            bold
          ),

        align:
          align ||
          "left"
      });
    }

    function separator() {
      operations.push({
        type:
          "line",

        x1:
          left,

        x2:
          right,

        top
      });

      top +=
        7;
    }

    function gap(
      value
    ) {
      top +=
        value;
    }

    function pair(
      label,
      value,
      boldValue
    ) {
      if (
        !label &&
        !value
      ) {
        return;
      }

      const size =
        String(
          value || ""
        ).length >
        24
          ? 5.4
          : 6.3;

      const valueLines =
        wrapText(
          value,
          125,
          size,
          boldValue !==
            false
        );

      addText(
        label,
        left,
        6.3,
        false,
        "left"
      );

      valueLines.forEach(
        (
          line,
          index
        ) => {
          addText(
            line,
            right,
            size,
            boldValue !==
              false,
            "right",
            top +
            index *
              7.1
          );
        }
      );

      top +=
        Math.max(
          9,
          valueLines.length *
            7.1 +
            1
        );
    }

    const header =
      Array.isArray(
        model.header
      )
        ? model.header
        : [];

    header.forEach(
      (
        value,
        index
      ) => {
        addText(
          value,
          PAGE_WIDTH_PT /
            2,
          index === 0
            ? 8.4
            : (
                index === 1
                  ? 7.2
                  : 6.2
              ),
          index < 2,
          "center"
        );

        top +=
          index === 0
            ? 10
            : 8;
      }
    );

    gap(
      2
    );

    separator();

    addText(
      model.title ||
        "SALES INVOICE",
      PAGE_WIDTH_PT /
        2,
      8.4,
      true,
      "center"
    );

    top +=
      10;

    separator();

    pair(
      "Invoice",
      model.invoice
    );

    pair(
      "Reference",
      model.reference
    );

    pair(
      "Date",
      model.date,
      false
    );

    pair(
      "Cashier",
      model.cashier,
      false
    );

    separator();

    pair(
      "Customer Name",
      model.customerName,
      false
    );

    pair(
      "Customer TIN",
      model.customerTin,
      false
    );

    separator();

    const productX =
      left;

    const productWidth =
      117;

    const qtyX =
      147;

    const unitX =
      181;

    const amountX =
      right;

    addText(
      "Product",
      productX,
      6.3,
      true,
      "left"
    );

    addText(
      "Qty",
      qtyX,
      6.3,
      true,
      "center"
    );

    addText(
      "Unit",
      unitX,
      6.3,
      true,
      "right"
    );

    addText(
      "Amount",
      amountX,
      6.3,
      true,
      "right"
    );

    top +=
      8;

    separator();

    model.products.forEach(
      (
        item,
        index
      ) => {
        const productName =
          `${index + 1}. ${cleanText(
            item.product
          )}`;

        const productLines =
          wrapText(
            productName,
            productWidth,
            6.1,
            false
          );

        const rowTop =
          top;

        productLines.forEach(
          (
            line,
            lineIndex
          ) => {
            addText(
              line,
              productX,
              6.1,
              false,
              "left",
              rowTop +
              lineIndex *
                7.3
            );
          }
        );

        addText(
          item.quantity,
          qtyX,
          6.1,
          false,
          "center",
          rowTop
        );

        addText(
          item.unit,
          unitX,
          6.1,
          false,
          "right",
          rowTop
        );

        addText(
          item.amount,
          amountX,
          6.1,
          false,
          "right",
          rowTop
        );

        top +=
          Math.max(
            9,
            productLines.length *
              7.3 +
              2
          );
      }
    );

    gap(
      2
    );

    pair(
      "Subtotal",
      model.subtotal
    );

    pair(
      "Discount",
      model.discount
    );

    pair(
      "Tax",
      model.tax
    );

    separator();

    addText(
      "Total",
      left,
      7.3,
      true,
      "left"
    );

    addText(
      model.total,
      right,
      7.3,
      true,
      "right"
    );

    top +=
      11;

    gap(
      2
    );

    addText(
      "Payment",
      left,
      6.6,
      true,
      "left"
    );

    top +=
      9;

    if (
      model.paymentMethod ||
      model.paymentAmount
    ) {
      addText(
        model.paymentMethod,
        left,
        6.2,
        false,
        "left"
      );

      addText(
        model.paymentAmount,
        right,
        6.2,
        true,
        "right"
      );

      top +=
        9;
    }

    pair(
      "Paid",
      model.paid
    );

    pair(
      "Balance",
      model.balance
    );

    separator();

    addText(
      model.footer ||
        "Thank you.",
      PAGE_WIDTH_PT /
        2,
      6.4,
      false,
      "center"
    );

    top +=
      12;

    return {
      operations,

      height:
        Math.max(
          220,
          top +
          8
        )
    };
  }

  function buildPdfFromModel(
    model
  ) {
    const layout =
      createLayout(
        model
      );

    const pageHeight =
      layout.height;

    const commands = [];

    layout.operations.forEach(
      operation => {
        if (
          operation.type ===
          "text"
        ) {
          const value =
            String(
              operation.value ||
              ""
            );

          const width =
            estimatedWidth(
              value,
              operation.size,
              operation.bold
            );

          let x =
            operation.x;

          if (
            operation.align ===
            "right"
          ) {
            x -=
              width;
          } else if (
            operation.align ===
            "center"
          ) {
            x -=
              width /
              2;
          }

          const y =
            pageHeight -
            operation.top -
            operation.size;

          const font =
            operation.bold
              ? "F2"
              : "F1";

          commands.push(
            [
              "BT",
              `/${font} ${operation.size.toFixed(2)} Tf`,
              `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
              `(${pdfText(value)}) Tj`,
              "ET"
            ].join(
              "\n"
            )
          );

          return;
        }

        if (
          operation.type ===
          "line"
        ) {
          const y =
            pageHeight -
            operation.top;

          commands.push(
            [
              "[2 2] 0 d",
              "0.45 w",
              `${operation.x1.toFixed(2)} ${y.toFixed(2)} m`,
              `${operation.x2.toFixed(2)} ${y.toFixed(2)} l`,
              "S",
              "[] 0 d"
            ].join(
              "\n"
            )
          );
        }
      }
    );

    const content =
      commands.join(
        "\n"
      ) +
      "\n";

    const objects = [
      (
        "1 0 obj\n" +
        "<< /Type /Catalog /Pages 2 0 R >>\n" +
        "endobj\n"
      ),

      (
        "2 0 obj\n" +
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
        "endobj\n"
      ),

      (
        "3 0 obj\n" +
        "<< /Type /Page " +
        "/Parent 2 0 R " +
        `/MediaBox [0 0 ${PAGE_WIDTH_PT.toFixed(3)} ${pageHeight.toFixed(3)}] ` +
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> " +
        "/Contents 6 0 R >>\n" +
        "endobj\n"
      ),

      (
        "4 0 obj\n" +
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n" +
        "endobj\n"
      ),

      (
        "5 0 obj\n" +
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n" +
        "endobj\n"
      ),

      (
        "6 0 obj\n" +
        `<< /Length ${content.length} >>\n` +
        "stream\n" +
        content +
        "endstream\n" +
        "endobj\n"
      )
    ];

    let pdf =
      "%PDF-1.4\n" +
      "%UBUZIMA-R4-REV1\n";

    const offsets = [
      0
    ];

    objects.forEach(
      object => {
        offsets.push(
          pdf.length
        );

        pdf +=
          object;
      }
    );

    const xref =
      pdf.length;

    pdf +=
      "xref\n" +
      "0 7\n" +
      "0000000000 65535 f \n";

    for (
      let index = 1;
      index <= 6;
      index += 1
    ) {
      pdf +=
        String(
          offsets[index]
        )
          .padStart(
            10,
            "0"
          ) +
        " 00000 n \n";
    }

    pdf +=
      "trailer\n" +
      "<< /Size 7 /Root 1 0 R >>\n" +
      "startxref\n" +
      xref +
      "\n" +
      "%%EOF\n";

    return new TextEncoder()
      .encode(
        pdf
      );
  }

  function makeFile(
    blob,
    filename
  ) {
    if (
      typeof File !==
        "function"
    ) {
      return null;
    }

    return new File(
      [
        blob
      ],
      filename,
      {
        type:
          "application/pdf",

        lastModified:
          Date.now()
      }
    );
  }

  function buildCanonicalDocument(
    paper
  ) {
    const model =
      buildReceiptModel(
        paper
      );

    const bytes =
      buildPdfFromModel(
        model
      );

    const blob =
      new Blob(
        [
          bytes
        ],
        {
          type:
            "application/pdf"
        }
      );

    const filename =
      filenameForText(
        model.fullText
      );

    return {
      model,

      reference:
        referenceForText(
          model.fullText
        ),

      filename,

      pdfBlob:
        blob,

      file:
        makeFile(
          blob,
          filename
        )
    };
  }

  function savePdf(
    blob,
    filename
  ) {
    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      filename;

    anchor.style.display =
      "none";

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    window.setTimeout(
      () => {
        URL.revokeObjectURL(
          url
        );
      },
      2000
    );
  }

  /*
   * ==========================================================
   * HARD COPY
   *
   * Uses the SAME receipt model as the PDF.
   *
   * It prints a fully-rendered HTML document rather than
   * depending on a PDF viewer iframe.
   * ==========================================================
   */

  function htmlEscape(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      );
  }

  function receiptPrintHtml(
    model,
    filename
  ) {
    const header =
      model.header
        .map(
          (
            value,
            index
          ) => {
            if (
              index === 0
            ) {
              return (
                '<div class="pharmacy-name">' +
                htmlEscape(
                  value
                ) +
                "</div>"
              );
            }

            if (
              index === 1
            ) {
              return (
                '<div class="branch-name">' +
                htmlEscape(
                  value
                ) +
                "</div>"
              );
            }

            return (
              "<div>" +
              htmlEscape(
                value
              ) +
              "</div>"
            );
          }
        )
        .join(
          ""
        );

    const products =
      model.products
        .map(
          (
            item,
            index
          ) => (
            "<tr>" +

            '<td class="product">' +
            '<span class="product-index">' +
            String(
              index + 1
            ) +
            ".</span> " +

            '<span class="product-name">' +
            htmlEscape(
              item.product
            ) +
            "</span>" +
            "</td>" +

            '<td class="qty">' +
            htmlEscape(
              item.quantity
            ) +
            "</td>" +

            '<td class="unit">' +
            htmlEscape(
              item.unit
            ) +
            "</td>" +

            '<td class="amount">' +
            htmlEscape(
              item.amount
            ) +
            "</td>" +

            "</tr>"
          )
        )
        .join(
          ""
        );

    function pair(
      label,
      value,
      extraClass
    ) {
      return (
        '<div class="pair ' +
        (
          extraClass ||
          ""
        ) +
        '">' +

        "<span>" +
        htmlEscape(
          label
        ) +
        "</span>" +

        "<strong>" +
        htmlEscape(
          value
        ) +
        "</strong>" +

        "</div>"
      );
    }

    return (
`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${htmlEscape(filename)}</title>

<style>

@page {
  size: 80mm;
  margin: 0;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0 !important;
  padding: 0 !important;

  width: 80mm !important;

  background: #ffffff !important;
  color: #111111 !important;
}

body {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: 8.5pt;
  line-height: 1.25;

  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.receipt {
  width: 76mm;

  margin: 0 auto;

  padding:
    3mm
    2mm
    4mm;

  background: #ffffff;
}

.header {
  text-align: center;
}

.header > div {
  margin: 1px 0;
}

.pharmacy-name {
  font-size: 12pt;
  font-weight: 800;
}

.branch-name {
  font-size: 9.5pt;
  font-weight: 700;
}

.rule {
  width: 100%;

  border-top:
    1px
    dashed
    #111;

  margin:
    7px
    0;
}

.title {
  text-align: center;

  font-size: 10.5pt;
  line-height: 1.2;

  font-weight: 800;

  letter-spacing: 0.02em;
}

.pair {
  width: 100%;

  display: flex;

  align-items: flex-start;
  justify-content: space-between;

  gap: 8px;

  margin:
    3px
    0;
}

.pair > span {
  flex:
    0
    0
    auto;
}

.pair > strong {
  min-width: 0;
  max-width: 68%;

  text-align: right;

  white-space: normal;

  overflow-wrap: anywhere;
  word-break: normal;
}

.customer strong {
  font-weight: 500;
}

table {
  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;
}

col.product-column {
  width: 58%;
}

col.qty-column {
  width: 10%;
}

col.unit-column {
  width: 14%;
}

col.amount-column {
  width: 18%;
}

th,
td {
  padding:
    2.5px
    1px;

  vertical-align: top;
}

th {
  font-size: 8pt;
  font-weight: 800;

  border-bottom:
    1px
    dashed
    #111;
}

th:first-child {
  text-align: left;
}

th:not(:first-child) {
  text-align: right;
}

td {
  font-size: 8pt;
}

td.product {
  min-width: 0;

  padding-right: 4px;

  white-space: normal !important;

  overflow-wrap: anywhere !important;
  word-wrap: break-word !important;
  word-break: normal !important;
}

.product-name {
  white-space: normal !important;

  overflow-wrap: anywhere !important;
  word-wrap: break-word !important;
  word-break: normal !important;
}

td.qty,
td.unit,
td.amount {
  text-align: right;
  white-space: nowrap;
}

.total {
  font-size: 9.2pt;
}

.total strong {
  font-size: 10pt;
}

.payment-title {
  margin-top: 6px;

  font-weight: 800;
}

.payment-row {
  margin-top: 3px;
}

.thank-you {
  text-align: center;

  margin-top: 5px;
}

@media print {
  html,
  body {
    width: 80mm !important;
  }

  .receipt {
    box-shadow: none !important;
  }
}

</style>
</head>

<body>

<div class="receipt">

  <div class="header">
    ${header}
  </div>

  <div class="rule"></div>

  <div class="title">
    ${htmlEscape(model.title)}
  </div>

  <div class="rule"></div>

  ${pair("Invoice", model.invoice)}
  ${pair("Reference", model.reference)}
  ${pair("Date", model.date)}
  ${pair("Cashier", model.cashier)}

  <div class="rule"></div>

  ${pair(
    "Customer Name",
    model.customerName,
    "customer"
  )}

  ${pair(
    "Customer TIN",
    model.customerTin,
    "customer"
  )}

  <div class="rule"></div>

  <table>

    <colgroup>
      <col class="product-column">
      <col class="qty-column">
      <col class="unit-column">
      <col class="amount-column">
    </colgroup>

    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Unit</th>
        <th>Amount</th>
      </tr>
    </thead>

    <tbody>
      ${products}
    </tbody>

  </table>

  ${pair("Subtotal", model.subtotal)}
  ${pair("Discount", model.discount)}
  ${pair("Tax", model.tax)}

  <div class="rule"></div>

  ${pair(
    "Total",
    model.total,
    "total"
  )}

  <div class="payment-title">
    Payment
  </div>

  ${
    (
      model.paymentMethod ||
      model.paymentAmount
    )
      ? pair(
          model.paymentMethod,
          model.paymentAmount,
          "payment-row"
        )
      : ""
  }

  ${pair("Paid", model.paid)}
  ${pair("Balance", model.balance)}

  <div class="rule"></div>

  <div class="thank-you">
    ${htmlEscape(model.footer)}
  </div>

</div>

</body>
</html>`
    );
  }

  function waitForFramePaint(
    frameWindow
  ) {
    return new Promise(
      resolve => {
        const raf =
          frameWindow.requestAnimationFrame ||
          window.requestAnimationFrame;

        if (
          typeof raf !==
            "function"
        ) {
          window.setTimeout(
            resolve,
            150
          );

          return;
        }

        raf.call(
          frameWindow,
          () => {
            raf.call(
              frameWindow,
              () => {
                window.setTimeout(
                  resolve,
                  120
                );
              }
            );
          }
        );
      }
    );
  }

  const LEGACY_RECEIPT_ACTION_SELECTOR =
    [
      "[data-receipt-hard-copy]",
      "[data-receipt-hardcopy]",
      "[data-receipt-whatsapp]",
      "[data-receipt-email]"
    ].join(",");

  const DOWNLOAD_RECEIPT_ACTION_SELECTOR =
    "[data-receipt-download]";

  const DOWNLOAD_STYLE_ID =
    "ubuzima-r4-rev4-download-action";

  /*
   * ==========================================================
   * DOWNLOAD UI
   * ==========================================================
   */

  function installDownloadActionStyle() {
    if (
      !document ||
      !document.head
    ) {
      return;
    }

    if (
      document.getElementById(
        DOWNLOAD_STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      DOWNLOAD_STYLE_ID;

    style.textContent = `
      [data-ubuzima-receipt-content-v5-dialog="1"]
      [data-receipt-hard-copy],

      [data-ubuzima-receipt-content-v5-dialog="1"]
      [data-receipt-hardcopy],

      [data-ubuzima-receipt-content-v5-dialog="1"]
      [data-receipt-whatsapp],

      [data-ubuzima-receipt-content-v5-dialog="1"]
      [data-receipt-email] {
        display: none !important;
      }

      [data-ubuzima-receipt-content-v5-dialog="1"]
      [data-receipt-download] {
        cursor: pointer;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function receiptDialogs() {
    return Array.from(
      document.querySelectorAll(
        [
          '[data-ubuzima-receipt-content-v5-dialog="1"]',
          '[role="dialog"]'
        ].join(",")
      )
    )
      .filter(
        dialog =>
          dialog.querySelector(
            "[data-receipt-paper]"
          )
      );
  }

  const LEGACY_RECEIPT_ACTION_LABELS =
    new Set(
      [
        "hard copy print",
        "hard copy",
        "hard copy pdf",
        "whatsapp pdf",
        "email pdf"
      ]
    );

  function normalizedButtonLabel(
    element
  ) {
    return String(
      element &&
      (
        element.innerText ||
        element.textContent ||
        element.value ||
        ""
      )
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .toLowerCase();
  }

  function isLegacyReceiptAction(
    element
  ) {
    if (!element) {
      return false;
    }

    if (
      typeof element.matches ===
        "function" &&
      element.matches(
        LEGACY_RECEIPT_ACTION_SELECTOR
      )
    ) {
      return true;
    }

    return LEGACY_RECEIPT_ACTION_LABELS.has(
      normalizedButtonLabel(
        element
      )
    );
  }

  function legacyReceiptActions(
    dialog
  ) {
    return Array.from(
      dialog.querySelectorAll(
        [
          "button",
          '[role="button"]',
          "a"
        ].join(",")
      )
    )
      .filter(
        element =>
          isLegacyReceiptAction(
            element
          )
      );
  }

  function ensureDownloadAction() {
    installDownloadActionStyle();

    receiptDialogs()
      .forEach(
        dialog => {
          let legacyButtons =
            legacyReceiptActions(
              dialog
            );

          let downloadButton =
            dialog.querySelector(
              DOWNLOAD_RECEIPT_ACTION_SELECTOR
            );

          if (
            !downloadButton &&
            legacyButtons.length
          ) {
            const template =
              legacyButtons[0];

            downloadButton =
              template.cloneNode(
                true
              );

            [
              "data-receipt-hard-copy",
              "data-receipt-hardcopy",
              "data-receipt-whatsapp",
              "data-receipt-email"
            ]
              .forEach(
                attribute => {
                  downloadButton.removeAttribute(
                    attribute
                  );
                }
              );

            downloadButton.setAttribute(
              "data-receipt-download",
              "1"
            );

            downloadButton.setAttribute(
              "type",
              "button"
            );

            downloadButton.removeAttribute(
              "disabled"
            );

            downloadButton.textContent =
              "Download";

            downloadButton.title =
              "Download receipt PDF";

            if (
              template.parentNode
            ) {
              template.parentNode.insertBefore(
                downloadButton,
                template
              );
            }
          }

          /*
           * Remove every old action by BOTH:
           * 1. receipt data attribute
           * 2. exact visible label
           */

          legacyButtons =
            legacyReceiptActions(
              dialog
            );

          legacyButtons.forEach(
            button => {
              if (
                button ===
                downloadButton
              ) {
                return;
              }

              try {
                button.remove();
              } catch (_) {}
            }
          );

          /*
           * Guarantee exactly one Download action.
           */

          const downloads =
            Array.from(
              dialog.querySelectorAll(
                DOWNLOAD_RECEIPT_ACTION_SELECTOR
              )
            );

          downloads.forEach(
            (
              button,
              index
            ) => {
              if (
                index > 0
              ) {
                try {
                  button.remove();
                } catch (_) {}

                return;
              }

              if (
                button.textContent !==
                "Download"
              ) {
                button.textContent =
                  "Download";
              }

              button.title =
                "Download receipt PDF";
            }
          );
        }
      );
  }

  let downloadActionObserver =
    null;

  function installDownloadActionObserver() {
    if (
      downloadActionObserver ||
      typeof MutationObserver !==
        "function" ||
      !document.body
    ) {
      return;
    }

    downloadActionObserver =
      new MutationObserver(
        mutations => {
          let relevant =
            false;

          for (
            const mutation of mutations
          ) {
            if (
              mutation.type ===
                "childList" &&
              (
                mutation.addedNodes.length ||
                mutation.removedNodes.length
              )
            ) {
              relevant =
                true;

              break;
            }
          }

          if (!relevant) {
            return;
          }

          window.setTimeout(
            ensureDownloadAction,
            0
          );
        }
      );

    downloadActionObserver.observe(
      document.body,
      {
        childList:
          true,

        subtree:
          true
      }
    );
  }

  function scheduleDownloadActionSync() {
    window.setTimeout(
      ensureDownloadAction,
      0
    );

    if (
      typeof window.requestAnimationFrame ===
        "function"
    ) {
      window.requestAnimationFrame(
        () => {
          ensureDownloadAction();
        }
      );
    }

    window.setTimeout(
      ensureDownloadAction,
      120
    );
  }

  /*
   * ==========================================================
   * DOWNLOAD PDF
   * ==========================================================
   */

  function downloadCanonicalPdf(
    button
  ) {
    setStatus(
      button,
      "Preparing PDF download...",
      "working"
    );

    const paper =
      receiptPaper(
        button
      );

    const documentData =
      buildCanonicalDocument(
        paper
      );

    if (
      !documentData ||
      !documentData.pdfBlob ||
      !documentData.filename
    ) {
      throw new Error(
        "Receipt PDF could not be generated."
      );
    }

    if (
      documentData.pdfBlob.type !==
      "application/pdf"
    ) {
      throw new Error(
        "Generated receipt is not a PDF document."
      );
    }

    savePdf(
      documentData.pdfBlob,
      documentData.filename
    );

    setStatus(
      button,
      `${documentData.filename} downloaded.`,
      "ready"
    );
  }

  function receiptDownloadAction(
    event
  ) {
    const target =
      event.target;

    if (
      !target ||
      typeof target.closest !==
        "function"
    ) {
      return null;
    }

    return target.closest(
      DOWNLOAD_RECEIPT_ACTION_SELECTOR
    );
  }

  document.addEventListener(
    "click",
    event => {
      const button =
        receiptDownloadAction(
          event
        );

      if (!button) {
        scheduleDownloadActionSync();
        return;
      }

      if (
        button.disabled
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        downloadCanonicalPdf(
          button
        );
      } catch (error) {
        console.error(
          "Receipt PDF download failed:",
          error
        );

        setStatus(
          button,
          (
            "PDF could not be downloaded: " +
            (
              error instanceof Error
                ? error.message
                : "Unknown error"
            )
          ),
          "error"
        );
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    () => {
      installCartWrapStyle();
      scheduleDownloadActionSync();
    },
    true
  );

  document.addEventListener(
    "focusin",
    () => {
      installCartWrapStyle();
      scheduleDownloadActionSync();
    },
    true
  );

  installCartWrapStyle();
  installDownloadActionStyle();
  installDownloadActionObserver();
  scheduleDownloadActionSync();

  window.__UBUZIMA_RECEIPT_PDF_TEST__ =
    Object.freeze({
      version:
        VERSION,

      receiptPrintHtml,
      buildPdfFromModel,
      createLayout,
      wrapText,
      stripExpectedSerial,
      filenameForText,
      referenceForText
    });

  console.log(
    "Ubuzima+ receipt PDF R4 Rev5 active",
    VERSION
  );
})();
