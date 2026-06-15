"use client"

import { useState } from "react"
import { X, Upload, Download, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { parseCSV, generateExampleCSV, CSVUser } from "@/lib/csvParser"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"

interface ImportUsersModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  buildingId: number
  buildingName: string
  buildingType: string
  companyId: number | null
  managerId: number
}

export default function ImportUsersModal({
  isOpen,
  onClose,
  onSuccess,
  buildingId,
  buildingName,
  buildingType,
  companyId,
  managerId,
}: ImportUsersModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedUsers, setParsedUsers] = useState<CSVUser[]>([])
  const [parseErrors, setParseErrors] = useState<Array<{ row: number; message: string }>>([])
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload")
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{
    created: number
    skipped: number
    errors: string[]
  } | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setSelectedFile(file)
    parseFile(file)
  }

  const parseFile = async (file: File) => {
    try {
      const content = await file.text()
      const result = parseCSV(content)

      setParsedUsers(result.valid)
      setParseErrors(result.errors)

      if (result.valid.length > 0) {
        setStep("preview")
      } else {
        toast.error('No valid users found in CSV file')
      }
    } catch (error) {
      console.error('Error parsing CSV:', error)
      toast.error('Failed to parse CSV file')
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setStep("importing")

    try {
      const data = await apiClient.v1.users.bulkImport({
        users: parsedUsers,
        buildingId,
        buildingType,
        companyId,
        managerId,
      })

      setImportResults(data)
      
      if (data.created > 0) {
        toast.success(`Successfully imported ${data.created} user(s)!`)
      }
      
      if (data.skipped > 0) {
        toast.warning(`Skipped ${data.skipped} user(s) (duplicates or errors)`)
      }

      // Wait a moment then close and refresh
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 2000)

    } catch (error: any) {
      console.error('Import error:', error)
      toast.error(error.message || 'Failed to import users')
      setStep("preview")
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setParsedUsers([])
    setParseErrors([])
    setStep("upload")
    setImporting(false)
    setImportResults(null)
    onClose()
  }

  const downloadExample = () => {
    const csvContent = generateExampleCSV()
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'example_users_import.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Example CSV downloaded!')
  }

  const getDefaultUserType = (buildingType: string): string => {
    if (buildingType === "Housing Co-op") return "resident"
    return "owner"
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-decision-purple/10">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Upload className="h-6 w-6" />
              Import Users
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Bulk import users to <strong>{buildingName}</strong>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} disabled={importing}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "upload" && (
            <div className="space-y-6">
              {/* Instructions */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  CSV Format Requirements
                </h3>
                <ul className="text-xs text-blue-800 space-y-1 ml-6 list-disc">
                  <li><strong>Required columns:</strong> name, email</li>
                  <li><strong>Optional columns:</strong> user_type (owner, resident, user, vendor, attendee)</li>
                  <li>If user_type is not provided, it will auto-assign based on building type</li>
                  <li><strong>{buildingType}</strong> buildings default to <strong>{getDefaultUserType(buildingType)}</strong> type</li>
                  <li>Maximum file size: 5MB</li>
                </ul>
              </Card>

              {/* Download Example */}
              <div className="flex justify-center">
                <Button
                  onClick={downloadExample}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Example CSV
                </Button>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-2">
                  {selectedFile ? selectedFile.name : 'Choose a CSV file to import'}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Drag and drop or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input">
                  <Button asChild variant="default">
                    <span>Select CSV File</span>
                  </Button>
                </label>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-green-50 border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-900">{parsedUsers.length}</p>
                      <p className="text-xs text-green-700">Valid Users</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 bg-red-50 border-red-200">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-900">{parseErrors.length}</p>
                      <p className="text-xs text-red-700">Errors</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Errors */}
              {parseErrors.length > 0 && (
                <Card className="p-4 bg-red-50 border-red-200">
                  <h3 className="font-semibold text-sm mb-2 text-red-900">Errors Found</h3>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {parseErrors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-800">
                        Row {error.row}: {error.message}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

              {/* Valid Users Preview */}
              {parsedUsers.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Users to Import ({parsedUsers.length})</h3>
                  <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Name</th>
                          <th className="text-left p-2 font-medium">Email</th>
                          <th className="text-left p-2 font-medium">User Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedUsers.map((user, idx) => (
                          <tr key={idx} className="border-t border-border">
                            <td className="p-2">{user.name}</td>
                            <td className="p-2 text-muted-foreground">{user.email}</td>
                            <td className="p-2">
                              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                                {user.user_type || getDefaultUserType(buildingType)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-semibold">Importing users...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>

              {importResults && (
                <Card className="mt-6 p-4 bg-green-50 border-green-200 w-full max-w-md">
                  <h3 className="font-semibold text-sm mb-2 text-green-900">Import Complete!</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-green-800">✓ {importResults.created} users created</p>
                    {importResults.skipped > 0 && (
                      <p className="text-orange-800">⚠ {importResults.skipped} users skipped</p>
                    )}
                    {importResults.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-red-800 font-medium">Errors:</p>
                        <ul className="text-xs text-red-700 ml-4 list-disc">
                          {importResults.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload")
                  setSelectedFile(null)
                  setParsedUsers([])
                  setParseErrors([])
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedUsers.length === 0}
                className="bg-gradient-to-r from-primary to-decision-purple"
              >
                Import {parsedUsers.length} User(s)
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
