document.getElementById("printBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.textContent = "Generating PDF...";

  // Collect options from the form
  const options = {
    filename: document.getElementById("filename").value.trim() || null,
    paperSize: document.getElementById("paperSize").value,
    orientation: document.getElementById("orientation").value,
    marginTop: parseFloat(document.getElementById("marginTop").value) || 0.4,
    marginBottom:
      parseFloat(document.getElementById("marginBottom").value) || 0.4,
    marginLeft: parseFloat(document.getElementById("marginLeft").value) || 0.4,
    marginRight:
      parseFloat(document.getElementById("marginRight").value) || 0.4,
    includeBackground: document.getElementById("includeBackground").checked,
    generateOutline: document.getElementById("generateOutline").checked,
    promptSave: document.getElementById("promptSave").checked,
  };

  try {
    const response = await chrome.runtime.sendMessage({
      action: "printToPDF",
      options,
    });
    if (response.success) {
      if (response.method === "DOM content extraction") {
        status.textContent =
          "Content extracted! Check Downloads for text and HTML files.";
        status.style.color = "#ff9800";
      } else if (response.method === "HTML extraction fallback") {
        status.textContent =
          "HTML saved! Open the file and print to PDF manually.";
        status.style.color = "#ff9800";
      } else {
        status.textContent = "PDF downloaded!";
        status.style.color = "#4caf50";
      }

      if (response.message) {
        status.textContent += " " + response.message;
      }
    } else {
      status.textContent = `Error: ${response.error}`;
      status.style.color = "#f44336";
    }
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
    status.style.color = "#f44336";
  }
});
