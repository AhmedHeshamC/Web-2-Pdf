// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "printToPDF") {
    printCurrentTabToPDF(request.options)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

async function printCurrentTabToPDF(options = {}) {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.url.startsWith("http")) {
      throw new Error("Invalid tab: Only HTTP/HTTPS pages supported.");
    }

    // Attach debugger
    await chrome.debugger.attach({ tabId: tab.id }, "1.3");

    // Set large viewport to force full rendering
    await chrome.debugger.sendCommand(
      { tabId: tab.id },
      "Emulation.setDeviceMetricsOverride",
      {
        width: 1200,
        height: 10000, // Large height to render all content
        deviceScaleFactor: 1,
        mobile: false,
      },
    );

    // Scroll to load all lazy content
    await scrollToLoadAllContent(tab.id);

    // Paper size dimensions (in inches)
    const paperSizes = {
      A4: { width: 8.27, height: 11.69 },
      Letter: { width: 8.5, height: 11 },
      Legal: { width: 8.5, height: 14 },
    };
    let paperWidth = paperSizes[options.paperSize]?.width || 8.27;
    let paperHeight = paperSizes[options.paperSize]?.height || 11.69;

    // Orientation
    if (options.orientation === "landscape") {
      [paperWidth, paperHeight] = [paperHeight, paperWidth];
    }

    // Inject CSS for organization (headers/footers/page numbers)
    const css = `
      @page {
        size: ${options.paperSize || "A4"} ${options.orientation || "portrait"};
        margin: ${options.marginTop || 0.4}in ${options.marginRight || 0.4}in ${options.marginBottom || 0.4}in ${options.marginLeft || 0.4}in;
        @top-center { content: "${tab.title} - ${tab.url}"; font-size: 10pt; }
        @bottom-center { content: counter(page) " of " counter(pages); font-size: 10pt; }
        @bottom-right { content: "${new Date().toLocaleDateString()}"; font-size: 10pt; }
      }
      @media print {
        html, body {
          height: auto !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        * {
          overflow: visible !important;
        }
      }
      body { margin: 0; height: auto; overflow: visible; } /* Ensure full page rendering */
    `;
    await chrome.debugger.sendCommand(
      { tabId: tab.id },
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `const style = document.createElement('style'); style.textContent = \`${css}\`; document.head.appendChild(style);`,
      },
    );

    // Generate PDF with user settings
    const pdfData = await chrome.debugger.sendCommand(
      { tabId: tab.id },
      "Page.printToPDF",
      {
        printBackground: options.includeBackground !== false, // Default true
        paperWidth,
        paperHeight,
        marginTop: options.marginTop || 0.4,
        marginBottom: options.marginBottom || 0.4,
        marginLeft: options.marginLeft || 0.4,
        marginRight: options.marginRight || 0.4,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        generateDocumentOutline: options.generateOutline !== false, // Default true
        generateTaggedPDF: true,
      },
    );

    // Reset emulation
    try {
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Emulation.clearDeviceMetricsOverride",
      );
    } catch {}

    // Detach debugger
    await chrome.debugger.detach({ tabId: tab.id });

    // Download PDF
    const dataUrl = `data:application/pdf;base64,${pdfData.data}`;
    const filename =
      options.filename || `${tab.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: options.promptSave || false,
    });
    return { success: true };
  } catch (error) {
    // Ensure debugger is detached on error
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      await chrome.debugger.detach({ tabId: tab.id });
    } catch {}
    throw error;
  }
}

async function scrollToLoadAllContent(tabId) {
  try {
    let previousHeight = 0;
    let currentHeight = 0;
    const maxScrolls = 100; // Prevent infinite loops
    let scrollCount = 0;

    do {
      previousHeight = currentHeight;

      // Scroll to bottom
      await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: "window.scrollTo(0, document.body.scrollHeight);",
      });

      // Wait a bit for content to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get new height
      const result = await chrome.debugger.sendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: "document.body.scrollHeight",
        },
      );
      currentHeight = result.result.value;

      scrollCount++;
    } while (currentHeight > previousHeight && scrollCount < maxScrolls);

    // Scroll back to top for consistent printing
    await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
      expression: "window.scrollTo(0, 0);",
    });
  } catch (error) {
    console.warn("Scrolling failed, proceeding with PDF generation:", error);
    // Continue without scrolling if it fails
  }
}
