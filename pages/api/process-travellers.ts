import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import mammoth from 'mammoth';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

async function readFileContent(file: formidable.File): Promise<string> {
  const { mimetype, filepath } = file;

  if (mimetype?.startsWith('image/')) {
    const optimizedImageBuffer = await sharp(filepath)
      .resize(1024, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const base64Image = optimizedImageBuffer.toString('base64');
    return `data:${mimetype};base64,${base64Image}`;
  }

  if (mimetype === 'text/csv') {
    return new Promise((resolve, reject) => {
      const results: string[] = []; // Changed from 'let' to 'const'
      fs.createReadStream(filepath)
        .pipe(csv())
        .on('data', (data) => results.push(JSON.stringify(data)))
        .on('end', () => resolve(results.join('\n')))
        .on('error', reject);
    });
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      mimetype === 'application/vnd.ms-excel') {
    const workbook = xlsx.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return JSON.stringify(xlsx.utils.sheet_to_json(sheet));
  }

  if (mimetype === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filepath);
    const pdfContent = await pdf(dataBuffer);
    return pdfContent.text;
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword') {
    const result = await mammoth.extractRawText({path: filepath});
    return result.value;
  }

  // For text files and fallback for other types
  return fs.readFileSync(filepath, 'utf8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const form = formidable({
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      return res.status(500).json({ message: 'Error processing file', error: err.message });
    }

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      console.log('File received:', file.originalFilename);
      console.log('File type:', file.mimetype);

      const content = await readFileContent(file);
      console.log('Content read successfully');

      type Message = ChatCompletionMessageParam;

      const messages: Message[] = [
        {
          role: "system",
          content: "You are an AI assistant that extracts traveller information from text or images. Extract information for up to 5 travellers. If gender is not explicitly mentioned, make an educated guess based on the name. Look for any information that applies to all passengers. Always use full four-digit years for dates of birth."
        },
        {
          role: "user",
          content: file.mimetype?.startsWith('image/')
            ? [
                { type: "text", text: "Extract traveller information from this image:" },
                { type: "image_url", image_url: { url: content } }
              ]
            : `Extract traveller information from this content:\n\n${content}`
        },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
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

      res.status(200).json(parsedContent);
    } catch (error) {
      console.error('Error processing travellers:', error);
      if (error instanceof Error) {
        res.status(500).json({ message: 'Error processing travellers', error: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: 'Error processing travellers', error: 'Unknown error' });
      }
    } finally {
      // Clean up the temp file
      fs.unlinkSync(file.filepath);
    }
  });
}