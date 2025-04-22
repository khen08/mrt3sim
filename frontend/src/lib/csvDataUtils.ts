/**
 * Utility functions for handling CSV data in the MRT-3 simulation
 */

/**
 * Finds the closest row in the CSV data to the given simulation time
 * @param csvData Parsed CSV data
 * @param simulationTime Current simulation time (format: "HH:MM:SS")
 * @returns The matching row or null if not found
 */
export function findClosestTimeRow(
  csvData: any,
  simulationTime: string
): any[] | null {
  if (!csvData || !csvData.rows || csvData.rows.length === 0) {
    console.warn("No CSV data available for finding closest time row");
    return null;
  }

  // Get time as HH:MM for comparison
  const simTimeHourMin = simulationTime.substring(0, 5);
  console.log(`Looking for time ${simTimeHourMin} in CSV data`);

  // Find the dateTime column index
  const dateTimeIndex = csvData.header.findIndex(
    (col: string) =>
      col.toLowerCase().includes("time") || col.toLowerCase().includes("date")
  );

  if (dateTimeIndex === -1) {
    console.error(
      "No DateTime column found in CSV. Available columns:",
      csvData.header
    );
    return null;
  }

  console.log(
    "Using DateTime column:",
    csvData.header[dateTimeIndex],
    "at index",
    dateTimeIndex
  );

  // Look for exact match first (comparing just hour and minute)
  for (const row of csvData.rows) {
    if (row[dateTimeIndex]) {
      // Extract HH:MM from possible formats
      let rowTimeStr = "";

      // Format 1: Full datetime "2023-04-12 07:00:00"
      if (row[dateTimeIndex].includes(" ")) {
        rowTimeStr = row[dateTimeIndex].split(" ")[1]?.substring(0, 5);
      }
      // Format a2: Just "07:00" or "07:00:00"
      else if (row[dateTimeIndex].includes(":")) {
        rowTimeStr = row[dateTimeIndex].substring(0, 5);
      }

      if (rowTimeStr === simTimeHourMin) {
        console.log(
          `Found exact time match: ${rowTimeStr} = ${simTimeHourMin}`
        );
        return row;
      }
    }
  }

  // If no exact match, find the closest time
  let closestRow = null;
  let closestDiff = Infinity;

  for (const row of csvData.rows) {
    if (row[dateTimeIndex]) {
      // Extract time HH:MM
      let rowTimeStr = "";

      // Extract time part based on format
      if (row[dateTimeIndex].includes(" ")) {
        rowTimeStr = row[dateTimeIndex].split(" ")[1]?.substring(0, 5);
      } else if (row[dateTimeIndex].includes(":")) {
        rowTimeStr = row[dateTimeIndex].substring(0, 5);
      } else {
        continue; // Skip invalid formats
      }

      if (!rowTimeStr) continue;

      const [rowHour, rowMin] = rowTimeStr.split(":").map(Number);
      const [simHour, simMin] = simTimeHourMin.split(":").map(Number);

      // Calculate minutes since midnight for comparison
      const rowMinutes = rowHour * 60 + rowMin;
      const simMinutes = simHour * 60 + simMin;
      const diff = Math.abs(simMinutes - rowMinutes);

      if (diff < closestDiff) {
        closestDiff = diff;
        closestRow = row;
      }
    }
  }

  if (closestRow) {
    console.log(`Found closest time match with diff of ${closestDiff} minutes`);
  } else {
    console.warn("No suitable time row found in CSV data");
  }

  return closestRow;
}

/**
 * Finds both the current and next minute rows in the CSV data for interpolation
 * @param csvData Parsed CSV data
 * @param simulationTime Current simulation time (format: "HH:MM:SS")
 * @returns Object containing current and next rows, and interpolation progress
 */
