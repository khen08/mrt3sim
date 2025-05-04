import { UPLOAD_CSV_ENDPOINT } from "@/lib/constants";
import { toast } from "@/components/ui/use-toast";

export async function uploadCsvFile(
  selectedFile: File
): Promise<{ success: boolean; filename: string | null }> {
  const formData = new FormData();
  formData.append("passenger_data_file", selectedFile);

  toast({
    title: "Uploading File",
    description: `Uploading '${selectedFile.name}'. Please wait.`,
  });

  try {
    const response = await fetch(UPLOAD_CSV_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    toast({
      title: "Upload Successful",
      description: `File '${result.filename}' uploaded successfully.`,
      variant: "default",
    });

    return { success: true, filename: result.filename };
  } catch (error: any) {
    console.error("Error uploading file:", error);

    toast({
      title: "Upload Failed",
      description:
        error.message || "Could not upload the file. Please try again.",
      variant: "destructive",
    });

    return { success: false, filename: null };
  }
}
