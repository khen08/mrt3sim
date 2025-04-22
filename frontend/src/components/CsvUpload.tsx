import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  IconUpload,
  IconFile,
  IconX,
  IconCheck,
  IconDownload,
} from "@tabler/icons-react";
import Papa from "papaparse";
import { toast } from "@/components/ui/use-toast";

interface CsvUploadProps {
  onFileUpload: (
    file: File,
    data: { header: string[]; rows: string[][] }
  ) => void;
}

const CsvUpload = ({ onFileUpload }: CsvUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setIsUploading(true);
      setUploadComplete(false);

      // Let the parent component handle the file reading and processing
      // Parse CSV locally only to prepare data format, but don't trigger external toast
      Papa.parse(selectedFile, {
        header: false,
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length > 0) {
            const header = rows[0];
            const dataRows = rows.slice(1).filter((row) => row.length > 1);

            console.log("CSV Parsed Data (local):", {
              header,
              rowCount: dataRows.length,
            });

            // Prepare the data for the parent component
            const processedHeader = header.map((col, index) => {
              if (index === 0) return "DateTime";
              return col.replace(";", ",");
            });

            // Call the callback with file and *unparsed* data reference for parent to handle API
            // The parent (`page.tsx`) will handle the actual upload and toast notifications
            onFileUpload(selectedFile, {
              header: processedHeader,
              rows: dataRows,
            }); // Pass parsed structure if needed by parent, or just the file

            // Update local state
            setIsUploading(false); // Assume parent starts processing immediately
            setUploadComplete(true); // Visually mark as complete here
          } else {
            console.error("Error parsing CSV: No rows found");
            // Don't toast here, let parent handle potential errors during its processing
            setIsUploading(false);
          }
        },
        error: (error) => {
          console.error("Error parsing CSV locally:", error);
          // Don't toast here, let parent handle errors
          setIsUploading(false);
        },
      });
    }
  };

  const handleDownloadSample = () => {
    // Create a link to download the sample CSV file
    const link = document.createElement("a");
    link.href = "/sample_passenger_flow.csv";
    link.download = "sample_passenger_flow.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Sample Downloaded",
      description:
        "Sample CSV file downloaded. You can use this as a template.",
      variant: "default",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          onClick={handleDownloadSample}
          className="flex items-center gap-2"
        >
          <IconDownload size={16} />
          <span>Download Sample CSV</span>
        </Button>
        <div className="text-sm text-gray-500">
          Use this sample as a template for your own data
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input
          type="file"
          accept=".csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        {!file ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <IconUpload size={48} className="text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium">Upload CSV file</p>
              <p className="text-sm text-gray-500 mt-1">
                Drag and drop or click to browse
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {isUploading ? (
                <div className="animate-pulse">
                  <IconFile size={48} className="text-gray-400" />
                </div>
              ) : uploadComplete ? (
                <IconCheck size={48} className="text-green-500" />
              ) : (
                <IconFile size={48} className="text-mrt-blue" />
              )}
            </div>
            <div>
              <p className="text-lg font-medium">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {isUploading
                  ? "Processing..."
                  : uploadComplete
                  ? "Upload complete!"
                  : `${(file.size / 1024).toFixed(2)} KB`}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              {!isUploading && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setUploadComplete(false);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="flex items-center gap-1"
                  >
                    <IconX size={16} />
                    <span>Remove</span>
                  </Button>
                  {!uploadComplete && (
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1"
                    >
                      <IconUpload size={16} />
                      <span>Change File</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        <p className="font-medium mb-2">Required Format:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>CSV file with comma-separated values</li>
          <li>First column should contain time values (format: HH:MM)</li>
          <li>
            Column headers should represent origin-destination pairs (format:
            fromStation;toStation)
          </li>
          <li>
            Each cell should contain passenger count for that time and OD pair
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CsvUpload;