export function findMinuteRangeRows(
  csvData: any,
  simulationTime: string
): { currentRow: any[] | null; nextRow: any[] | null; progress: number } {
  if (!csvData || !csvData.rows || csvData.rows.length === 0) {
    console.warn("No CSV data available for finding minute range rows");
    return { currentRow: null, nextRow: null, progress: 0 };
  }

  // Parse the simulation time
  const [simHour, simMin, simSec] = simulationTime.split(":").map(Number);
  const simTimeHourMin = `${simHour.toString().padStart(2, "0")}:${simMin
    .toString()
    .padStart(2, "0")}`;

  // Calculate progress through the current minute (0.0 to 1.0)
  const secondsProgress = simSec / 60;

  // Find the dateTime column index
  const dateTimeIndex = csvData.header.findIndex(
    (col: string) =>
      col.toLowerCase().includes("time") || col.toLowerCase().includes("date")
  );

  if (dateTimeIndex === -1) {
    console.error(
      "No DateTime column found in CSV. Available columns:",
      csvData.header
    );
    return { currentRow: null, nextRow: null, progress: 0 };
  }

  // Calculate the next minute time
  let nextMin = simMin + 1;
  let nextHour = simHour;
  if (nextMin >= 60) {
    nextMin = 0;
    nextHour += 1;
  }
  const nextTimeHourMin = `${nextHour.toString().padStart(2, "0")}:${nextMin
    .toString()
    .padStart(2, "0")}`;

  console.log(
    `Looking for current time ${simTimeHourMin} and next time ${nextTimeHourMin}`
  );

  let currentRow = null;
  let nextRow = null;

  // Find current minute row
  for (const row of csvData.rows) {
    if (row[dateTimeIndex]) {
      // Extract HH:MM time string
      let rowTimeStr = "";

      if (row[dateTimeIndex].includes(" ")) {
        rowTimeStr = row[dateTimeIndex].split(" ")[1]?.substring(0, 5);
      } else if (row[dateTimeIndex].includes(":")) {
        rowTimeStr = row[dateTimeIndex].substring(0, 5);
      }

      if (rowTimeStr === simTimeHourMin) {
        currentRow = row;
        break;
      }
    }
  }

  // Find next minute row
  for (const row of csvData.rows) {
    if (row[dateTimeIndex]) {
      // Extract HH:MM time string
      let rowTimeStr = "";

      if (row[dateTimeIndex].includes(" ")) {
        rowTimeStr = row[dateTimeIndex].split(" ")[1]?.substring(0, 5);
      } else if (row[dateTimeIndex].includes(":")) {
        rowTimeStr = row[dateTimeIndex].substring(0, 5);
      }

      if (rowTimeStr === nextTimeHourMin) {
        nextRow = row;
        break;
      }
    }
  }

  // Log results of row search
  if (currentRow) {
    console.log(`Found current minute row for ${simTimeHourMin}`);
  } else {
    console.warn(`No row found for current minute ${simTimeHourMin}`);
  }

  if (nextRow) {
    console.log(`Found next minute row for ${nextTimeHourMin}`);
  } else {
    console.warn(`No row found for next minute ${nextTimeHourMin}`);
  }

  // Fallback: If current or next row is missing, use the closest row for both
  if (!currentRow || !nextRow) {
    console.log("Falling back to closest time row approach");
    const fallbackRow = findClosestTimeRow(csvData, simulationTime);
    return {
      currentRow: fallbackRow,
      nextRow: fallbackRow,
      progress: 0,
    };
  }

  return {
    currentRow,
    nextRow,
    progress: secondsProgress,
  };
}

/**
 * Extracts passenger flow information for a specific station from CSV data with interpolation
 * @param csvData Parsed CSV data
 * @param stationId Station ID (1-based)
 * @param simulationTime Current simulation time
 * @returns Passenger flow metrics
 */
