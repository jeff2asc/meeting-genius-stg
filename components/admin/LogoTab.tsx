"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Trash2, Image as ImageIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"


interface LogoTabProps {
  companyId: number
  currentLogoUrl: string | null
  onLogoUpdate: () => void
}


export default function LogoTab({ companyId, currentLogoUrl, onLogoUpdate }: LogoTabProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)


  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return


    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG)')
      return
    }


    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB')
      return
    }


    setUploading(true)
    try {
      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/company-logos/')[1]
        if (oldPath) {
          await supabase.storage.from('company-logos').remove([oldPath])
        }
      }


      // Upload new logo
      const fileExt = file.name.split('.').pop()
      const fileName = `${companyId}/logo.${fileExt}`


      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true })


      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }


      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName)


      // Update database
      const { error: dbError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', companyId)


      if (dbError) {
        console.error('Database error:', dbError)
        throw dbError
      }


      toast.success('Logo uploaded successfully')
      // Flag that logo was updated so Dashboard can refresh
      localStorage.setItem('company_logo_updated', '1')
      onLogoUpdate()
    } catch (err) {
      console.error('Error uploading logo:', err)
      toast.error('Failed to upload logo')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }


  const handleDelete = async () => {
    if (!currentLogoUrl) return
    if (!confirm('Delete company logo? This will remove the logo from all displays.')) return


    setDeleting(true)
    try {
      // Delete from storage
      const filePath = currentLogoUrl.split('/company-logos/')[1]
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('company-logos')
          .remove([filePath])
        
        if (storageError) {
          console.error('Storage delete error:', storageError)
        }
      }


      // Update database
      const { error: dbError } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', companyId)


      if (dbError) {
        console.error('Database error:', dbError)
        throw dbError
      }


      toast.success('Logo deleted')
      // Flag that logo was updated so Dashboard can refresh
      localStorage.setItem('company_logo_updated', '1')
      onLogoUpdate()
    } catch (err) {
      console.error('Error deleting logo:', err)
      toast.error('Failed to delete logo')
    } finally {
      setDeleting(false)
    }
  }


  return (
    <div className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Company Logo
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload your company logo. This will appear in the header for all company users (Property Managers, Corporate Admins, and Users).
        </p>
      </div>


      {/* Current Logo Preview */}
      {currentLogoUrl ? (
        <div className="border rounded-lg p-6 bg-muted/20">
          <p className="text-sm font-medium mb-4">Current Logo:</p>
          <div className="flex items-start gap-6">
            <div className="relative">
              <img 
                src={currentLogoUrl} 
                alt="Company Logo" 
                className="h-32 w-32 rounded-lg object-cover border-2 border-border shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                This logo is displayed in the application header for company users.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="w-fit"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete Logo'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 bg-muted/10 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No logo uploaded yet. Company users will see the default Meeting Genius logo.
          </p>
        </div>
      )}


      {/* Upload Section */}
      <div className="space-y-3">
        <label htmlFor="logo-upload">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            className="w-full sm:w-auto"
            onClick={() => document.getElementById('logo-upload')?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : currentLogoUrl ? 'Replace Logo' : 'Upload Logo'}
          </Button>
        </label>
        <input
          id="logo-upload"
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
          onChange={handleUpload}
          disabled={uploading}
        />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Recommended: Square image (200x200px minimum)</p>
          <p>• Supported formats: PNG, JPG, SVG</p>
          <p>• Maximum file size: 2MB</p>
          <p>• Transparent background recommended for best results</p>
        </div>
      </div>
    </div>
  )
}
