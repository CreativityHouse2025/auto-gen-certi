"use client";
import { useState } from "react";
import axios from "axios";

const TEMPLATES = [
  { id: "template1", name: "PMPP Certificate", file: "/template1.png" },
  { id: "template2", name: "PMP Certificate", file: "/template2.png" },
  { id: "template3", name: "SS Certificate", file: "/template3.png" },
  { id: "template4", name: "AI Certificate", file: "/template4.png" },
  { id: "template5", name: "FS Certificate", file: "/template5.png" },
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<
    Record<string, boolean>
  >(TEMPLATES.reduce((acc, t) => ({ ...acc, [t.id]: true }), {}));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(""); // New state for Drive folder URL

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplates((prev) => ({
      ...prev,
      [templateId]: !prev[templateId],
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !driveFolderUrl) return;

    setLoading(true);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append("csv", file);
      formData.append(
        "templates",
        JSON.stringify(
          TEMPLATES.filter((t) => selectedTemplates[t.id]).map((t) =>
            t.file.split("/").pop()
          )
        )
      );
      formData.append("driveFolderUrl", driveFolderUrl); // Add Drive folder URL to form data

      const response = await axios.post("/api", formData);
      setResults(response.data.details);
    } catch (error) {
      console.error("Upload failed:", error);
      setResults([{ success: false, error: "Upload failed" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Certificate Generator
        </h1>

        <form onSubmit={handleUpload} className="space-y-8">
          {/* Template Selection */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Select Templates
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${
                    selectedTemplates[template.id]
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => handleTemplateToggle(template.id)}
                >
                  <div className="aspect-w-1 aspect-h-1">
                    <img
                      src={template.file}
                      alt={template.name}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="mt-2 text-sm text-center font-medium text-gray-700">
                    {template.name}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedTemplates[template.id]}
                    readOnly
                    className="absolute top-2 right-2 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Google Drive Folder URL */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Google Drive Folder URL
            </h2>
            <input
              type="text"
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              className="w-full border border-black rounded-md p-2 text-gray-800"
              placeholder="Enter Google Drive folder URL"
            />
          </div>

          {/* CSV Upload Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Upload CSV</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <svg
                  className="w-12 h-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  {file ? (
                    <span className="font-medium">{file.name}</span>
                  ) : (
                    <>
                      <span className="font-medium">Click to upload CSV</span>
                      <p className="text-xs text-gray-500 mt-1">
                        CSV should contain columns: fullName, email
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={!file || !driveFolderUrl || loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? "Processing..." : "Generate Certificates"}
          </button>
        </form>

        {/* Results Display */}
        {results.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Processing Results</h2>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md ${
                    result.success
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {result.email} - {result.success ? "Success" : result.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
