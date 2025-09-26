document.getElementById('printBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Generating PDF...';

  // Collect options from the form
  const options = {
    filename: document.getElementById('filename').value.trim() || null,
    paperSize: document.getElementById('paperSize').value,
    orientation: document.getElementById('orientation').value,
    marginTop: parseFloat(document.getElementById('marginTop').value) || 0.4,
    marginBottom: parseFloat(document.getElementById('marginBottom').value) || 0.4,
    marginLeft: parseFloat(document.getElementById('marginLeft').value) || 0.4,
    marginRight: parseFloat(document.getElementById('marginRight').value) || 0.4,
    includeBackground: document.getElementById('includeBackground').checked,
    generateOutline: document.getElementById('generateOutline').checked,
    promptSave: document.getElementById('promptSave').checked,
  };

  try {
    const response = await chrome.runtime.sendMessage({ action: 'printToPDF', options });
    if (response.success) {
      status.textContent = 'PDF downloaded!';
    } else {
      status.textContent = `Error: ${response.error}`;
    }
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  }
});
