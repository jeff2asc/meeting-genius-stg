import { supabase } from './supabase'
// @ts-ignore - pdf-parse doesn't have TypeScript definitions
import pdfParse from 'pdf-parse'
// @ts-ignore - mammoth doesn't have proper TypeScript definitions
import mammoth from 'mammoth'

interface BuildingDocument {
  type: string
  filename: string
  text: string
}

/**
 * Fetches all documents for a building and extracts their text content
 * @param buildingId - The ID of the building
 * @returns Array of extracted document objects
 */
export async function fetchAndExtractBuildingDocuments(buildingId: number): Promise<BuildingDocument[]> {
  try {
    // Step 1: Fetch document metadata from database
    const { data: documents, error: dbError } = await supabase
      .from('building_documents')
      .select('id, document_type, filename, file_url, mime_type')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Error fetching building documents:', dbError)
      return []
    }

    if (!documents || documents.length === 0) {
      console.log('No documents found for building ID:', buildingId)
      return []
    }

    console.log(`Found ${documents.length} documents for building ID ${buildingId}`)

    // Step 2: Download and extract text from each document
    const extractedDocuments = await Promise.all(
      documents.map(async (doc) => {
        try {
          console.log(`Processing document: ${doc.filename} (${doc.mime_type})`)
          
          // Download file from Storage
          const response = await fetch(doc.file_url)
          if (!response.ok) {
            console.error(`Failed to download ${doc.filename}`)
            return null
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Extract text based on file type
          let extractedText = ''

          if (doc.mime_type === 'application/pdf') {
            extractedText = await extractTextFromPDF(buffer)
          } else if (
            doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            doc.mime_type === 'application/msword'
          ) {
            extractedText = await extractTextFromDocx(buffer)
          } else if (doc.mime_type === 'text/plain') {
            extractedText = buffer.toString('utf-8')
          } else {
            console.warn(`Unsupported file type: ${doc.mime_type}`)
            return null
          }

          if (!extractedText || extractedText.trim().length === 0) {
            console.warn(`No text extracted from ${doc.filename}`)
            return null
          }

          console.log(`Successfully extracted ${extractedText.length} characters from ${doc.filename}`)

          return {
            type: doc.document_type,
            filename: doc.filename,
            text: extractedText.trim()
          }
        } catch (error) {
          console.error(`Error processing document ${doc.filename}:`, error)
          return null
        }
      })
    )

    // Filter out null results (failed extractions)
    const validDocuments = extractedDocuments.filter((doc): doc is BuildingDocument => doc !== null)

    console.log(`Successfully processed ${validDocuments.length} out of ${documents.length} documents`)
    
    return validDocuments
  } catch (error) {
    console.error('Error in fetchAndExtractBuildingDocuments:', error)
    return []
  }
}

/**
 * Extracts text from a PDF buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw error
  }
}

/**
 * Extracts text from a DOCX buffer
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('Error extracting text from DOCX:', error)
    throw error
  }
}
