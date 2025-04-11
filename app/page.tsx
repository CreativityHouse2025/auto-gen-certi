import Image from "next/image";
import CertificateForm from "./Certificate";
import { google } from "googleapis";
import CsvUploader from "./components/CsvUploader";


export default function Home() {
  return (
    <div>
      <h1>Next.js + TypeScript</h1>
      <CsvUploader />
    </div>      
  );
}
