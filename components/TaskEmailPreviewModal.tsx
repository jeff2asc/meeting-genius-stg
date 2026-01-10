"use client"

import { useState } from "react"
import { X, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface TaskEmailPreviewModalProps {
  assignees: Array<{ name: string; email: string }>
  taskDescription: string
  dueDate: string
  updateLink: string
  onConfirm: (customizedEmail: EmailTemplate) => void
  onCancel: () => void
}

export interface EmailTemplate {
  subject: string
  greeting: string
  bodyText: string
  additionalNotes: string  // ⭐ NEW
  buttonText: string
  footerText: string
}

export default function TaskEmailPreviewModal({
  assignees,
  taskDescription,
  dueDate,
  updateLink,
  onConfirm,
  onCancel
}: TaskEmailPreviewModalProps) {
  const [emailData, setEmailData] = useState<EmailTemplate>({
    subject: `New Task Assigned: ${taskDescription.substring(0, 50)}${taskDescription.length > 50 ? '...' : ''}`,
    greeting: 'Hi {name},',
    bodyText: 'You have been assigned a new task.',
    additionalNotes: '',  // ⭐ NEW - empty by default
    buttonText: 'Update Task Status',
    footerText: 'This link will expire in 90 days.'
  })

  const handleInputChange = (field: keyof EmailTemplate, value: string) => {
    setEmailData(prev => ({ ...prev, [field]: value }))
  }

  const generatePreviewHtml = (assigneeName: string) => {
    const greeting = emailData.greeting.replace('{name}', assigneeName)
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Task Assigned</h2>
        <p>${greeting}</p>
        <p>${emailData.bodyText}</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>Task:</strong> ${taskDescription}
          ${dueDate ? `<br><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}` : ''}
        </div>
        ${emailData.additionalNotes ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 15px; margin: 20px 0; border-radius: 4px;">
            <strong style="color: #92400e;">Additional Notes:</strong>
            <p style="margin: 8px 0 0 0; color: #78350f; white-space: pre-wrap;">${emailData.additionalNotes}</p>
          </div>
        ` : ''}
        <p>You can update the task status using the link below:</p>
        <a href="${updateLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">${emailData.buttonText}</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">${emailData.footerText}</p>
      </div>
    `
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 animate-in fade-in">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border-0 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-foreground">Customize Email</h2>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Recipients:</strong> {assignees.map(a => a.name).join(', ')}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Edit Fields */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Edit Email Content</h3>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Greeting <span className="text-xs text-muted-foreground">(use {'{name}'} for recipient name)</span>
                </label>
                <input
                  type="text"
                  value={emailData.greeting}
                  onChange={(e) => handleInputChange('greeting', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Body Text</label>
                <textarea
                  value={emailData.bodyText}
                  onChange={(e) => handleInputChange('bodyText', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              {/* ⭐ NEW: Additional Notes Field */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Additional Notes <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={emailData.additionalNotes}
                  onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                  placeholder="Add any special instructions, context, or notes here..."
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will appear as a highlighted note in the email
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Button Text</label>
                <input
                  type="text"
                  value={emailData.buttonText}
                  onChange={(e) => handleInputChange('buttonText', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Footer Text</label>
                <input
                  type="text"
                  value={emailData.footerText}
                  onChange={(e) => handleInputChange('footerText', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Preview</h3>
              <div className="border border-border rounded-lg p-4 bg-white overflow-auto max-h-[600px]">
                <div dangerouslySetInnerHTML={{ __html: generatePreviewHtml(assignees[0]?.name || 'Recipient') }} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm(emailData)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
            >
              Send Email to {assignees.length} {assignees.length === 1 ? 'Person' : 'People'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
