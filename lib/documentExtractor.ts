import { supabase } from './supabase'
import pdfToText from 'react-pdftotext'
import mammoth from 'mammoth'


interface BuildingDocument {
  type: string
  filename: string
  text: string
}


// ⭐ Task attachment interface
interface TaskAttachment {
  filename: string
  text: string
}


// ⭐ NEW: Topic attachment interface
interface TopicAttachment {
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


// ⭐ UPDATED: Generic text extraction function (now supports File objects and URLs)
export async function extractTextFromFile(
  fileOrUrl: File | string, 
  mimeType?: string
): Promise<string> {
  try {
    // Handle File object (from uploads)
    if (fileOrUrl instanceof File) {
      const file = fileOrUrl
      const fileMimeType = file.type

      if (fileMimeType === 'application/pdf') {
        const text = await pdfToText(file)
        return text
      } else if (
        fileMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value
      } else if (fileMimeType === 'text/plain') {
        return await file.text()
      } else if (fileMimeType.startsWith('image/')) {
        console.log(`Image file detected: ${file.name}. OCR not implemented yet.`)
        return '[Image file - text extraction not supported]'
      } else {
        console.warn(`Unsupported file type: ${fileMimeType}`)
        return '[Unsupported file type]'
      }
    }

    // Handle URL string (from storage)
    if (typeof fileOrUrl === 'string' && mimeType) {
      const fileUrl = fileOrUrl

      if (mimeType === 'application/pdf') {
        return await extractTextFromPDF(fileUrl)
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        return await extractTextFromDOCX(fileUrl)
      } else if (mimeType === 'text/plain') {
        const response = await fetch(fileUrl)
        return await response.text()
      } else if (mimeType.startsWith('image/')) {
        console.log(`Image file detected: ${fileUrl}. OCR not implemented yet.`)
        return '[Image file - text extraction not supported]'
      } else {
        console.warn(`Unsupported file type: ${mimeType}`)
        return '[Unsupported file type]'
      }
    }

    throw new Error('Invalid input: must provide File object or URL with mimeType')
  } catch (error) {
    console.error(`Error extracting text:`, error)
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
          
          const extractedText = await extractTextFromFile(doc.file_url, doc.mime_type)


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


// ⭐ Fetch and extract task attachments
export async function fetchAndExtractTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
  if (typeof window === 'undefined') {
    return []
  }


  try {
    const { data: attachments, error: dbError } = await supabase
      .from('task_attachments')
      .select('id, filename, file_url, mime_type')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })


    if (dbError) {
      console.error('Error fetching task attachments:', dbError)
      return []
    }


    if (!attachments || attachments.length === 0) {
      console.log('No attachments found for task ID:', taskId)
      return []
    }


    console.log(`Found ${attachments.length} attachments for task ID ${taskId}`)


    const extractedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          console.log(`Processing attachment: ${attachment.filename} (${attachment.mime_type})`)
          
          const extractedText = await extractTextFromFile(attachment.file_url, attachment.mime_type)


          if (!extractedText || extractedText.trim().length === 0) {
            console.warn(`No text extracted from ${attachment.filename}`)
            return null
          }


          console.log(`Successfully extracted ${extractedText.length} characters from ${attachment.filename}`)


          return {
            filename: attachment.filename,
            text: extractedText.trim()
          }
        } catch (error) {
          console.error(`Error processing attachment ${attachment.filename}:`, error)
          return null
        }
      })
    )


    const validAttachments = extractedAttachments.filter((att): att is TaskAttachment => att !== null)


    console.log(`Successfully processed ${validAttachments.length} out of ${attachments.length} attachments`)
    
    return validAttachments
  } catch (error) {
    console.error('Error in fetchAndExtractTaskAttachments:', error)
    return []
  }
}


// ⭐ NEW: Fetch and extract topic attachments
export async function fetchAndExtractTopicAttachments(topicId: number): Promise<TopicAttachment[]> {
  if (typeof window === 'undefined') {
    return []
  }


  try {
    const { data: attachments, error: dbError } = await supabase
      .from('topic_attachments')
      .select('id, filename, file_url, mime_type')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })


    if (dbError) {
      console.error('Error fetching topic attachments:', dbError)
      return []
    }


    if (!attachments || attachments.length === 0) {
      console.log('No attachments found for topic ID:', topicId)
      return []
    }


    console.log(`Found ${attachments.length} attachments for topic ID ${topicId}`)


    const extractedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          console.log(`Processing attachment: ${attachment.filename} (${attachment.mime_type})`)
          
          const extractedText = await extractTextFromFile(attachment.file_url, attachment.mime_type)


          if (!extractedText || extractedText.trim().length === 0) {
            console.warn(`No text extracted from ${attachment.filename}`)
            return null
          }


          console.log(`Successfully extracted ${extractedText.length} characters from ${attachment.filename}`)


          return {
            filename: attachment.filename,
            text: extractedText.trim()
          }
        } catch (error) {
          console.error(`Error processing attachment ${attachment.filename}:`, error)
          return null
        }
      })
    )


    const validAttachments = extractedAttachments.filter((att): att is TopicAttachment => att !== null)


    console.log(`Successfully processed ${validAttachments.length} out of ${attachments.length} attachments`)
    
    return validAttachments
  } catch (error) {
    console.error('Error in fetchAndExtractTopicAttachments:', error)
    return []
  }
}