export function getStationPassengerData(
  csvData: any,
  stationId: number,
  simulationTime: string
) {
  console.log(
    `Getting passenger data for station ${stationId} at ${simulationTime}`
  );

  const { currentRow, nextRow, progress } = findMinuteRangeRows(
    csvData,
    simulationTime
  );

  if (!currentRow) {
    console.warn(
      "No current CSV row found for passenger data, returning zeros."
    );
    // Return default zero structure
    return {
      waitingPassengers: 0,
      passengerFlowNB: { boarding: 0, alighting: 0 },
      passengerFlowSB: { boarding: 0, alighting: 0 },
      rawData: { progress: 0 },
    };
  }

  const header = csvData.header;

  // Initialize directional counters
  let currentBoarding_nb = 0;
  let currentAlighting_nb = 0;
  let currentBoarding_sb = 0;
  let currentAlighting_sb = 0;

  let nextBoarding_nb = 0;
  let nextAlighting_nb = 0;
  let nextBoarding_sb = 0;
  let nextAlighting_sb = 0;

  let columnsMatched = 0;

  // Process each column in the header to find flow data
  header.forEach((colName: string, index: number) => {
    if (!colName.includes(",")) return; // Look for "from,to" format

    let fromStation: number | undefined;
    let toStation: number | undefined;

    try {
      const parts = colName.split(",").map((s) => s.trim());
      if (parts.length === 2) {
        // Attempt to parse station IDs from column name
        const fromStr = parts[0].replace(/\D/g, "");
        const toStr = parts[1].replace(/\D/g, "");
        fromStation = parseInt(fromStr);
        toStation = parseInt(toStr);

        if (!isNaN(fromStation) && !isNaN(toStation)) {
          columnsMatched++;
          // Optional: Log parsing failure for column name
          fromStation = undefined;
          toStation = undefined;
        }
      }
    } catch (error) {
      console.error(`[Debug] Error parsing column name "${colName}":`, error);
      return; // Skip this column
    }

    if (fromStation === undefined || toStation === undefined) return;

    // Get counts from current/next row, default to 0 if not a number
    const currentVal = currentRow[index];
    const nextVal = nextRow ? nextRow[index] : currentVal;
    const currentCount = parseInt(currentVal) || 0;
    const nextCount = parseInt(nextVal) || 0;

    // Optional: Log if parsing failed for counts
    // if (isNaN(parseInt(currentVal))) {
    //     console.warn(`[Debug] Non-numeric current value in column '${colName}' for station ${stationId}: '${currentVal}'`);
    // }
    // if (nextRow && isNaN(parseInt(nextVal))) {
    //     console.warn(`[Debug] Non-numeric next value in column '${colName}' for station ${stationId}: '${nextVal}'`);
    // }

    // Boarding Logic
    if (fromStation === stationId) {
      // Passenger is boarding at this station
      // console.log(`[Debug] Station ${stationId} Boarding: From ${fromStation} To ${toStation}, Count: ${currentCount}`);
      if (toStation > fromStation) {
        // Northbound
        currentBoarding_nb += currentCount;
        nextBoarding_nb += nextCount;
      } else if (toStation < fromStation) {
        // Southbound
        currentBoarding_sb += currentCount;
        nextBoarding_sb += nextCount;
      }
    }

    // Alighting Logic
    if (toStation === stationId) {
      // Passenger is alighting at this station
      // console.log(`[Debug] Station ${stationId} Alighting: From ${fromStation} To ${toStation}, Count: ${currentCount}`);
      if (fromStation > toStation) {
        // Northbound (coming from higher station ID)
        currentAlighting_nb += currentCount;
        nextAlighting_nb += nextCount;
      } else if (fromStation < toStation) {
        // Southbound (coming from lower station ID)
        currentAlighting_sb += currentCount;
        nextAlighting_sb += nextCount;
      }
    }
  });

  console.log(
    `Found ${columnsMatched} flow columns processed for station ${stationId}.`
  );
  // Log raw counts before interpolation
  console.log(
    `Raw NB counts - Board: ${currentBoarding_nb}/${nextBoarding_nb}, Alight: ${currentAlighting_nb}/${nextAlighting_nb}`
  );
  console.log(
    `Raw SB counts - Board: ${currentBoarding_sb}/${nextBoarding_sb}, Alight: ${currentAlighting_sb}/${nextAlighting_sb}`
  );

  // Interpolate between two values based on progress
  const interpolate = (current: number, next: number, prog: number) =>
    prog > 0 ? Math.round(current + (next - current) * prog) : current;

  const interpolatedBoarding_nb = interpolate(
    currentBoarding_nb,
    nextBoarding_nb,
    progress
  );
  const interpolatedAlighting_nb = interpolate(
    currentAlighting_nb,
    nextAlighting_nb,
    progress
  );
  const interpolatedBoarding_sb = interpolate(
    currentBoarding_sb,
    nextBoarding_sb,
    progress
  );
  const interpolatedAlighting_sb = interpolate(
    currentAlighting_sb,
    nextAlighting_sb,
    progress
  );

  // Aggregate waiting passengers (simple sum of boarding for now)
  const waitingPassengers = interpolatedBoarding_nb + interpolatedBoarding_sb; // Simple sum for now

  const result = {
    waitingPassengers,
    passengerFlowNB: {
      boarding: interpolatedBoarding_nb,
      alighting: interpolatedAlighting_nb,
    },
    passengerFlowSB: {
      boarding: interpolatedBoarding_sb,
      alighting: interpolatedAlighting_sb,
    },
    rawData: {
      // Include raw/intermediate values for debugging
      currentBoarding_nb,
      currentAlighting_nb,
      currentBoarding_sb,
      currentAlighting_sb,
      nextBoarding_nb,
      nextAlighting_nb,
      nextBoarding_sb,
      nextAlighting_sb,
      progress,
      // currentRowData: currentRow,
      // nextRowData: nextRow,
    },
  };

  // Log final result for the station
  console.log(
    `Interpolated directional data for station ${stationId}:`,
    result
  );
  return result;
}

