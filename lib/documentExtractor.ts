import { supabase } from './supabase'

interface BuildingDocument {
  type: string
  filename: string
  text: string
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // Dynamic import only on client side
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      fullText += pageText + '\n\n'
    }
    
    return fullText.trim()
  } catch (error) {
    console.error('Error extracting PDF text:', error)
    throw error
  }
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  // Dynamic import only on client side
  const mammoth = await import('mammoth')
  
  try {
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  } catch (error) {
    console.error('Error extracting DOCX text:', error)
    throw error
  }
}

async function extractTextFromTXT(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(arrayBuffer)
  } catch (error) {
    console.error('Error extracting TXT text:', error)
    throw error
  }
}

export async function fetchAndExtractBuildingDocuments(buildingId: number): Promise<BuildingDocument[]> {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.log('Skipping document extraction on server side')
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
          
          const response = await fetch(doc.file_url)
          if (!response.ok) {
            console.error(`Failed to download ${doc.filename}`)
            return null
          }

          const arrayBuffer = await response.arrayBuffer()
          let extractedText = ''

          const normalizedType = doc.mime_type?.toLowerCase() || ''

          if (normalizedType === 'application/pdf') {
            extractedText = await extractTextFromPDF(arrayBuffer)
          } else if (
            normalizedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            normalizedType === 'application/msword'
          ) {
            extractedText = await extractTextFromDOCX(arrayBuffer)
          } else if (normalizedType === 'text/plain') {
            extractedText = await extractTextFromTXT(arrayBuffer)
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
