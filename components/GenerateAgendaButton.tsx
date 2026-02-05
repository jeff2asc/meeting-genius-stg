"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { generateCanvasPDF } from "@/lib/canvasPDFGenerator"
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
  is_incamera?: boolean
  incamera_start_time?: string | null
  incamera_end_time?: string | null
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

  if (meetingStatus !== "working_agenda" && meetingStatus !== "agenda") {
    return null
  }

  const handleGenerateAgenda = async () => {
    setGenerating(true)

    try {
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select(`
          *,
          buildings!inner(
            name,
            address,
            building_type,
            logo_url,
            company_id,
            companies (
              logo_url
            )
          )
        `)
        .eq("id", meetingId)
        .single()

      if (meetingError) throw meetingError

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

      const companyId = meeting?.buildings?.company_id
      if (companyId) {
        const { data: template } = await supabase
          .from("company_agenda_templates")
          .select("blocks")
          .eq("company_id", companyId)
          .single()
        const elements = template?.blocks?.canvas?.elements
        if (elements && Array.isArray(elements) && elements.length > 0) {
          await generateCanvasPDF(elements, meeting, sections || [], topics || [])
          return
        }
      }
      await generatePDF(meeting, sections || [], topics || [])
    } catch (error) {
      console.error("Error generating agenda:", error)
      alert("Failed to generate agenda PDF")
    } finally {
      setGenerating(false)
    }
  }

  const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { mode: "cors" })
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      return null
    }
  }

  const generatePDF = async (meeting: any, sections: Section[], topics: Topic[]) => {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 18
    let yPosition = margin
    let currentPage = 1

    const building = meeting.buildings
    const company = building?.companies

    const meetingDate = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })

    const logoUrl: string | null = building?.logo_url || company?.logo_url || null
    let logoDataUrl: string | null = null

    if (logoUrl) {
      logoDataUrl = await loadImageAsDataUrl(logoUrl)
    }

    const colors = {
      navy: [15, 35, 90],
      blue: [41, 98, 255],
      lightBlue: [100, 140, 255],
      skyBlue: [220, 235, 255],
      red: [220, 38, 38],
      white: [255, 255, 255],
      lightGray: [245, 248, 250],
      mediumGray: [156, 163, 175],
      darkGray: [31, 41, 55],
      border: [209, 213, 219]
    }

    const setColor = (color: number[], type: "fill" | "text" | "draw" = "fill") => {
      if (type === "fill") pdf.setFillColor(color[0], color[1], color[2])
      else if (type === "text") pdf.setTextColor(color[0], color[1], color[2])
      else if (type === "draw") pdf.setDrawColor(color[0], color[1], color[2])
    }

    const drawStripedBackground = () => {
      setColor(colors.skyBlue, "fill")
      pdf.rect(0, 0, pageWidth, 80, "F")
      pdf.setLineWidth(0.5)
      setColor([210, 230, 255], "draw")
      for (let i = -80; i < pageWidth + 80; i += 8) {
        pdf.line(i, 0, i + 80, 80)
      }
    }

    const addContinuationHeader = () => {
      setColor(colors.navy, "fill")
      pdf.rect(0, 0, pageWidth, 8, "F")
      pdf.setFontSize(9)
      setColor(colors.white, "text")
      pdf.setFont("helvetica", "bold")
      pdf.text(meeting.title || "Meeting Agenda", margin, 5.5)
      yPosition = 16
    }

    const addNewPage = () => {
      pdf.addPage()
      currentPage++
      addContinuationHeader()
    }

    const checkPageBreak = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > pageHeight - 18) {
        addNewPage()
        return true
      }
      return false
    }

    const addPageFooter = () => {
      const footerY = pageHeight - 10
      setColor(colors.navy, "fill")
      pdf.rect(0, footerY - 3, pageWidth, 15, "F")
      pdf.setFontSize(8)
      setColor(colors.white, "text")
      pdf.setFont("helvetica", "normal")
      pdf.text(building?.name || "", margin, footerY + 1)
      pdf.text(`Page ${currentPage}`, pageWidth / 2, footerY + 1, { align: "center" })
      pdf.text("Meeting Genius", pageWidth - margin, footerY + 1, { align: "right" })
    }

    // ==================== COVER PAGE ====================
    drawStripedBackground()
    setColor(colors.navy, "fill")
    pdf.rect(0, 0, pageWidth, 80, "F")

    if (logoDataUrl) {
      try {
        setColor(colors.white, "fill")
        pdf.circle(margin + 12, 18, 10, "F")
        pdf.addImage(logoDataUrl, "PNG", margin + 2, 8, 20, 20, undefined, "FAST")
      } catch (e) {
        console.error("Logo error:", e)
      }
    }

    pdf.setFontSize(42)
    setColor(colors.white, "text")
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING", pageWidth / 2, 38, { align: "center" })
    pdf.text("AGENDA", pageWidth / 2, 52, { align: "center" })
    pdf.setFontSize(16)
    setColor(colors.lightBlue, "text")
    pdf.setFont("helvetica", "normal")
    pdf.text(building?.name || "Building", pageWidth / 2, 64, { align: "center" })
    pdf.setFontSize(11)
    setColor([200, 220, 255], "text")
    pdf.text(meeting.meeting_type || "Council Meeting", pageWidth / 2, 72, { align: "center" })
    yPosition = 92

    // ==================== INFO CARD ====================
    checkPageBreak(50)
    const cardWidth = pageWidth - 2 * margin
    setColor([180, 190, 200], "fill")
    pdf.roundedRect(margin + 1, yPosition + 1, cardWidth, 48, 5, 5, "F")
    setColor(colors.white, "fill")
    pdf.roundedRect(margin, yPosition, cardWidth, 48, 5, 5, "F")
    setColor(colors.blue, "fill")
    pdf.roundedRect(margin, yPosition, cardWidth, 8, 5, 5, "F")
    pdf.rect(margin, yPosition + 5, cardWidth, 3, "F")
    pdf.setFontSize(11)
    setColor(colors.white, "text")
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING INFORMATION", margin + 6, yPosition + 5.5)
    let infoY = yPosition + 16
    const col1X = margin + 6
    const col2X = margin + cardWidth / 2 + 3
    const addInfoItem = (label: string, value: string, column: 1 | 2) => {
      const x = column === 1 ? col1X : col2X
      pdf.setFontSize(9)
      setColor(colors.navy, "text")
      pdf.setFont("helvetica", "bold")
      pdf.text(label.toUpperCase(), x, infoY)
      pdf.setFontSize(10)
      setColor(colors.darkGray, "text")
      pdf.setFont("helvetica", "normal")
      const lines = pdf.splitTextToSize(value, cardWidth / 2 - 12)
      pdf.text(lines[0], x, infoY + 4)
      return lines.length > 1
    }
    addInfoItem("Date", meetingDate, 1)
    if (meeting.start_time) addInfoItem("Time", meeting.start_time, 2)
    infoY += 10
    if (meeting.location) addInfoItem("Location", meeting.location, 1)
    if (building?.address) addInfoItem("Address", building.address, 2)
    infoY += 10
    if (meeting.strata_plan_number) addInfoItem("Strata Plan", meeting.strata_plan_number, 1)
    yPosition += 56

    // ==================== AGENDA ITEMS ====================
    checkPageBreak(25)
    setColor(colors.navy, "fill")
    pdf.rect(margin - 5, yPosition - 3, pageWidth - 2 * margin + 10, 14, "F")
    pdf.setFontSize(20)
    setColor(colors.white, "text")
    pdf.setFont("helvetica", "bold")
    pdf.text("AGENDA ITEMS", margin, yPosition + 6)
    yPosition += 18

    const topicsBySection = topics.reduce(
      (acc, topic) => {
        const sectionId = topic.section_id ?? "unsectioned"
        if (!acc[sectionId]) acc[sectionId] = []
        acc[sectionId].push(topic)
        return acc
      },
      {} as Record<string | number, Topic[]>
    )

    let sectionNum = 1
    sections.forEach((section) => {
      const sectionTopics = topicsBySection[section.id] || []
      const sortedTopics = [...sectionTopics].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      checkPageBreak(20)
      const sectionHeaderHeight = 10
      setColor(colors.lightBlue, "fill")
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, sectionHeaderHeight, 3, 3, "F")
      setColor(colors.navy, "fill")
      pdf.circle(margin + 5, yPosition + 5, 4, "F")
      pdf.setFontSize(10)
      setColor(colors.white, "text")
      pdf.setFont("helvetica", "bold")
      pdf.text(sectionNum.toString(), margin + 5, yPosition + 6.5, { align: "center" })
      pdf.setFontSize(13)
      setColor(colors.white, "text")
      pdf.text(section.title.toUpperCase(), margin + 12, yPosition + 6.5)
      yPosition += sectionHeaderHeight + 5

      if (sortedTopics.length > 0) {
        sortedTopics.forEach((topic: Topic, idx: number) => {
          const isIncamera = topic.is_incamera === true
          const hasDesc = !isIncamera && topic.description
          const cardHeight = hasDesc ? 22 : 13
          checkPageBreak(cardHeight + 4)
          setColor([210, 210, 210], "fill")
          pdf.roundedRect(margin + 9, yPosition + 0.8, pageWidth - 2 * margin - 18, cardHeight, 3, 3, "F")
          setColor(isIncamera ? [255, 240, 240] : colors.white, "fill")
          pdf.roundedRect(margin + 8, yPosition, pageWidth - 2 * margin - 16, cardHeight, 3, 3, "F")
          setColor(isIncamera ? colors.red : colors.blue, "fill")
          pdf.rect(margin + 8, yPosition, 4, cardHeight, "F")
          setColor(isIncamera ? colors.red : colors.navy, "fill")
          pdf.circle(margin + 18, yPosition + 5, 3, "F")
          pdf.setFontSize(8)
          setColor(colors.white, "text")
          pdf.setFont("helvetica", "bold")
          pdf.text(`${sectionNum}.${idx + 1}`, margin + 18, yPosition + 6.2, { align: "center" })
          pdf.setFontSize(11)
          setColor(colors.darkGray, "text")
          pdf.setFont("helvetica", "bold")
          let title = topic.title
          if (isIncamera) title += " [CONFIDENTIAL]"
          const titleLines = pdf.splitTextToSize(title, pageWidth - 2 * margin - 35)
          pdf.text(titleLines[0], margin + 24, yPosition + 6)
          if (isIncamera) {
            pdf.setFontSize(9)
            pdf.setFont("helvetica", "italic")
            setColor(colors.red, "text")
            pdf.text("CONFIDENTIAL - In-Camera Session", margin + 24, yPosition + 11)
          } else if (hasDesc) {
            pdf.setFontSize(9)
            pdf.setFont("helvetica", "normal")
            setColor(colors.mediumGray, "text")
            const descLines = pdf.splitTextToSize(topic.description!, pageWidth - 2 * margin - 30)
            let descY = yPosition + 11
            descLines.slice(0, 3).forEach((line: string) => {
              pdf.text(line, margin + 24, descY)
              descY += 3.5
            })
            if (descLines.length > 3) {
              pdf.setFont("helvetica", "italic")
              pdf.text("(continued...)", margin + 24, descY)
            }
          }
          yPosition += cardHeight + 4
        })
      } else {
        setColor(colors.lightGray, "fill")
        pdf.roundedRect(margin + 8, yPosition, pageWidth - 2 * margin - 16, 10, 2, 2, "F")
        pdf.setFontSize(9)
        setColor(colors.mediumGray, "text")
        pdf.setFont("helvetica", "italic")
        pdf.text("No items scheduled for this section", margin + 12, yPosition + 6)
        yPosition += 13
      }
      sectionNum++
      yPosition += 2
    })

    const unsectionedTopics = topicsBySection["unsectioned"] || []
    if (unsectionedTopics.length > 0) {
      const sortedUnsectioned = [...unsectionedTopics].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      checkPageBreak(20)
      setColor(colors.lightBlue, "fill")
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 3, 3, "F")
      setColor(colors.navy, "fill")
      pdf.circle(margin + 5, yPosition + 5, 4, "F")
      pdf.setFontSize(10)
      setColor(colors.white, "text")
      pdf.setFont("helvetica", "bold")
      pdf.text(sectionNum.toString(), margin + 5, yPosition + 6.5, { align: "center" })
      pdf.setFontSize(13)
      pdf.text("OTHER BUSINESS", margin + 12, yPosition + 6.5)
      yPosition += 15
      sortedUnsectioned.forEach((topic: Topic, idx: number) => {
        const isIncamera = topic.is_incamera === true
        const hasDesc = !isIncamera && topic.description
        const cardHeight = hasDesc ? 22 : 13
        checkPageBreak(cardHeight + 4)
        setColor([210, 210, 210], "fill")
        pdf.roundedRect(margin + 9, yPosition + 0.8, pageWidth - 2 * margin - 18, cardHeight, 3, 3, "F")
        setColor(isIncamera ? [255, 240, 240] : colors.white, "fill")
        pdf.roundedRect(margin + 8, yPosition, pageWidth - 2 * margin - 16, cardHeight, 3, 3, "F")
        setColor(isIncamera ? colors.red : colors.blue, "fill")
        pdf.rect(margin + 8, yPosition, 4, cardHeight, "F")
        setColor(isIncamera ? colors.red : colors.navy, "fill")
        pdf.circle(margin + 18, yPosition + 5, 3, "F")
        pdf.setFontSize(8)
        setColor(colors.white, "text")
        pdf.setFont("helvetica", "bold")
        pdf.text(`${sectionNum}.${idx + 1}`, margin + 18, yPosition + 6.2, { align: "center" })
        pdf.setFontSize(11)
        setColor(colors.darkGray, "text")
        pdf.setFont("helvetica", "bold")
        let title = topic.title
        if (isIncamera) title += " [CONFIDENTIAL]"
        const titleLines = pdf.splitTextToSize(title, pageWidth - 2 * margin - 35)
        pdf.text(titleLines[0], margin + 24, yPosition + 6)
        if (isIncamera) {
          pdf.setFontSize(9)
          pdf.setFont("helvetica", "italic")
          setColor(colors.red, "text")
          pdf.text("CONFIDENTIAL - In-Camera Session", margin + 24, yPosition + 11)
        } else if (hasDesc) {
          pdf.setFontSize(9)
          pdf.setFont("helvetica", "normal")
          setColor(colors.mediumGray, "text")
          const descLines = pdf.splitTextToSize(topic.description!, pageWidth - 2 * margin - 30)
          let descY = yPosition + 11
          descLines.slice(0, 3).forEach((line: string) => {
            pdf.text(line, margin + 24, descY)
            descY += 3.5
          })
          if (descLines.length > 3) {
            pdf.setFont("helvetica", "italic")
            pdf.text("(continued...)", margin + 24, descY)
          }
        }
        yPosition += cardHeight + 4
      })
    }

    const totalPages = (pdf as any).internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      currentPage = i
      addPageFooter()
    }

    const dateStr = meeting.meeting_date ? new Date(meeting.meeting_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    const fileName = `${meeting.title || "Meeting"}_Agenda_${dateStr}.pdf`
    pdf.save(fileName)
  }

  return (
    <Button
      onClick={handleGenerateAgenda}
      disabled={generating}
      variant="outline"
      className="gap-2 h-8 px-3 text-xs"
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
