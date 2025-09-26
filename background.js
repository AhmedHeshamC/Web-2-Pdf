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

// Anti-bot detection bypass script
const bypassScript = `
  // Remove common anti-bot protections
  (function() {
    // Disable event listeners that prevent actions
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'contextmenu' || type === 'keydown' || type === 'beforeprint' || type === 'print') {
        return; // Block these listeners
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    // Remove existing protection listeners
    document.removeEventListener('contextmenu', null);
    document.removeEventListener('keydown', null);
    document.removeEventListener('beforeprint', null);

    // Override print prevention
    window.print = function() { return true; };

    // Remove CSS that hides content on print
    const style = document.createElement('style');
    style.textContent = '@media print { * { display: block !important; visibility: visible !important; } }';
    document.head.appendChild(style);

    // Disable lazy loading protections
    Object.defineProperty(window, 'IntersectionObserver', {
      value: class {
        constructor() { this.callback = () => {}; }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    });
  })();
`;

// DOM content extraction fallback
async function extractDOMContent(tabId) {
  try {
    const result = await chrome.debugger.sendCommand(
      tabId,
      "Runtime.evaluate",
      {
        expression: `
        (function() {
          const elements = document.querySelectorAll('*');
          let content = '<html><head><title>' + document.title + '</title></head><body>';
          for (let el of elements) {
            if (el.tagName && el.textContent && el.offsetParent !== null) {
              content += '<' + el.tagName.toLowerCase() + '>' + el.textContent + '</' + el.tagName.toLowerCase() + '>';
            }
          }
          content += '</body></html>';
          return content;
        })()
      `,
      },
    );
    return result.result.value;
  } catch (error) {
    console.warn("DOM extraction failed:", error);
    return null;
  }
}

