# AI-Powered Traveller Information Extractor

This project is a Next.js application that uses AI to extract traveller information from various file formats, including images, text, CSV, Excel, PDF, and Word documents. It provides a user-friendly interface for managing traveller details and leverages OpenAI's GPT-4 model for information extraction.

## Features

- Upload files (text, CSV, Excel, PDF, Word, images) containing traveller information
- AI-powered extraction of traveller details
- Support for up to 5 travellers
- Edit and manage traveller information manually
- Responsive UI with progress indicators during file processing

## Technologies Used

- Next.js
- React
- TypeScript
- OpenAI API (GPT-4)
- Axios for API requests
- Zod for schema validation
- Sharp for image processing
- Various libraries for file parsing (csv-parser, xlsx, pdf-parse, mammoth)

## Getting Started

First, set up your environment:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/traveller-info-extractor.git
   cd traveller-info-extractor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. On the main page, you'll see a list of travellers (up to 5).
2. Click on a traveller card to edit their information manually.
3. To use AI extraction, drag and drop a file or click to select a file in the designated area.
4. The application will process the file and attempt to extract traveller information.
5. Review and edit the extracted information as needed.

## API

The project includes an API route for processing files and extracting traveller information:

- `POST /api/process-travellers`: Accepts multipart form data with a file. Processes the file and returns extracted traveller information.

## File Support

The application supports the following file types:
- Text (.txt)
- CSV (.csv)
- Excel (.xlsx, .xls)
- Word (.doc, .docx)
- PDF (.pdf)
- Images (.jpg, .jpeg, .png)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
