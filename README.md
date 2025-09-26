# Webpage to PDF Printer By Ahmed Hesham

A Chrome browser extension that converts any webpage into a high-quality, organized PDF document with customizable settings.

![Chrome Extension Icon](icon128.png)

## Features

- **High-Quality PDF Generation**: Uses Chrome's native PDF rendering engine
- **Customizable Settings**: Paper size, orientation, margins, and more
- **Smart Content Loading**: Automatically scrolls to load lazy-loaded content
- **Professional Organization**: Automatic headers, footers, and page numbers
- **Document Outline**: Generates table of contents for navigation
- **Background Support**: Preserves webpage backgrounds and styling
- **Easy File Management**: Custom filenames and save location options

## Installation

### Method 1: Developer Mode (Recommended)

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" toggle in the top-right corner
4. Click "Load unpacked" button
5. Select the `print2pdf` folder containing the extension files
6. The extension will appear in your Chrome toolbar

### Method 2: From Chrome Web Store

*Coming soon - This extension is currently in development*

## Usage

### Basic Usage

1. Navigate to any webpage you want to convert to PDF
2. Click the extension icon in your Chrome toolbar
3. Click "Generate PDF" with default settings
4. The PDF will automatically download to your Downloads folder

### Customizing PDF Settings

1. Open the extension popup by clicking the icon
2. Configure your preferred settings:

#### General Settings
- **Filename**: Custom name for the PDF file (optional)
- **Paper Size**: Choose from A4, Letter, or Legal
- **Orientation**: Portrait or Landscape

#### Margin Settings
- **Top/Bottom/Left/Right**: Set custom margins in inches (default: 0.4")

#### Content Options
- **Include Backgrounds**: Preserve webpage colors and images
- **Generate Document Outline**: Create table of contents for navigation
- **Prompt for Save Location**: Choose where to save the PDF

3. Click "Generate PDF" to create your customized PDF

## Configuration Options

### Paper Sizes
- **A4**: 8.27 × 11.69 inches (International standard)
- **Letter**: 8.5 × 11 inches (US standard)
- **Legal**: 8.5 × 14 inches (US legal documents)

### Margins
- Default: 0.4 inches on all sides
- Minimum: 0 inches
- Precision: 0.1 inch increments

### Advanced Features
- **Lazy Loading Support**: Automatically scrolls to load infinite scroll content
- **Print Optimization**: Custom CSS for consistent page breaks
- **Error Recovery**: Automatic cleanup if PDF generation fails
- **Anti-Bot Detection Bypass**: Advanced techniques for protected websites
- **DOM Content Extraction**: Fallback mechanism for complex pages
- **Smart Resource Management**: Automatic cleanup and memory optimization
- **Multi-Method Generation**: Multiple approaches to ensure successful PDF creation

## Technical Details

### How It Works

1. **Debugger Attachment**: The extension attaches Chrome's debugger to the current tab
2. **Viewport Configuration**: Sets a large viewport to ensure all content renders
3. **Content Loading**: Automatically scrolls to load lazy-loaded content
4. **Anti-Bot Bypass**: Removes event listeners and protections for difficult websites
5. **CSS Injection**: Adds custom print styles for professional formatting
6. **PDF Generation**: Uses Chrome's `Page.printToPDF` command
7. **Fallback Mechanisms**: If PDF generation fails, attempts DOM content extraction
8. **File Download**: Saves the PDF with automatic filename generation
9. **Resource Cleanup**: Properly detaches debugger and cleans up resources

### Chrome APIs Used

- **Debugger API**: Core PDF generation functionality
- **Active Tab API**: Access to the current webpage
- **Downloads API**: File download management
- **Runtime API**: Communication between extension components

### Permissions Required

- `debugger`: Required for PDF generation
- `activeTab`: Access to the current webpage
- `downloads`: Save generated PDF files

## Troubleshooting

### Common Issues

#### "Error: tabId is not defined"
- **Cause**: Extension code error (should be fixed in latest version)
- **Solution**: Reload the extension or reinstall it

#### PDF Generation Fails
- **Cause**: Chrome debugger attachment failed
- **Solution**:
  - Refresh the webpage
  - Close other tabs using the debugger
  - Restart Chrome
  - Try a different webpage

#### PDF Looks Different from Webpage
- **Cause**: Print CSS vs screen CSS differences
- **Solution**: Enable "Include Backgrounds" option

#### Large Webpages Timeout
- **Cause**: Complex pages take longer to process
- **Solution**:
  - Wait for completion (may take 30+ seconds)
  - Try with simpler pages first
  - Check browser console for errors

#### Extension Not Loading
- **Cause**: Chrome extension loading issues
- **Solution**:
  - Ensure "Developer mode" is enabled
  - Verify you selected the correct folder
  - Check for error messages in the extensions page

### Debugging

To debug the extension:

1. Go to `chrome://extensions/`
2. Find "Webpage to PDF Printer" in the list
3. Click "Inspect views: background page" to debug the service worker
4. Click the extension icon, then right-click and "Inspect" to debug the popup

## Security

### Privacy
- This extension processes all data locally in your browser
- No data is sent to external servers
- PDF files are saved directly to your computer

### Permissions
- The extension only accesses the active tab when you click the generate button
- Debugger permission is required for PDF generation but is only used temporarily
- All permissions are necessary for the core functionality

## Development

### File Structure
```
print2pdf/
├── manifest.json          # Extension configuration
├── background.js          # PDF generation logic
├── popup.html            # User interface
├── popup.js              # UI interaction logic
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
├── README.md             # This file
```

### Building
This extension requires no build process. Simply load the files directly into Chrome.

### Testing
1. Load the extension in developer mode
2. Test on various webpage types (simple, complex, lazy-loading)
3. Verify all PDF generation options work correctly
4. Check error handling and edge cases

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Reload the extension
3. Try a different webpage
4. Report bugs with details about the webpage and error messages

## Changelog

### Version 1.0 (Updated)
- Initial release
- Core PDF generation using Chrome's native PDF rendering engine
- Customizable paper size (A4, Letter, Legal) and orientation
- Margin configuration with 0.1 inch precision
- Background preservation and document outline generation
- Automatic filename generation and custom filename support
- Lazy loading content support with automatic scrolling
- Enhanced error handling and fallback mechanisms
- Anti-bot detection bypass for protected websites
- DOM content extraction fallback for complex pages
- Print optimization CSS injection for professional formatting
- Smart cleanup and recovery procedures

### Recent Enhancements
- **Improved Error Handling**: Multiple fallback mechanisms for difficult-to-print websites
- **Anti-Bot Detection**: Advanced bypass techniques for protected content
- **Content Extraction**: Alternative methods when standard PDF generation fails
- **Performance Optimization**: Reduced memory usage and faster processing
- **UI Improvements**: Better status messages and user feedback
- **Security Enhancements**: Debugger cleanup and resource management
