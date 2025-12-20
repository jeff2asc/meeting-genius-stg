"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

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

      // Generate HTML for agenda
      const agendaHTML = generateAgendaHTML(meeting, sections || [], topics || [])

      // Create PDF
      await convertHTMLToPDF(agendaHTML, meeting)

    } catch (error) {
      console.error("Error generating agenda:", error)
      alert("Failed to generate agenda PDF")
    } finally {
      setGenerating(false)
    }
  }

  const generateAgendaHTML = (meeting: any, sections: Section[], topics: Topic[]) => {
    const building = meeting.buildings
    const meetingDate = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })

    // Group topics by section
    const topicsBySection = topics.reduce((acc, topic) => {
      const sectionId = topic.section_id || "unsectioned"
      if (!acc[sectionId]) acc[sectionId] = []
      acc[sectionId].push(topic)
      return acc
    }, {} as Record<string | number, Topic[]>)

    let agendaContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: white;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
          <h1 style="font-size: 32px; color: #1e40af; margin: 0 0 10px 0;">MEETING AGENDA</h1>
          <h2 style="font-size: 24px; color: #374151; margin: 0;">${building?.name || "Building"}</h2>
        </div>

        <!-- Meeting Details -->
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #374151;">Meeting Type:</td>
              <td style="padding: 8px; color: #6b7280;">${meeting.meeting_type || "Council Meeting"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #374151;">Date:</td>
              <td style="padding: 8px; color: #6b7280;">${meetingDate}</td>
            </tr>
            ${meeting.start_time ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #374151;">Time:</td>
              <td style="padding: 8px; color: #6b7280;">${meeting.start_time}</td>
            </tr>
            ` : ""}
            ${meeting.location ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #374151;">Location:</td>
              <td style="padding: 8px; color: #6b7280;">${meeting.location}</td>
            </tr>
            ` : ""}
            ${building?.address ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #374151;">Building Address:</td>
              <td style="padding: 8px; color: #6b7280;">${building.address}</td>
            </tr>
            ` : ""}
          </table>
        </div>

        <!-- Agenda Items -->
        <div style="margin-top: 30px;">
          <h3 style="font-size: 20px; color: #1e40af; margin-bottom: 20px; border-bottom: 2px solid #93c5fd; padding-bottom: 10px;">Agenda Items</h3>
    `

    let itemNumber = 1

    // Add sections with topics
    sections.forEach((section) => {
      const sectionTopics = topicsBySection[section.id] || []
      
      agendaContent += `
        <div style="margin-bottom: 30px;">
          <h4 style="font-size: 18px; color: #2563eb; margin: 20px 0 10px 0; font-weight: bold;">
            ${itemNumber}. ${section.title}
          </h4>
      `

      if (sectionTopics.length > 0) {
        agendaContent += `<div style="margin-left: 20px;">`
        sectionTopics.forEach((topic: Topic, idx: number) => {
          agendaContent += `
            <div style="margin-bottom: 15px; padding: 10px; background: #f9fafb; border-left: 3px solid #60a5fa; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold; color: #374151;">
                ${itemNumber}.${idx + 1} ${topic.title}
              </p>
              ${topic.description ? `
                <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                  ${topic.description}
                </p>
              ` : ""}
            </div>
          `
        })
        agendaContent += `</div>`
      }

      agendaContent += `</div>`
      itemNumber++
    })

    // Add unsectioned topics if any
    const unsectionedTopics = topicsBySection["unsectioned"] || []
    if (unsectionedTopics.length > 0) {
      agendaContent += `
        <div style="margin-bottom: 30px;">
          <h4 style="font-size: 18px; color: #2563eb; margin: 20px 0 10px 0;">Other Items</h4>
          <div style="margin-left: 20px;">
      `
      unsectionedTopics.forEach((topic: Topic, idx: number) => {
        agendaContent += `
          <div style="margin-bottom: 15px; padding: 10px; background: #f9fafb; border-left: 3px solid #60a5fa; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #374151;">
              ${itemNumber}.${idx + 1} ${topic.title}
            </p>
            ${topic.description ? `
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                ${topic.description}
              </p>
            ` : ""}
          </div>
        `
      })
      agendaContent += `</div></div>`
    }

    agendaContent += `
        </div>

        <!-- Footer -->
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          <p style="margin: 5px 0 0 0;">Meeting Genius - Meeting Management System</p>
        </div>
      </div>
    `

    return agendaContent
  }

  const convertHTMLToPDF = async (html: string, meeting: any) => {
    // Create temporary container
    const container = document.createElement("div")
    container.innerHTML = html
    container.style.position = "absolute"
    container.style.left = "-9999px"
    container.style.width = "800px"
    document.body.appendChild(container)

    try {
      // Convert to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false
      })

      // Create PDF
      const pdf = new jsPDF("p", "mm", "a4")
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Download PDF
      const fileName = `${meeting.title || "Meeting"}_Agenda_${new Date().toISOString().split("T")[0]}.pdf`
      pdf.save(fileName)

    } finally {
      // Cleanup
      document.body.removeChild(container)
    }
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