/**
 * Gets the passenger distribution for the day from CSV data WITHIN a specific time range
 * @param csvData Parsed CSV data
 * @param stationId Station ID
 * @param startTime Start time string (HH:MM)
 * @param endTime End time string (HH:MM)
 * @returns Hourly passenger distribution within the range
 */
export function getPassengerDistribution(
  csvData: any,
  stationId: number,
  startTime: string,
  endTime: string
) {
  if (!csvData || !csvData.rows || csvData.rows.length === 0) {
    console.warn("No CSV data available for passenger distribution");
    return []; // Return empty array if no data
  }

  // Helper to parse time HH:MM to minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  const header = csvData.header;
  const hourlyTotals: { [hour: string]: number } = {};

  // Find DateTime column index
  const dateTimeIndex = csvData.header.findIndex(
    (col: string) =>
      col.toLowerCase().includes("time") || col.toLowerCase().includes("date")
  );

  if (dateTimeIndex === -1) {
    console.error("No DateTime column found for passenger distribution");
    return []; // Return empty array
  }

  let flowColumnsFound = 0;
  let rowsInTimeRange = 0;

  // Analyze each row to build hourly distribution
  csvData.rows.forEach((row: string[]) => {
    if (!row[dateTimeIndex]) return;

    // Extract hour (HH) and time string (HH:MM) from DateTime column
    let rowHour = "";
    let rowTimeStr = "";

    try {
      if (row[dateTimeIndex].includes(" ")) {
        const timePart = row[dateTimeIndex].split(" ")[1]; // HH:MM:SS
        rowHour = timePart.substring(0, 2);
        rowTimeStr = timePart.substring(0, 5);
      } else if (row[dateTimeIndex].includes(":")) {
        rowTimeStr = row[dateTimeIndex].substring(0, 5); // Assume HH:MM or HH:MM:SS
        rowHour = rowTimeStr.substring(0, 2);
      } else {
        return; // Skip invalid formats
      }

      // Check if the row's time is within the specified range (inclusive start, exclusive end)
      const rowMinutes = parseTimeToMinutes(rowTimeStr);
      if (rowMinutes < startMinutes || rowMinutes >= endMinutes) {
        return; // Skip row if outside the time range
      }
      rowsInTimeRange++;
    } catch (e) {
      console.warn(
        `Could not parse time from row value: ${row[dateTimeIndex]}`
      );
      return; // Skip row on parsing error
    }

    let hourTotal = 0;

    // Sum passengers BOARDING at this station within the time range
    header.forEach((colName: string, index: number) => {
      if (!colName.includes(",")) return; // Expect "from,to" format

      try {
        const [fromStation, _] = colName
          .split(",")
          .map((s) => parseInt(s.replace(/\D/g, "")));

        if (!isNaN(fromStation) && fromStation === stationId) {
          flowColumnsFound++; // Count relevant flow columns
          hourTotal += parseInt(row[index]) || 0;
        }
      } catch (error) {
        /* Skip invalid columns */
      }
    });

    // Add to hourly totals (only if the row's time was in range)
    if (rowHour) {
      hourlyTotals[rowHour] = (hourlyTotals[rowHour] || 0) + hourTotal;
    }
  });

  console.log(
    `Processed ${rowsInTimeRange} rows within the time range ${startTime} - ${endTime}.`
  );

  // If no relevant data found, return empty
  if (flowColumnsFound === 0 || rowsInTimeRange === 0) {
    console.warn(
      "No matching flow columns or rows found within the specified time range for passenger distribution"
    );
    return [];
  }

  // Convert hourly totals map to array format for the chart
  const distribution = Object.entries(hourlyTotals)
    .map(([hour, count]) => ({
      hour: `${hour}:00`, // Format as HH:00 for display
      count,
    }))
    // Only include hours that actually had data
    .filter((item) => item.count > 0)
    // Sort by hour numerically
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

  console.log(
    `Generated distribution with ${distribution.length} hour entries for station ${stationId} between ${startTime} and ${endTime}`
  );

  return distribution;
}
