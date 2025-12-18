import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import sharp from 'sharp';
import mammoth from 'mammoth';
import { Readable } from 'stream';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the schema for a single traveller
const TravellerSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: z.string(),
  nationality: z.string(),
  disability: z.string().optional(),
});

// Define the schema for the entire response
const TravellerResponseSchema = z.object({
  travellers: z.array(TravellerSchema),
  globalInfo: z.object({
    nationality: z.string().optional(),
    disability: z.string().optional(),
  }),
});

async function readFileContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const mimetype = file.type;

  if (mimetype?.startsWith('image/')) {
    const optimizedImageBuffer = await sharp(Buffer.from(buffer))
      .resize(1024, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const base64Image = optimizedImageBuffer.toString('base64');
    return `data:${mimetype};base64,${base64Image}`;
  }

  if (mimetype === 'text/csv') {
    return new Promise((resolve, reject) => {
      const results: string[] = [];
      const stream = Readable.from(Buffer.from(buffer));
      stream
        .pipe(csv())
        .on('data', (data: unknown) => results.push(JSON.stringify(data)))
        .on('end', () => resolve(results.join('\n')))
        .on('error', reject);
    });
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel') {
    const workbook = xlsx.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return JSON.stringify(xlsx.utils.sheet_to_json(sheet));
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  }

  // For text files and fallback for other types
  return Buffer.from(buffer).toString('utf8');
}

export async function GET() {
  return NextResponse.json({ message: 'API is working' });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    console.log('File received:', file.name);
    console.log('File type:', file.type);

    const content = await readFileContent(file);
    console.log('Content read successfully');

    const messages = [
      {
        role: "system" as const,
        content: "You are an AI assistant that extracts traveller information from text or images. Extract information for up to 5 travellers. If gender is not explicitly mentioned, make an educated guess based on the name. Look for any information that applies to all passengers. Always use full four-digit years for dates of birth."
      },
      {
        role: "user" as const,
        content: file.type?.startsWith('image/')
          ? [
            { type: "text" as const, text: "Extract traveller information from this image:" },
            { type: "image_url" as const, image_url: { url: content } }
          ]
          : `Extract traveller information from this content:\n\n${content}`
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: zodResponseFormat(TravellerResponseSchema, "traveller_information"),
    });

    console.log('OpenAI API response received');
    console.log('Raw response:', completion.choices[0].message.content);

    if (completion.choices[0].message.content === null) {
      throw new Error('OpenAI response content is null');
    }

    const parsedContent = JSON.parse(completion.choices[0].message.content);
    console.log('Parsed content:', parsedContent);

    return NextResponse.json(parsedContent);
  } catch (error) {
    console.error('Error processing travellers:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { message: 'Error processing travellers', error: error.message, stack: error.stack },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { message: 'Error processing travellers', error: 'Unknown error' },
        { status: 500 }
      );
    }
  }
}
