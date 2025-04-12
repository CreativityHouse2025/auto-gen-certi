import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

export async function uploadCsvToBlob(formData: FormData) {
  try {
    const file = formData.get("csv") as File;
    const uniqueSuffix = nanoid(); // Generate unique ID
    
    const { url } = await put(
      `uploads/${file.name}-${uniqueSuffix}.csv`,
      file,
      {
        access: "public",
        contentType: file.type,
        addRandomSuffix: true, // Additional safety
      }
    );

    return { success: true, url };
  } catch (error) {
    console.error("Upload failed:", error);
    return { success: false, error: "Upload failed" };
  }
}