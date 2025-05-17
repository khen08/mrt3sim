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
    /* Base color overrides for CSS variables */
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
      --ring: #2563eb !important;
      --accent: #f9fafb !important;
      --accent-foreground: #111827 !important;
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
      --ring: #3b82f6 !important;
      --accent: #1f2937 !important;
      --accent-foreground: #f9fafb !important;
    }

    /* We'll handle SVG elements programmatically instead of via CSS */
  `;

  // Add the style element to the document
  document.head.appendChild(styleEl);

  // Get all SVG elements that might be problematic
  const svgElements = document.querySelectorAll("svg *");
  const originalStyles: Map<Element, string | null> = new Map();

  // Store original styles and replace problematic ones
  const isDarkMode = document.documentElement.classList.contains("dark");
  svgElements.forEach((el) => {
    // Save original style
    originalStyles.set(el, el.getAttribute("style"));

    // Check if style contains oklab or oklch
    const style = el.getAttribute("style");
    if (style && (style.includes("oklab") || style.includes("oklch"))) {
      // Apply safe styles based on the theme
      if (isDarkMode) {
        if (el.tagName === "text" || el.tagName === "tspan") {
          el.setAttribute(
            "style",
            "fill: #e0e0e0 !important; stroke: none !important;"
          );
        } else if (el.classList.contains("ec-series")) {
          // Keep chart colors
          if (el.closest(".ec-series:nth-child(1)")) {
            el.setAttribute(
              "style",
              "fill: #4C9AFF !important; stroke: #4C9AFF !important;"
            );
          } else if (el.closest(".ec-series:nth-child(2)")) {
            el.setAttribute(
              "style",
              "fill: #FF8F73 !important; stroke: #FF8F73 !important;"
            );
          } else {
            el.setAttribute(
              "style",
              "fill: #ffffff !important; stroke: #ffffff !important;"
            );
          }
        } else {
          el.setAttribute(
            "style",
            "fill: #ffffff !important; stroke: #ffffff !important;"
          );
        }
      } else {
        if (el.tagName === "text" || el.tagName === "tspan") {
          el.setAttribute(
            "style",
            "fill: #333333 !important; stroke: none !important;"
          );
        } else if (el.classList.contains("ec-series")) {
          // Keep chart colors
          if (el.closest(".ec-series:nth-child(1)")) {
            el.setAttribute(
              "style",
              "fill: #4C9AFF !important; stroke: #4C9AFF !important;"
            );
          } else if (el.closest(".ec-series:nth-child(2)")) {
            el.setAttribute(
              "style",
              "fill: #FF8F73 !important; stroke: #FF8F73 !important;"
            );
          } else {
            el.setAttribute(
              "style",
              "fill: #000000 !important; stroke: #000000 !important;"
            );
          }
        } else {
          el.setAttribute(
            "style",
            "fill: #000000 !important; stroke: #000000 !important;"
          );
        }
      }
    }
  });

  // Return a function that restores original styles and removes the temporary styles
  return () => {
    // Restore original styles
    svgElements.forEach((el) => {
      const originalStyle = originalStyles.get(el);
      if (originalStyle) {
        el.setAttribute("style", originalStyle);
      } else {
        el.removeAttribute("style");
      }
    });

    // Remove temporary style element
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

/**
 * Directly get a screenshot of an echarts chart, bypassing html2canvas
 * @param chartRef Reference to ReactECharts component
 * @param filename Output filename
 * @returns Promise that resolves when the download is complete
 */
export const directChartExport = (
  chartRef: any,
  filename: string = "chart"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!chartRef || !chartRef.getEchartsInstance) {
      reject(new Error("Invalid chart reference"));
      return;
    }

    try {
      const echartsInstance = chartRef.getEchartsInstance();
      const backgroundColor = getThemeBackgroundColor();

      // Generate a data URL for the chart
      const dataURL = echartsInstance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor,
      });

      // Create download link
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resolve();
    } catch (error) {
      console.error("Failed to export chart directly:", error);
      reject(error);
    }
  });
};
