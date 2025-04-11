import { type NextRequest, NextResponse } from "next/server"
import { listAllBlobs, deleteBlob, cleanupOldBlobs } from "@/lib/blob-utils"

export async function GET(req: NextRequest) {
  try {
    const blobs = await listAllBlobs()
    return NextResponse.json(blobs)
  } catch (error) {
    return NextResponse.json({ error: "Failed to list blobs" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")
    const cleanup = searchParams.get("cleanup")

    if (cleanup) {
      const days = Number.parseInt(cleanup, 10) || 7
      const result = await cleanupOldBlobs(days)
      return NextResponse.json(result)
    }

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    const result = await deleteBlob(url)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete blob" }, { status: 500 })
  }
}
