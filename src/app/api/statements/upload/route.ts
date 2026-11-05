import { NextRequest, NextResponse } from 'next/server';
import { parsePDFStatement } from '@/lib/statement-parser';
import { createClient } from '@/lib/supabase/server';
import pdf from 'pdf-parse-fork';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = formData.get('accountId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'No account ID provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF is too large. The limit is 10 MB.' },
        { status: 413 }
      );
    }

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF using pdf-parse-fork
    let text = '';
    try {
      const pdfData = await pdf(buffer);
      text = pdfData.text;
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return NextResponse.json(
        { error: 'Failed to parse PDF. Please ensure the file is a valid, text-based PDF (not a scanned image).' },
        { status: 400 }
      );
    }

    // Parse the statement
    const result = await parsePDFStatement(text);

    return NextResponse.json({
      success: true,
      accountNumber: result.accountNumber,
      statementDate: result.statementDate,
      openingBalance: result.openingBalance,
      closingBalance: result.closingBalance,
      transactions: result.transactions,
      errors: result.errors,
      unparsedLines: result.unparsedLines || [],
      transactionCount: result.transactions.length,
    });

  } catch (error) {
    console.error('Statement upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process statement', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
