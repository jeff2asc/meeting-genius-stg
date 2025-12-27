"use client"

import { useState, useEffect } from "react"
import { X, Building2, Users, FileText, Plus, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"

interface User {
  id: number
  name: string
  email: string
  user_type: string
  company_id: number | null
}

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  created_at: string
  users?: Array<{ id: number; name: string; email: string; user_type: string }>
}

interface BuildingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  availableUsers: User[]
}

type TabType = "details" | "users" | "documents"

export default function BuildingDetailsModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  availableUsers,
}: BuildingDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("details")
  const [buildingName, setBuildingName] = useState("")
  const [buildingAddress, setBuildingAddress] = useState("")
  const [buildingType, setBuildingType] = useState("")
  const [managerId, setManagerId] = useState<number | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [propertyManagers, setPropertyManagers] = useState<User[]>([])
  const [submitting, setSubmitting] = useState(false)

  // inline "add user" state
  const [showAddUserForm, setShowAddUserForm] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [creatingUser, setCreatingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && building) {
      setBuildingName(building.name)
      setBuildingAddress(building.address || "")
      setBuildingType(building.building_type || "Strata/Condo")
      setManagerId(building.manager_id)
      setSelectedUsers(building.users?.map((u) => u.id) || [])
      setActiveTab("details")
      fetchPropertyManagers()
    }
  }, [isOpen, building])

  const fetchPropertyManagers = async () => {
    if (!building) return

    try {
      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id")
        .eq("user_type", "property_manager")
        .order("name")

      if (building.company_id) {
        query = query.eq("company_id", building.company_id)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching property managers:", error)
        return
      }

      setPropertyManagers((data || []) as User[])
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const handleCreateNewUser = async () => {
    if (!building) return

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError("Name, email and password are required")
      return
    }

    setCreatingUser(true)
    setError(null)

    try {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: newUserName.trim(),
          email: newUserEmail.toLowerCase().trim(),
          password_hash:
            "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
          user_type: "user",
          company_id: building.company_id,
          assigned_pm_id: managerId,
        })
        .select()
        .single()

      if (userError || !newUser) {
        console.error("Error creating user:", userError)
        setError("Failed to create user. Email may already exist.")
        setCreatingUser(false)
        return
      }

      const { error: assignError } = await supabase
        .from("user_buildings")
        .insert({
          user_id: newUser.id,
          building_id: building.id,
        })

      if (assignError) {
        console.error("Error assigning user to building:", assignError)
        setError("User created but failed to assign to building.")
        setCreatingUser(false)
        return
      }

      setSelectedUsers((prev) => [...prev, newUser.id])

      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setShowAddUserForm(false)

      await onSuccess()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Unexpected error creating user.")
    } finally {
      setCreatingUser(false)
    }
  }

  const handleSubmit = async () => {
    if (!buildingName.trim() || !managerId || !building) {
      alert("Please fill in all required fields")
      return
    }

    setSubmitting(true)

    try {
      const { error: updateError } = await supabase
        .from("buildings")
        .update({
          name: buildingName.trim(),
          address: buildingAddress.trim() || null,
          building_type: buildingType,
          manager_id: managerId,
        })
        .eq("id", building.id)

      if (updateError) {
        console.error("Error updating building:", updateError)
        alert("Failed to update building")
        return
      }

      const currentUserIds = building.users?.map((u) => u.id) || []
      const usersToAdd = selectedUsers.filter((id) => !currentUserIds.includes(id))
      const usersToRemove = currentUserIds.filter((id) => !selectedUsers.includes(id))

      if (usersToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("user_buildings")
          .delete()
          .eq("building_id", building.id)
          .in("user_id", usersToRemove)

        if (deleteError) {
          console.error("Error removing users:", deleteError)
        }
      }

      if (usersToAdd.length > 0) {
        const insertData = usersToAdd.map((userId) => ({
          building_id: building.id,
          user_id: userId,
        }))

        const { error: insertError } = await supabase
          .from("user_buildings")
          .insert(insertData)

        if (insertError) {
          console.error("Error adding users:", insertError)
        }
      }

      await onSuccess()
      onClose()
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to update building")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const filteredAvailableUsers = building
    ? availableUsers.filter(
        (user) => !building.company_id || user.company_id === building.company_id
      )
    : []

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-decision-purple/10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Building Details</h2>
            <p className="text-sm text-muted-foreground mt-1">{building.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-border">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "details"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Details
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "users"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Users ({selectedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "documents"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "details" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="buildingName">Building Name *</Label>
                <Input
                  id="buildingName"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="Enter building name"
                />
              </div>

              <div>
                <Label htmlFor="buildingAddress">Address</Label>
                <Input
                  id="buildingAddress"
                  value={buildingAddress}
                  onChange={(e) => setBuildingAddress(e.target.value)}
                  placeholder="Enter building address"
                />
              </div>

              <div>
                <Label htmlFor="buildingType">Building Type *</Label>
                <Select value={buildingType} onValueChange={setBuildingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strata/Condo">Strata/Condo</SelectItem>
                    <SelectItem value="Rental">Rental Building</SelectItem>
                    <SelectItem value="Housing Co-op">Housing Co-op</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="manager">Property Manager *</Label>
                <Select
                  value={managerId?.toString() || ""}
                  onValueChange={(value) => setManagerId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyManagers.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id.toString()}>
                        {pm.name} ({pm.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium text-sm text-muted-foreground mb-2">Metadata</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Building ID:</span> {building.id}
                  </p>
                  <p>
                    <span className="font-medium">Company ID:</span>{" "}
                    {building.company_id || "None"}
                  </p>
                  <p>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(building.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Manage Building Users</h3>
                <Button
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New User
                </Button>
              </div>

              {error && (
                <p className="text-sm text-red-500">
                  {error}
                </p>
              )}

              {showAddUserForm && (
                <Card className="p-4 bg-muted/50 border-2 border-primary/20">
                  <h4 className="font-medium text-sm mb-3">Create New User</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="newUserName">Name *</Label>
                      <Input
                        id="newUserName"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter user name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserEmail">Email *</Label>
                      <Input
                        id="newUserEmail"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="Enter user email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserPassword">Password *</Label>
                      <Input
                        id="newUserPassword"
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Enter temporary password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateNewUser}
                        disabled={creatingUser}
                        size="sm"
                        className="bg-gradient-to-r from-primary to-decision-purple"
                      >
                        {creatingUser ? "Creating..." : "Create & Assign User"}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowAddUserForm(false)
                          setNewUserName("")
                          setNewUserEmail("")
                          setNewUserPassword("")
                          setError(null)
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      User will be created with company ID: {building.company_id || "None"} and
                      automatically assigned to this building.
                    </p>
                  </div>
                </Card>
              )}

              {filteredAvailableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No users available in this company. Create a new user above.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Select users to assign to this building (showing{" "}
                    {filteredAvailableUsers.length} users from company{" "}
                    {building.company_id || "N/A"}):
                  </p>
                  <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
                    {filteredAvailableUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {user.user_type}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentsTab building={building} onSuccess={onSuccess} />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-primary to-decision-purple"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ============================================
// Documents Tab Component
// ============================================

interface DocumentsTabProps {
  building: Building
  onSuccess: () => void
}

function DocumentsTab({ building, onSuccess }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState("rules")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('building_documents')
        .select('*')
        .eq('building_id', building.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return
      }

      setDocuments(data || [])
    } catch (err) {
      console.error('Unexpected error fetching documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!validTypes.includes(file.type)) {
        alert('Please select a PDF, DOC, or DOCX file')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }

      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file')
      return
    }

    setUploading(true)

    try {
      const fileName = `${building.id}/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('building-documents')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error('Failed to upload file to storage')
      }

      const { data: { publicUrl } } = supabase.storage
        .from('building-documents')
        .getPublicUrl(fileName)

      const { error: dbError } = await supabase
        .from('building_documents')
        .insert({
          building_id: building.id,
          document_type: selectedDocType,
          filename: selectedFile.name,
          file_url: publicUrl,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
        })

      if (dbError) {
        console.error('Database error:', dbError)
        throw new Error('Failed to save document metadata')
      }

      alert('Document uploaded successfully!')
      setSelectedFile(null)
      await fetchDocuments()
      await onSuccess()

    } catch (error: any) {
      console.error('Upload error:', error)
      alert(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: number, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const filePath = fileUrl.split('/building-documents/')[1]
      if (filePath) {
        await supabase.storage
          .from('building-documents')
          .remove([filePath])
      }

      const { error: dbError } = await supabase
        .from('building_documents')
        .delete()
        .eq('id', docId)

      if (dbError) {
        throw new Error('Failed to delete document')
      }

      alert('Document deleted successfully')
      await fetchDocuments()
      await onSuccess()

    } catch (error: any) {
      console.error('Delete error:', error)
      alert(error.message || 'Delete failed')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'statute':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'rules':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'bylaws':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-decision-purple/5 border-primary/20">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload New Document
        </h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="docType" className="text-sm font-medium">
              Document Type *
            </Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger id="docType" className="mt-1">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="statute">Statute</SelectItem>
                <SelectItem value="rules">Rules & Regulations</SelectItem>
                <SelectItem value="bylaws">Bylaws</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fileUpload" className="text-sm font-medium">
              Select File (PDF, DOC, DOCX) *
            </Label>
            <Input
              id="fileUpload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileSelect}
              disabled={uploading}
              className="mt-1"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: <span className="font-medium">{selectedFile.name}</span> 
                ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={uploading || !selectedFile}
            className="w-full bg-gradient-to-r from-primary to-decision-purple hover:opacity-90"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            Maximum file size: 10MB. Supported formats: PDF, DOC, DOCX
          </p>
        </div>
      </Card>

      {/* Documents List */}
      <div>
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Uploaded Documents ({documents.length})
        </h3>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 border-4 text-primary animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h4 className="font-medium text-foreground mb-2">No Documents Yet</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload building statutes, rules, regulations, or bylaws using the form above. 
              These documents will be used for AI-powered meeting descriptions.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs capitalize ${getDocumentTypeColor(doc.document_type)}`}
                        >
                          {doc.document_type}
                        </Badge>
                        <p className="font-medium text-sm">{doc.filename}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        {doc.file_size && ` • ${formatFileSize(doc.file_size)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </a>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(doc.id, doc.file_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
