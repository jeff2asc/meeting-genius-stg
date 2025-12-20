"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"

interface GenerateAgendaButtonProps {
  meetingId: number
  meetingStatus: string
}

interface Topic {
  id: number
  title: string
  description: string | null
  section_id: number | null
  order_index: number
}

interface Section {
  id: number
  title: string
  order_index: number
}

export default function GenerateAgendaButton({
  meetingId,
  meetingStatus
}: GenerateAgendaButtonProps) {
  const [generating, setGenerating] = useState(false)

  // Only show for working_agenda and agenda statuses
  if (meetingStatus !== "working_agenda" && meetingStatus !== "agenda") {
    return null
  }

  const handleGenerateAgenda = async () => {
    setGenerating(true)

    try {
      // Fetch meeting data
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select(`
          *,
          buildings!inner(
            name,
            address,
            building_type
          )
        `)
        .eq("id", meetingId)
        .single()

      if (meetingError) throw meetingError

      // Fetch sections and topics
      const { data: sections, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (sectionsError) throw sectionsError

      const { data: topics, error: topicsError } = await supabase
        .from("topics")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (topicsError) throw topicsError

      // Generate PDF directly using jsPDF
      await generatePDF(meeting, sections || [], topics || [])

    } catch (error) {
      console.error("Error generating agenda:", error)
      alert("Failed to generate agenda PDF")
    } finally {
      setGenerating(false)
    }
  }

  const generatePDF = async (meeting: any, sections: Section[], topics: Topic[]) => {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin

    const building = meeting.buildings
    const meetingDate = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })

    // Helper function to add new page if needed
    const checkPageBreak = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > pageHeight - margin) {
        pdf.addPage()
        yPosition = margin
        return true
      }
      return false
    }

    // Helper to add wrapped text
    const addWrappedText = (text: string, x: number, fontSize: number, maxWidth: number, color: string = "#000000") => {
      pdf.setFontSize(fontSize)
      pdf.setTextColor(color)
      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach((line: string) => {
        checkPageBreak(fontSize * 0.5)
        pdf.text(line, x, yPosition)
        yPosition += fontSize * 0.5
      })
    }

    // Header
    pdf.setFillColor(37, 99, 235) // Blue
    pdf.rect(0, 0, pageWidth, 40, "F")
    
    pdf.setFontSize(24)
    pdf.setTextColor("#FFFFFF")
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING AGENDA", pageWidth / 2, 20, { align: "center" })
    
    pdf.setFontSize(16)
    pdf.text(building?.name || "Building", pageWidth / 2, 32, { align: "center" })
    
    yPosition = 55

    // Meeting Details Box
    pdf.setFillColor(243, 244, 246)
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, "F")
    
    pdf.setFontSize(10)
    pdf.setTextColor("#374151")
    pdf.setFont("helvetica", "bold")
    
    let detailY = yPosition + 10
    const addDetail = (label: string, value: string) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(label, margin + 5, detailY)
      pdf.setFont("helvetica", "normal")
      pdf.text(value, margin + 50, detailY)
      detailY += 8
    }

    addDetail("Meeting Type:", meeting.meeting_type || "Council Meeting")
    addDetail("Date:", meetingDate)
    if (meeting.start_time) addDetail("Time:", meeting.start_time)
    if (meeting.location) addDetail("Location:", meeting.location)
    if (building?.address) addDetail("Building Address:", building.address)

    yPosition = detailY + 10

    // Agenda Items Header
    checkPageBreak(20)
    pdf.setFontSize(16)
    pdf.setTextColor("#1e40af")
    pdf.setFont("helvetica", "bold")
    pdf.text("Agenda Items", margin, yPosition)
    yPosition += 2
    pdf.setDrawColor(147, 197, 253)
    pdf.setLineWidth(1)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Group topics by section
    const topicsBySection = topics.reduce((acc, topic) => {
      const sectionId = topic.section_id || "unsectioned"
      if (!acc[sectionId]) acc[sectionId] = []
      acc[sectionId].push(topic)
      return acc
    }, {} as Record<string | number, Topic[]>)

    let itemNumber = 1

    // Add sections with topics
    sections.forEach((section) => {
      const sectionTopics = topicsBySection[section.id] || []
      
      checkPageBreak(15)
      pdf.setFontSize(14)
      pdf.setTextColor("#2563eb")
      pdf.setFont("helvetica", "bold")
      pdf.text(`${itemNumber}. ${section.title}`, margin, yPosition)
      yPosition += 8

      if (sectionTopics.length > 0) {
        sectionTopics.forEach((topic: Topic, idx: number) => {
          checkPageBreak(20)
          
          // Topic box
          pdf.setFillColor(249, 250, 251)
          const boxHeight = topic.description ? 20 : 12
          pdf.rect(margin + 5, yPosition - 5, pageWidth - 2 * margin - 10, boxHeight, "F")
          
          // Blue left border
          pdf.setFillColor(96, 165, 250)
          pdf.rect(margin + 5, yPosition - 5, 2, boxHeight, "F")
          
          // Topic title
          pdf.setFontSize(11)
          pdf.setTextColor("#374151")
          pdf.setFont("helvetica", "bold")
          pdf.text(`${itemNumber}.${idx + 1} ${topic.title}`, margin + 10, yPosition)
          yPosition += 6
          
          // Topic description
          if (topic.description) {
            pdf.setFontSize(9)
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor("#6b7280")
            const descLines = pdf.splitTextToSize(topic.description, pageWidth - 2 * margin - 20)
            descLines.forEach((line: string) => {
              checkPageBreak(5)
              pdf.text(line, margin + 10, yPosition)
              yPosition += 4
            })
          }
          
          yPosition += 8
        })
      }

      itemNumber++
      yPosition += 5
    })

    // Add unsectioned topics if any
    const unsectionedTopics = topicsBySection["unsectioned"] || []
    if (unsectionedTopics.length > 0) {
      checkPageBreak(15)
      pdf.setFontSize(14)
      pdf.setTextColor("#2563eb")
      pdf.setFont("helvetica", "bold")
      pdf.text("Other Items", margin, yPosition)
      yPosition += 8

      unsectionedTopics.forEach((topic: Topic, idx: number) => {
        checkPageBreak(20)
        
        pdf.setFillColor(249, 250, 251)
        const boxHeight = topic.description ? 20 : 12
        pdf.rect(margin + 5, yPosition - 5, pageWidth - 2 * margin - 10, boxHeight, "F")
        
        pdf.setFillColor(96, 165, 250)
        pdf.rect(margin + 5, yPosition - 5, 2, boxHeight, "F")
        
        pdf.setFontSize(11)
        pdf.setTextColor("#374151")
        pdf.setFont("helvetica", "bold")
        pdf.text(`${itemNumber}.${idx + 1} ${topic.title}`, margin + 10, yPosition)
        yPosition += 6
        
        if (topic.description) {
          pdf.setFontSize(9)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor("#6b7280")
          const descLines = pdf.splitTextToSize(topic.description, pageWidth - 2 * margin - 20)
          descLines.forEach((line: string) => {
            checkPageBreak(5)
            pdf.text(line, margin + 10, yPosition)
            yPosition += 4
          })
        }
        
        yPosition += 8
      })
    }

    // Footer
    const footerY = pageHeight - 15
    pdf.setDrawColor(229, 231, 235)
    pdf.setLineWidth(0.5)
    pdf.line(margin, footerY, pageWidth - margin, footerY)
    
    pdf.setFontSize(8)
    pdf.setTextColor("#9ca3af")
    pdf.setFont("helvetica", "normal")
    pdf.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      pageWidth / 2,
      footerY + 5,
      { align: "center" }
    )
    pdf.text(
      "Meeting Genius - Meeting Management System",
      pageWidth / 2,
      footerY + 10,
      { align: "center" }
    )

    // Download PDF
    const fileName = `${meeting.title || "Meeting"}_Agenda_${new Date().toISOString().split("T")[0]}.pdf`
    pdf.save(fileName)
  }

  return (
    <Button
      onClick={handleGenerateAgenda}
      disabled={generating}
      variant="outline"
      className="gap-2"
    >
      {generating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" />
          Download Agenda
        </>
      )}
    </Button>
  )
}