async function printCurrentTabToPDF(options = {}) {
  let tabId = null;
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.url.startsWith("http")) {
      throw new Error("Invalid tab: Only HTTP/HTTPS pages supported.");
    }
    tabId = tab.id;

    // Attach debugger
    await chrome.debugger.attach({ tabId }, "1.3");

    // Inject anti-bot bypass script
    await chrome.debugger.sendCommand(
      tabId,
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: bypassScript,
      },
    );

    // Enable page domain for better control
    await chrome.debugger.sendCommand(tabId, "Page.enable");

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

    // Inject additional bypass script after page loads
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Runtime.evaluate", {
      expression: `
          (function() {
            // Force remove all event listeners and protections
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
              try {
                const newEl = el.cloneNode(true);
                if (el.parentNode) {
                  el.parentNode.replaceChild(newEl, el);
                }
              } catch (e) {
                // Fallback: remove event handlers
                el.onclick = null;
                el.oncopy = null;
                el.oncut = null;
                el.onpaste = null;
                el.oncontextmenu = null;
                el.onselectstart = null;
                el.ondragstart = null;
                el.onselect = null;
                el.onkeydown = null;
                el.onkeyup = null;
                el.onkeypress = null;
              }
            });

            // Remove all iframes
            document.querySelectorAll('iframe').forEach(iframe => iframe.remove());

            // Remove overlays
            document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]').forEach(el => {
              if (window.getComputedStyle(el).zIndex > 100) {
                el.remove();
              }
            });

            // Force enable selection
            document.body.style.userSelect = 'text';
            document.body.style.webkitUserSelect = 'text';
          })();
        `,
    });

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

    // Inject CSS for organization (headers/footers/page numbers) and anti-print protections
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

      /* Anti-print protection overrides */
      * {
        visibility: visible !important;
        display: block !important;
        position: static !important;
        opacity: 1 !important;
        color: black !important;
        background: white !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        pointer-events: auto !important;
        cursor: auto !important;
      }

      /* Remove overlays and watermarks */
      .watermark, .print-block, .no-print, .anti-print, [class*="watermark"], [class*="print-block"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Remove fixed position elements that might block content */
      .fixed, [style*="position: fixed"], [style*="position:fixed"] {
        position: absolute !important;
      }

      /* Ensure all content is visible */
      .hidden, [hidden], [style*="display: none"], [style*="display:none"] {
        display: block !important;
        visibility: visible !important;
      }

      /* Remove content protection */
      .protected, .protected-content, .no-export, .no-download {
        pointer-events: none !important;
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      /* Override print-specific hiding */
      @media print {
        * {
          display: block !important;
          visibility: visible !important;
        }
        .no-print, .print-hidden, [class*="no-print"] {
          display: none !important;
        }
      }
    `;
    // Aggressive anti-print bypass script
    const bypassScript = `
      (function() {
        'use strict';

        // Immediate CSS injection
        const style = document.createElement('style');
        style.textContent = \`${css}\`;
        (document.head || document.documentElement).appendChild(style);

        // Override everything immediately
        function overrideEverything() {
          // Disable all print-related events
          window.print = function() { return true; };
          window.onbeforeprint = null;
          window.onafterprint = null;
          document.onbeforeprint = null;
          document.onafterprint = null;

          // Disable all blocking events
          document.oncontextmenu = null;
          document.onselectstart = null;
          document.onmousedown = null;
          document.onmouseup = null;
          document.oncopy = null;
          document.oncut = null;
          document.onpaste = null;
          document.ondragstart = null;
          document.onselect = null;

          // Override addEventListener to block print prevention
          const originalAddEventListener = EventTarget.prototype.addEventListener;
          EventTarget.prototype.addEventListener = function(type, listener, options) {
            const blockedTypes = ['beforeprint', 'afterprint', 'contextmenu', 'selectstart', 'copy', 'cut', 'paste', 'dragstart', 'select', 'keydown', 'keyup', 'keypress'];
            if (blockedTypes.includes(type)) {
              return;
            }
            return originalAddEventListener.call(this, type, listener, options);
          };

          // Block key combinations that might prevent printing
          document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'c' || e.key === 'a')) {
              e.stopPropagation();
              e.stopImmediatePropagation();
              if (e.key === 'a') return false; // Prevent select all blocking
            }
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          }, true);

          // Force remove all event listeners
          const allElements = document.querySelectorAll('*');
          allElements.forEach(el => {
            try {
              const clone = el.cloneNode(true);
              el.parentNode.replaceChild(clone, el);
            } catch (e) {
              // If cloning fails, just remove specific event handlers
              el.oncopy = null;
              el.oncut = null;
              el.onpaste = null;
              el.oncontextmenu = null;
              el.onselectstart = null;
              el.ondragstart = null;
              el.onselect = null;
              el.onkeydown = null;
              el.onkeyup = null;
            }
          });

          // Remove problematic elements
          setTimeout(() => {
            // Remove iframes that might contain protection scripts
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
              try {
                iframe.remove();
              } catch (e) {
                iframe.style.display = 'none';
              }
            });

            // Remove overlays and watermarks
            const elementsToRemove = document.querySelectorAll('*');
            elementsToRemove.forEach(el => {
              const style = window.getComputedStyle(el);
              if (style.position === 'fixed' || style.position === 'absolute') {
                if (style.zIndex > 1000 || el.classList.contains('watermark') ||
                    el.classList.contains('overlay') || el.classList.contains('no-print') ||
                    el.classList.contains('print-block') || el.classList.contains('anti-print')) {
                  el.style.display = 'none';
                  el.style.visibility = 'hidden';
                  el.style.opacity = '0';
                }
              }
            });

            // Force content selection
            document.body.style.userSelect = 'text';
            document.body.style.webkitUserSelect = 'text';
            document.body.style.mozUserSelect = 'text';
            document.body.style.msUserSelect = 'text';
          }, 500);
        }

        // Run immediately and again after DOM loads
        overrideEverything();
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', overrideEverything);
        } else {
          overrideEverything();
        }

        // Run again after a delay to catch late-loading protections
        setTimeout(overrideEverything, 1000);
        setTimeout(overrideEverything, 2000);
      })();
    `;

    await chrome.debugger.sendCommand(
      { tabId: tab.id },
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: bypassScript,
      },
    );

    // Aggressive content extraction for heavily protected SPAs
    let extractedData = null;
    let methodUsed = "";

    // Method 1: Try direct PDF generation first
    try {
      // Attempt PDF generation with multiple fallbacks
      let pdfData = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (!pdfData && attempts < maxAttempts) {
        try {
          pdfData = await chrome.debugger.sendCommand(
            tabId,
            "Page.printToPDF",
            {
              printBackground: options.includeBackground !== false,
              paperWidth,
              paperHeight,
              marginTop: options.marginTop || 0.4,
              marginBottom: options.marginBottom || 0.4,
              marginLeft: options.marginLeft || 0.4,
              marginRight: options.marginRight || 0.4,
              preferCSSPageSize: false,
              displayHeaderFooter: false,
              generateDocumentOutline: options.generateOutline !== false,
              generateTaggedPDF: true,
            },
          );
        } catch (error) {
          console.warn(`PDF generation attempt ${attempts + 1} failed:`, error);
          if (attempts === 0) {
            // First failure: try without tagged PDF
            await chrome.debugger.sendCommand(tabId, "Page.printToPDF", {
              printBackground: options.includeBackground !== false,
              paperWidth,
              paperHeight,
              marginTop: options.marginTop || 0.4,
              marginBottom: options.marginBottom || 0.4,
              marginLeft: options.marginLeft || 0.4,
              marginRight: options.marginRight || 0.4,
              preferCSSPageSize: false,
              displayHeaderFooter: false,
              generateDocumentOutline: false,
              generateTaggedPDF: false,
            });
          } else if (attempts === 1) {
            // Second failure: try DOM extraction fallback
            const htmlContent = await extractDOMContent(tabId);
            if (htmlContent) {
              // Create a simple PDF from extracted content (placeholder)
              console.log("Using DOM extraction fallback");
              // Note: Full implementation would require additional PDF creation logic
            }
          }
          attempts++;
        }
      }

      if (!pdfData) {
        throw new Error("All PDF generation methods failed");
      }

      // Direct PDF succeeded
      const dataUrl = `data:application/pdf;base64,${pdfData.data}`;
      const filename =
        options.filename || `${tab.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      await chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs: options.promptSave || false,
      });
      return { success: true, method: "Direct PDF generation" };
    } catch (pdfError) {
      console.log("Direct PDF failed, trying content extraction...");

      // Method 2: Aggressive DOM content extraction
      try {
        extractedData = await chrome.debugger.sendCommand(
          { tabId: tab.id },
          "Runtime.evaluate",
          {
            expression: `
              (function() {
                // Node type constants
                const ELEMENT_NODE = 1;
                const TEXT_NODE = 3;

                // Helper function to get visible text from elements
                function getVisibleText(element) {
                  if (!element) return '';
                  try {
                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                      return '';
                    }
                    return element.textContent || element.innerText || '';
                  } catch (e) {
                    return element.textContent || element.innerText || '';
                  }
                }

                // Extract content by traversing the DOM
                function extractContent(root) {
                  const content = [];
                  const seen = new Set();

                  function traverse(node, depth = 0) {
                    if (!node || depth > 20) return;

                    try {
                      // Skip scripts, styles, and hidden elements
                      if (node.nodeType === ELEMENT_NODE) {
                        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
                        if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) return;

                        try {
                          const style = window.getComputedStyle(node);
                          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
                        } catch (e) {
                          // If getComputedStyle fails, continue
                        }
                      }

                      // Process text nodes
                      if (node.nodeType === TEXT_NODE && node.textContent && node.textContent.trim()) {
                        const text = node.textContent.trim();
                        if (!seen.has(text) && text.length > 1) {
                          seen.add(text);
                          content.push({ type: 'text', content: text, depth });
                        }
                      }

                      // Process elements with their text
                      if (node.nodeType === ELEMENT_NODE) {
                        const text = getVisibleText(node);
                        if (text && text.length > 5 && !seen.has(text)) {
                          seen.add(text);
                          const tagName = node.tagName ? node.tagName.toLowerCase() : '';
                          content.push({
                            type: 'element',
                            tag: tagName,
                            content: text,
                            depth,
                            className: node.className || ''
                          });
                        }
                      }

                      // Traverse children
                      if (node.childNodes && node.childNodes.length > 0) {
                        Array.from(node.childNodes).forEach(child => traverse(child, depth + 1));
                      }
                    } catch (e) {
                      console.log('Error traversing node:', e);
                    }
                  }

                  // Start from body, but if empty, try other containers
                  let startNode = document.body;
                  if (!startNode || !getVisibleText(startNode)) {
                    startNode = document.documentElement;
                  }

                  if (startNode) {
                    traverse(startNode);
                  }

                  return content;
                }

                // Extract structured content
                const extractedContent = extractContent();
                const title = document.title || 'Untitled Document';
                const url = window.location.href;

                // Create a clean text representation
                let cleanText = '';
                let currentDepth = -1;

                extractedContent.forEach(item => {
                  if (item.type === 'element' && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(item.tag)) {
                    cleanText += '\\n' + '#'.repeat(parseInt(item.tag[1]) || 1) + ' ' + item.content + '\\n';
                  } else if (item.type === 'text' && item.content.length > 3) {
                    if (item.depth !== currentDepth) {
                      cleanText += '\\n';
                      currentDepth = item.depth;
                    }
                    cleanText += item.content + ' ';
                  }
                });

                // Fallback: get all text if extraction failed
                if (!cleanText || cleanText.length < 50) {
                  try {
                    cleanText = document.body.innerText || document.body.textContent || '';
                    if (!cleanText) {
                      cleanText = document.documentElement.innerText || document.documentElement.textContent || '';
                    }
                  } catch (e) {
                    cleanText = 'Unable to extract text content from this page.';
                  }
                }

                return {
                  title: title,
                  url: url,
                  extractedContent: extractedContent,
                  cleanText: cleanText.trim(),
                  timestamp: new Date().toISOString(),
                  totalChars: cleanText.length
                };
              })();
            `,
          },
        );

        methodUsed = "DOM content extraction";

        // Create multiple file formats
        const data = extractedData.result.value;

        // 1. Create a simple text file
        const textContent = `
Title: ${data.title}
URL: ${data.url}
Generated: ${new Date(data.timestamp).toLocaleString()}
Characters: ${data.totalChars}

=== EXTRACTED CONTENT ===

${data.cleanText}
        `;

        const textDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`;
        const textFilename =
          options.filename ||
          `${data.title.replace(/[^a-zA-Z0-9]/g, "_")}_extracted.txt`;

        await chrome.downloads.download({
          url: textDataUrl,
          filename: textFilename,
          saveAs: options.promptSave || false,
        });

        // 2. Try to create a simple HTML file too
        try {
          const simpleHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${data.title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; }
        h1 { color: #333; border-bottom: 2px solid #333; }
        .metadata { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .content { white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>${data.title}</h1>
    <div class="metadata">
        <p><strong>Source:</strong> <a href="${data.url}">${data.url}</a></p>
        <p><strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
        <p><strong>Characters:</strong> ${data.totalChars}</p>
        <p><em>This content was extracted from a protected webpage using DOM traversal.</em></p>
    </div>
    <div class="content">
${data.cleanText}
    </div>
</body>
</html>
          `;

          const htmlDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(simpleHTML)}`;
          const htmlFilename =
            options.filename ||
            `${data.title.replace(/[^a-zA-Z0-9]/g, "_")}_extracted.html`;

          await chrome.downloads.download({
            url: htmlDataUrl,
            filename: htmlFilename,
            saveAs: false, // Don't prompt for the second file
          });
        } catch (htmlError) {
          console.log("HTML creation failed, but text file was saved");
        }

        return {
          success: true,
          method: methodUsed,
          message: `Extracted ${data.totalChars} characters. Saved as text and HTML files.`,
        };
      } catch (extractionError) {
        console.log(
          "Advanced extraction failed, trying simple text extraction...",
        );

        // Method 3: Simple text extraction fallback
        try {
          const simpleText = await chrome.debugger.sendCommand(
            { tabId: tab.id },
            "Runtime.evaluate",
            {
              expression: `
                (function() {
                  try {
                    const title = document.title || 'Untitled Document';
                    const url = window.location.href;
                    const text = document.body.innerText || document.body.textContent ||
                                 document.documentElement.innerText || document.documentElement.textContent ||
                                 'No content could be extracted from this page.';

                    return {
                      title: title,
                      url: url,
                      text: text,
                      timestamp: new Date().toISOString()
                    };
                  } catch (e) {
                    return {
                      title: 'Untitled Document',
                      url: window.location.href,
                      text: 'Failed to extract content from this protected page.',
                      timestamp: new Date().toISOString()
                    };
                  }
                })();
              `,
            },
          );

          const data = simpleText.result.value;
          const simpleContent = `Title: ${data.title}
URL: ${data.url}
Generated: ${new Date(data.timestamp).toLocaleString()}

=== EXTRACTED TEXT ===

${data.text}`;

          const textDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(simpleContent)}`;
          const textFilename =
            options.filename ||
            `${data.title.replace(/[^a-zA-Z0-9]/g, "_")}_simple.txt`;

          await chrome.downloads.download({
            url: textDataUrl,
            filename: textFilename,
            saveAs: options.promptSave || false,
          });

          return {
            success: true,
            method: "Simple text extraction",
            message: `Basic text extraction completed. Check Downloads for the text file.`,
          };
        } catch (simpleError) {
          throw new Error(
            `All extraction methods failed. This page has extremely strong protection. Last error: ${simpleError.message}`,
          );
        }
      }
    }

    // Reset emulation
    try {
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Emulation.clearDeviceMetricsOverride",
      );
    } catch {}

    // Reset emulation and detach debugger
    try {
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Emulation.clearDeviceMetricsOverride",
      );
    } catch {}

    // Detach debugger
    await chrome.debugger.detach({ tabId: tab.id });

    // This point should not be reached due to early returns above
    throw new Error("Unexpected execution flow in PDF generation");
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
    const maxScrolls = 100;
    let scrollCount = 0;

    do {
      previousHeight = currentHeight;

      // Scroll to bottom with smooth behavior to trigger lazy loading
      await chrome.debugger.sendCommand(tabId, "Runtime.evaluate", {
        expression:
          "window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });",
      });

      // Wait longer for dynamic content
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get new height
      const result = await chrome.debugger.sendCommand(
        tabId,
        "Runtime.evaluate",
        {
          expression: "document.body.scrollHeight",
        },
      );
      currentHeight = result.result.value;

      scrollCount++;
    } while (currentHeight > previousHeight && scrollCount < maxScrolls);

    // Additional wait for any remaining lazy loads
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Scroll back to top
    await chrome.debugger.sendCommand(tabId, "Runtime.evaluate", {
      expression: "window.scrollTo(0, 0);",
    });
  } catch (error) {
    console.warn("Content loading failed, proceeding:", error);
  }
}
