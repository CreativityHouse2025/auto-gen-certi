
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { Readable } from 'stream';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { parse } from 'papaparse';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'info@mail.creativity-house.com',
    pass: 'uigr gcdi krpo fbhq',
  },
});

const prisma = new PrismaClient();

// Google Drive Configuration omer
const CLIENT_ID = '266878449981-uu7l6uq9ptbg9i4n8al56q70qqcdv4sl.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = '1//04DkVGHciQiLWCgYIARAAGAQSNwF-L9IrNI1_wJteNVHz2r-2Q6ar3xcBc3ygYDQWjHtgd6GIkR4sfrkXrgqGCWElvK9Ss_9qrCg';


const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function extractFolderId(url: string): string {
  const match = url.match(/\/folders\/([^\/\?]*)/);
  return match ? match[1] : '';
}


interface ProcessRequest {
  fullName: string;
  email: string;
  url: string; // This will now be the Google Drive folder URL
}

interface CsvUser {
  fullName?: string;
  email?: string;
  url?: string;
}

const ALL_TEMPLATES = [
  { file: 'template1.png', prefix: 'PMPP B#' },
  { file: 'template2.png', prefix: 'PMP B#' },
  { file: 'template3.png', prefix: 'SS B#' },
  { file: 'template4.png', prefix: 'AI B#' },
  { file: 'template5.png', prefix: 'FS B#' },
];

const VALID_TEMPLATES = ALL_TEMPLATES.map(t => t.file);
async function createUserFolder(parentFolderId: string, folderName: string) {
  try {
    // Check if folder already exists
    const { data: existingFolders } = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)'
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

async function processUser(user: ProcessRequest, selectedTemplates: string[]) {
  const baseFolderId = extractFolderId(user.url);
  if (!baseFolderId) throw new Error(`Invalid folder URL for ${user.fullName}`);

  const templates = ALL_TEMPLATES.filter(t => 
    selectedTemplates.includes(t.file)
  );

  if (templates.length === 0) {
    throw new Error('No templates selected');
  }

  const zip = new JSZip();
  const customColor = rgb(129 / 255, 32 / 255, 99 / 255);

  // Create a single user folder
  const userFolderName = `${user.fullName} Certificates`.replace(/[^\w\s-]/gi, '');
  const userFolderId = await createUserFolder(baseFolderId, userFolderName);

  for (const template of templates) {
    // Generate serial number
    let counter = await prisma.serialCounter.findUnique({
      where: { prefix: template.prefix },
    });

    if (!counter) {
      counter = await prisma.serialCounter.create({
        data: { prefix: template.prefix, count: 1 },
      });
    }

    const currentCount = counter.count;
    const serialNumber = `${template.prefix} c${String(currentCount).padStart(4, '0')}`;

    // Generate PDF
    const templatePath = path.join(process.cwd(), 'public', template.file);
    const imageBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]);
    const pngImage = await pdfDoc.embedPng(imageBytes);
    
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

    const serialFontSize = 12;
    const serialTextWidth = font.widthOfTextAtSize(serialNumber, serialFontSize);
    const serialX = page.getWidth() - serialTextWidth - 20;
    const serialY = 20;
    
    page.drawText(serialNumber, {
      x: serialX,
      y: serialY,
      size: serialFontSize,
      font,
      color: rgb(0, 0, 0),
    });
    
    const qrCodeDataUrl = await QRCode.toDataURL(user.url);
    const qrImage = await pdfDoc.embedPng(qrCodeDataUrl);
    const qrSize = 80;
    
    page.drawImage(qrImage, {
      x: (page.getWidth() - qrSize) / 2,
      y: 20,
      width: qrSize,
      height: qrSize,
    });

    const pdfBytes = await pdfDoc.save();
    const pdfFileName = `${template.prefix.replace(/ /g, '_')}_${user.fullName}.pdf`;

    // Upload to user folder
    if (!userFolderId) {
      throw new Error('User folder ID is undefined or invalid');
    }

    const fileResponse = await drive.files.create({
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

    await drive.permissions.create({
      fileId: fileResponse.data.id!,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    // Update database with folder URL
    const folderUrl = `https://drive.google.com/drive/folders/${userFolderId}`;
    
    await prisma.serialCounter.update({
      where: { prefix: template.prefix },
      data: { count: currentCount + 1 },
    });

    await prisma.certificate.create({
      data: {
        fullName: user.fullName,
        email: user.email,
        serialNumber,
        templateName: template.file,
        url: folderUrl,
      },
    });

    zip.file(pdfFileName, pdfBytes);
  }

  // Send email with user folder link
  const zipBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const fileName = `${user.fullName}_certificates.zip`;

  await transporter.sendMail({
    to: user.email,
    from: '"Certificate Issuer" <alihefnawey@gmail.com>',
    subject: 'Your Certificates Are Ready',
    html: `
      <p>Hello ${user.fullName},</p>
      <p>Your certificates have been created in a folder:</p>
      <p><a href="https://drive.google.com/drive/folders/${userFolderId}">View Your Certificates</a></p>
      <p>Attached is a zip file with all your certificates.</p>
    `,
    attachments: [ {
      filename: fileName,
      content: Buffer.from(zipBytes),
      contentType: 'application/zip',
    }],
  });

  return { success: true, email: user.email };
}

// Update the POST handler to accept driveFolderUrl
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const csvFile = formData.get('csv');
    const templatesInput = formData.get('templates');
    const driveFolderUrl = formData.get('driveFolderUrl') as string;
    
    // Validate templates
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