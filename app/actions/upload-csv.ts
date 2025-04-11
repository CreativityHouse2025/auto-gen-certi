"use server"

import { put } from "@vercel/blob"

export async function uploadCsvToBlob(formData: FormData) {
  try {
    const file = formData.get("csv") as File

    if (!file) {
      return { success: false, error: "No file provided" }
    }

    // Generate a unique filename with timestamp
    const timestamp = new Date().getTime()
    const filename = `${timestamp}-${file.name}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
    })

    return {
      success: true,
      url: blob.url,
      filename: blob.pathname,
    }
  } catch (error) {
    console.error("Error uploading to Blob:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during upload",
    }
  }
}
