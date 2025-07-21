import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { Readable } from 'stream';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { parse } from 'papaparse';
export const maxDuration = 800; // 5 seconds

const prisma = new PrismaClient();

// Google Drive Configuration
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN!;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASSWORD!,
  },
});

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client});

const bufferToStream = (buffer: Buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

const extractFolderId = (url: string): string | null => {
  const match = url.match(/\/folders\/([^\/\?]*)/);
  return match ? match[1] : null;
};

interface ProcessRequest {
  fullName: string;
  email: string;
  url: string;
}

interface CsvUser {
  fullName?: string;
  email?: string;
  url?: string;
}

const ALL_TEMPLATES = [
  { 
    id: 'template1',
    file: 'https://drive.google.com/uc?export=download&id=1io4G0KhYWAdBqoQzGzWUqiNXo0a7VB34',
    prefix: 'PMPP B#' 
  },
  { 
    id: 'template2',
    file: 'https://drive.google.com/uc?export=download&id=19BjIZLOxn5FLcbwUiTE7XEq1vb3fET3O',
    prefix: 'PMP B#' 
  },
  { 
    id: 'template3',
    file: 'https://drive.google.com/uc?export=download&id=1gJtp2QXNy-6s5sGZfVb7G-UpZkAgkxQL',
    prefix: 'SS B#' 
  },
  { 
    id: 'template4',
    file: 'https://drive.google.com/uc?export=download&id=1PvT89gD3wAfPrmUiLIXyRHI5vUYnwHpf',
    prefix: 'AI B#' 
  },
  { 
    id: 'template5',
    file: 'https://drive.google.com/uc?export=download&id=1YLsWplPc5G5nh1pI2RyYeUQuFWSOsfBL',
    prefix: 'AG B#' 
  },
];

const VALID_TEMPLATES = ALL_TEMPLATES.map(t => t.id);


const createUserFolder = async (parentFolderId: string, folderName: string) => {
  try {
    const { data: existingFolders } = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
    });

    if (existingFolders.files?.length) {
      return existingFolders.files[0].id;
    }

    // Create new folder if it doesn't exist
    const { data: newFolder } = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      }
    });

    return newFolder.id;
  } catch (error) {
    console.error('Folder creation failed:', error);
    throw new Error(`Failed to create user folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const processUser = async (user: ProcessRequest, selectedTemplates: string[]) => {
  const baseFolderId = extractFolderId(user.url);
  if (!baseFolderId) throw new Error('Invalid folder URL');

  const templates = ALL_TEMPLATES.filter(t => selectedTemplates.includes(t.id));
  if (!templates.length) throw new Error('No templates selected');

  const zip = new JSZip();
  const customColor = rgb(129 / 255, 32 / 255, 99 / 255);
  // Create a single user folder
  const userFolderName = `${user.fullName} Certificates`.replace(/[^\w\s-]/gi, '');
  const userFolderId = await createUserFolder(baseFolderId, userFolderName);
  const userFolderUrl = `https://drive.google.com/drive/folders/${userFolderId}`; // 👈 Add this line

  for (const template of templates) {
    try {
      const response = await fetch(template.file);
      if (!response.ok) throw new Error('Template fetch failed');
      const imageBuffer = await response.arrayBuffer();

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]);
      const pngImage = await pdfDoc.embedPng( Buffer.from(imageBuffer));
      
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
      });

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 36;
      const textWidth = font.widthOfTextAtSize(user.fullName, fontSize);
      
      page.drawText(user.fullName, {
        x: (page.getWidth() - textWidth) / 2,
        y: 300,
        size: fontSize,
        font,
        color: customColor,
      });

      const counter = await prisma.serialCounter.findUnique({
        where: { prefix: template.prefix },
      }) || await prisma.serialCounter.create({
        data: { prefix: template.prefix, count: 1 },
      });

      const serialNumber = `${template.prefix} c${String(counter.count).padStart(4, '0')}`;
      const serialFontSize = 12;
      const serialTextWidth = font.widthOfTextAtSize(serialNumber, serialFontSize);
      
      page.drawText(serialNumber, {
        x: page.getWidth() - serialTextWidth - 20,
        y: 20,
        size: serialFontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const qrCodeDataUrl = await QRCode.toDataURL(userFolderUrl);
      const qrImage = await pdfDoc.embedPng(qrCodeDataUrl);
      
      page.drawImage(qrImage, {
        x: (page.getWidth() - 80) / 2,
        y: 20,
        width: 80,
        height: 80,
      });

      const pdfBytes = await pdfDoc.save();
      const pdfFileName = `${template.prefix.replace(/ /g, '_')}_${user.fullName}.pdf`;

      if (!userFolderId) {
        throw new Error('User folder ID is undefined');
      }

      await drive.files.create({
        requestBody: {
          name: pdfFileName,
          mimeType: 'application/pdf',
          parents: [userFolderId],
        },
        media: {
          mimeType: 'application/pdf',
          body: bufferToStream(Buffer.from(pdfBytes)),
        },
      });
      const matchingFiles = (await drive.files.list({
        q: `name='${pdfFileName}' and parents in '${userFolderId}'`,
        fields: 'files(id)',
      })).data.files;
      
      const fileId = matchingFiles && matchingFiles.length > 0 ? matchingFiles[0].id : null;
      
      if (!fileId) {
        throw new Error(`Failed to find uploaded file ${pdfFileName} in folder ${userFolderId}`);
      }
      
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      await prisma.serialCounter.update({
        where: { prefix: template.prefix },
        data: { count: counter.count + 1 },
      });

      await prisma.certificate.create({
        data: {
          fullName: user.fullName,
          email: user.email,
          serialNumber,
          templateName: template.file,
          url: userFolderUrl,
        },
      });

      zip.file(pdfFileName, pdfBytes);
    } catch (error) {
      console.error(`Error processing template ${template.file}:`, error);
      throw error;
    }
  }

  const zipBytes = await zip.generateAsync({ type: 'nodebuffer' });
  await transporter.sendMail({
    to: user.email,
    from: `"Certificate Issuer" <${process.env.EMAIL_USER}>`,
    subject: 'Your Certificates Are Ready',
    html: `
      <p>Hello ${user.fullName},</p>
      <p>Certificates available at: <a href="${userFolderUrl}">${userFolderUrl}</a></p>
      <p>ZIP attachment contains all PDF certificates.</p>
    `,
    attachments: [{
      filename: `${user.fullName}_certificates.zip`,
      content: Buffer.from(zipBytes),
      contentType: 'application/zip',
    }],
  });

  return { success: true, email: user.email };
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const csvFile = formData.get('csv');
    const templatesInput = formData.get('templates');
    const driveFolderUrl = formData.get('driveFolderUrl') as string;
    
    if (!templatesInput) {
      return new NextResponse(
        JSON.stringify({ error: 'No templates selected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const selectedTemplates = JSON.parse(templatesInput as string) as string[];
    
    if (!Array.isArray(selectedTemplates)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid template format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!selectedTemplates.every(t => VALID_TEMPLATES.includes(t))) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid template selection' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!csvFile || !(csvFile instanceof Blob)) {
      return new NextResponse(JSON.stringify({ error: 'CSV file required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!driveFolderUrl) {
      return new NextResponse(JSON.stringify({ error: 'Google Drive folder URL required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const csvText = await csvFile.text();
    const { data, errors } = parse<CsvUser>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (errors.length > 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid CSV format', details: errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const csvUser of data) {
      try {
        if (!csvUser.fullName || !csvUser.email) {
          results.push({
            success: false,
            email: csvUser.email || 'unknown',
            error: 'Missing required fields',
          });
          continue;
        }

        const userData: ProcessRequest = {
          fullName: csvUser.fullName,
          email: csvUser.email,
          url: driveFolderUrl, // Use the provided driveFolderUrl for all users
        };

        const result = await processUser(userData, selectedTemplates);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${csvUser.email || 'unknown'}:`, errorMessage);
        results.push({
          success: false,
          email: csvUser.email || 'unknown',
          error: errorMessage,
        });
      }
    }

    return new NextResponse(JSON.stringify({
      processed: results.length,
      successes: results.filter(r => r.success).length,
      failures: results.filter(r => !r.success).length,
      details: results,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Batch processing error:', errorMessage);
    return new NextResponse(
      JSON.stringify({ error: 'Server error', details: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
