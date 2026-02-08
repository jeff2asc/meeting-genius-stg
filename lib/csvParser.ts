// lib/csvParser.ts

export interface CSVUser {
    name: string
    email: string
    user_type?: string
    password?: string
    building_name?: string
    building_id?: string
    row_number: number // For error tracking
  }
  
  export interface CSVParseResult {
    valid: CSVUser[]
    errors: Array<{
      row: number
      message: string
      data?: any
    }>
  }
  
  /**
   * Parse CSV file content and validate user data
   * Expected columns: name, email, user_type (optional), password (optional), building_name or building_id (optional)
   */
  export function parseCSV(csvContent: string): CSVParseResult {
    const valid: CSVUser[] = []
    const errors: Array<{ row: number; message: string; data?: any }> = []
  
    // Split into lines and remove empty lines
    const lines = csvContent.split('\n').filter(line => line.trim())
  
    if (lines.length === 0) {
      errors.push({ row: 0, message: 'CSV file is empty' })
      return { valid, errors }
    }
  
    // Parse header row
    const headerRow = lines[0].trim()
    const headers = parseCSVLine(headerRow).map(h => h.toLowerCase().trim())
  
    // Validate required columns
    const nameIndex = headers.indexOf('name')
    const emailIndex = headers.indexOf('email')
    
    if (nameIndex === -1) {
      errors.push({ row: 0, message: 'Missing required column: "name"' })
    }
    if (emailIndex === -1) {
      errors.push({ row: 0, message: 'Missing required column: "email"' })
    }
  
    if (nameIndex === -1 || emailIndex === -1) {
      return { valid, errors }
    }
  
    // Optional columns
    const userTypeIndex = headers.indexOf('user_type')
    const passwordIndex = headers.indexOf('password')
    const buildingNameIndex = headers.indexOf('building_name')
    const buildingIdIndex = headers.indexOf('building_id')
  
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines
  
      const rowNumber = i + 1
      const values = parseCSVLine(line)
  
      // Extract values
      const name = values[nameIndex]?.trim() || ''
      const email = values[emailIndex]?.trim() || ''
      const user_type = userTypeIndex !== -1 ? values[userTypeIndex]?.trim() : undefined
      const password = passwordIndex !== -1 ? values[passwordIndex]?.trim() : undefined
      const building_name = buildingNameIndex !== -1 ? values[buildingNameIndex]?.trim() : undefined
      const building_id = buildingIdIndex !== -1 ? values[buildingIdIndex]?.trim() : undefined
  
      // Validate required fields
      if (!name) {
        errors.push({ 
          row: rowNumber, 
          message: 'Name is required', 
          data: { name, email } 
        })
        continue
      }
  
      if (!email) {
        errors.push({ 
          row: rowNumber, 
          message: 'Email is required', 
          data: { name, email } 
        })
        continue
      }
  
      // Validate email format
      if (!isValidEmail(email)) {
        errors.push({ 
          row: rowNumber, 
          message: 'Invalid email format', 
          data: { name, email } 
        })
        continue
      }
  
      // Validate user_type if provided
      if (user_type && !isValidUserType(user_type)) {
        errors.push({ 
          row: rowNumber, 
          message: `Invalid user_type: "${user_type}". Must be one of: owner, resident, user, vendor, attendee, property_manager`, 
          data: { name, email, user_type } 
        })
        continue
      }
  
      // Validate password if provided (minimum 6 characters)
      if (password && password.length < 6) {
        errors.push({ 
          row: rowNumber, 
          message: 'Password must be at least 6 characters', 
          data: { name, email } 
        })
        continue
      }
  
      // Add to valid users
      valid.push({
        name,
        email: email.toLowerCase(),
        user_type,
        password, // ⭐ NEW: Include password
        building_name,
        building_id,
        row_number: rowNumber,
      })
    }
  
    return { valid, errors }
  }
  
  /**
   * Parse a single CSV line, handling quoted values with commas
   */
  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
  
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
  
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  
    // Add last field
    result.push(current)
  
    return result
  }
  
  /**
   * Validate email format
   */
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  /**
   * Validate user_type
   */
  function isValidUserType(type: string): boolean {
    const validTypes = ['owner', 'resident', 'user', 'vendor', 'attendee', 'property_manager']
    return validTypes.includes(type.toLowerCase())
  }
  
  /**
   * Generate example CSV content for download
   */
  export function generateExampleCSV(): string {
    const headers = 'name,email,user_type,password'
    const examples = [
      'John Doe,john.doe@example.com,owner,Welcome123',
      'Jane Smith,jane.smith@example.com,resident,MyPassword456',
      'Bob Johnson,bob.johnson@example.com,user,SamePass789',
    ]
    
    return [headers, ...examples].join('\n')
  }
  