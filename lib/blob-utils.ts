import { list, del } from "@vercel/blob"

// List all blobs (useful for admin purposes)
export async function listAllBlobs() {
  try {
    const blobs = await list()
    return blobs
  } catch (error) {
    console.error("Error listing blobs:", error)
    throw error
  }
}

// Delete a blob by URL or pathname
export async function deleteBlob(urlOrPathname: string) {
  try {
    await del(urlOrPathname)
    return { success: true }
  } catch (error) {
    console.error("Error deleting blob:", error)
    return { success: false, error }
  }
}

// Clean up old blobs (e.g., older than 7 days)
export async function cleanupOldBlobs(olderThanDays = 7) {
  try {
    const blobs = await list()
    const now = new Date()
    const cutoffDate = new Date(now.setDate(now.getDate() - olderThanDays))

    const oldBlobs = blobs.blobs.filter((blob) => {
      const uploadDate = new Date(blob.uploadedAt)
      return uploadDate < cutoffDate
    })

    for (const blob of oldBlobs) {
      await del(blob.url)
    }

    return {
      success: true,
      deletedCount: oldBlobs.length,
      deletedBlobs: oldBlobs.map((b) => b.pathname),
    }
  } catch (error) {
    console.error("Error cleaning up old blobs:", error)
    return { success: false, error }
  }
}
