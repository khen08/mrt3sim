/**
 * Utility functions for chart operations like exporting to images
 */

/**
 * Gets the background color based on current theme
 * @returns Background color string
 */
export const getThemeBackgroundColor = (): string => {
  const isDarkMode =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");
  return isDarkMode ? "#000000" : "#ffffff";
};

/**
 * Temporarily overrides oklch colors with rgb fallbacks for html2canvas
 * which doesn't support oklch color format
 * @returns A function to remove the temporary styles
 */
export const setupScreenshotStyles = (): (() => void) => {
  // Create a style element for the color overrides
  const styleEl = document.createElement("style");
  styleEl.id = "screenshot-styles";

  // Add color fallbacks for common theme colors
  // This maps TailwindCSS v4 oklch colors to RGB equivalents
  styleEl.textContent = `
    :root {
      /* Light mode overrides */
      --background: #ffffff !important;
      --foreground: #000000 !important;
      --primary: #2563eb !important;
      --primary-foreground: #ffffff !important;
      --muted: #f3f4f6 !important;
      --muted-foreground: #6b7280 !important;
      
      /* Other potential tailwind colors that use oklch */
      --card: #ffffff !important;
      --card-foreground: #000000 !important;
      --border: #e5e7eb !important;
    }
    
    .dark {
      /* Dark mode overrides */
      --background: #000000 !important;
      --foreground: #ffffff !important;
      --primary: #3b82f6 !important;
      --primary-foreground: #ffffff !important;
      --muted: #27272a !important;
      --muted-foreground: #a1a1aa !important;
      
      /* Other potential tailwind colors that use oklch */
      --card: #000000 !important;
      --card-foreground: #ffffff !important;
      --border: #333333 !important;
    }
  `;

  // Add the style element to the document
  document.head.appendChild(styleEl);

  // Return a function that removes the temporary styles
  return () => {
    const styleElement = document.getElementById("screenshot-styles");
    if (styleElement) {
      styleElement.remove();
    }
  };
};

/**
 * Exports an ECharts instance as an image
 * @param chartRef Reference to the ECharts instance
 * @param filename Name for the downloaded file (without extension)
 */
export const exportChartAsImage = (
  chartRef: any,
  filename: string = "chart"
) => {
  if (!chartRef || !chartRef.getEchartsInstance) {
    console.error("Invalid chart reference");
    return;
  }

  try {
    const echartsInstance = chartRef.getEchartsInstance();

    // Get current background based on theme
    const backgroundColor = getThemeBackgroundColor();

    // Generate a data URL for the chart with proper background
    const dataURL = echartsInstance.getDataURL({
      type: "png",
      pixelRatio: 2, // Higher resolution
      backgroundColor: backgroundColor,
    });

    // Create a download link
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Failed to export chart:", error);
  }
};
