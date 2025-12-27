import { supabase } from './supabase'
import pdfToText from 'react-pdftotext'
import mammoth from 'mammoth'

interface BuildingDocument {
  type: string
  filename: string
  text: string
}

async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const blob = await response.blob()
    const file = new File([blob], 'document.pdf', { type: 'application/pdf' })
    const text = await pdfToText(file)
    return text
  } catch (error) {
    console.error('Error extracting PDF text:', error)
    throw error
  }
}

async function extractTextFromDOCX(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  } catch (error) {
    console.error('Error extracting DOCX text:', error)
    throw error
  }
}

export async function fetchAndExtractBuildingDocuments(buildingId: number): Promise<BuildingDocument[]> {
  if (typeof window === 'undefined') {
    return []
  }

  try {
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

    const extractedDocuments = await Promise.all(
      documents.map(async (doc) => {
        try {
          console.log(`Processing document: ${doc.filename} (${doc.mime_type})`)
          
          let extractedText = ''

          if (doc.mime_type === 'application/pdf') {
            extractedText = await extractTextFromPDF(doc.file_url)
          } else if (
            doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ) {
            extractedText = await extractTextFromDOCX(doc.file_url)
          } else if (doc.mime_type === 'text/plain') {
            const response = await fetch(doc.file_url)
            extractedText = await response.text()
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

    const validDocuments = extractedDocuments.filter((doc): doc is BuildingDocument => doc !== null)

    console.log(`Successfully processed ${validDocuments.length} out of ${documents.length} documents`)
    
    return validDocuments
  } catch (error) {
    console.error('Error in fetchAndExtractBuildingDocuments:', error)
    return []
  }
}
