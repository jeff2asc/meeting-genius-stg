"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  supabase, 
  getPreviousMeetingOfSameType,
  getSectionsFromMeeting,
  getTopicsFromMeeting,
  getOpenTasksFromMeeting
} from "@/lib/supabase"


interface CreateMeetingModalProps {
  onClose: () => void
  onSuccess: () => void
  buildings: Array<{ id: number; name: string; company_id: number }>
  selectedBuildingName?: string
}

// Type for sections
type Section = {
  id: number
  meeting_id: number
  title: string
  order_index: number
  created_at?: string
  updated_at?: string
}

// Type for topics
type Topic = {
  id: number
  meeting_id: number
  section_id: number | null
  title: string
  description: string | null
  order_index: number
  rolled_over_from_topic_id: number | null
  created_at?: string
  updated_at?: string
}


export default function CreateMeetingModal({ onClose, onSuccess, buildings }: CreateMeetingModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    meetingDate: "",
    location: "",
    startTime: "",
    meetingType: "",
    strataPlanNumber: "",
    buildingId: buildings[0]?.id || 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [meetingTypes, setMeetingTypes] = useState<string[]>([])
  const [meetingSections, setMeetingSections] = useState<string[]>([])


  useEffect(() => {
    // Fetch company defaults when modal opens or building changes
    async function fetchCompanyDefaults() {
      const selectedBuilding = buildings.find(b => b.id === formData.buildingId)
      if (!selectedBuilding || !selectedBuilding.company_id) {
        setMeetingTypes([
          "Council Meeting",
          "AGM",
          "SGM",
          "Special Meeting",
          "Emergency Meeting"
        ])
        setMeetingSections([
          "Call to Order",
          "Approval of Agenda",
          "Old Business / Business Arising",
          "New Business",
          "Financial Report",
          "Maintenance & Operations",
          "Correspondence",
          "Council Roundtable",
          "Adjournment"
        ])
        setFormData(f => ({ ...f, meetingType: "Council Meeting" }))
        return
      }

      const { data: company, error } = await supabase
        .from("companies")
        .select("default_meeting_sections, default_meeting_types")
        .eq("id", selectedBuilding.company_id)
        .single()

      setMeetingTypes(
        company?.default_meeting_types || [
          "Council Meeting",
          "AGM",
          "SGM",
          "Special Meeting",
          "Emergency Meeting"
        ]
      )
      setMeetingSections(
        company?.default_meeting_sections || [
          "Call to Order",
          "Approval of Agenda",
          "Old Business / Business Arising",
          "New Business",
          "Financial Report",
          "Maintenance & Operations",
          "Correspondence",
          "Council Roundtable",
          "Adjournment"
        ]
      )
      setFormData(f => ({ ...f, meetingType: company?.default_meeting_types?.[0] || "Council Meeting" }))
    }

    fetchCompanyDefaults()
    // eslint-disable-next-line
  }, [formData.buildingId, buildings])


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === "buildingId" ? parseInt(value) : value,
    }))
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // ============================================
      // STEP 1: Create the meeting record
      // ============================================
      const { data: meetingData, error: insertError } = await supabase
        .from("meetings")
        .insert([
          {
            building_id: formData.buildingId,
            title: formData.title,
            meeting_date: formData.meetingDate,
            location: formData.location || null,
            start_time: formData.startTime || null,
            meeting_type: formData.meetingType,
            strata_plan_number: formData.strataPlanNumber || null,
            status: "working_agenda",
          },
        ])
        .select()
        .single()

      if (insertError || !meetingData) {
        console.error("Error creating meeting:", insertError)
        setError(insertError?.message || "Failed to create meeting")
        setLoading(false)
        return
      }

      // ============================================
      // STEP 2: Check for previous meeting (ROLLOVER LOGIC)
      // ============================================
      const previousMeeting = await getPreviousMeetingOfSameType(
        formData.buildingId,
        formData.meetingType
      )

      if (previousMeeting) {
        // ============================================
        // PATH A: ROLLOVER from previous meeting
        // ============================================
        console.log('🔄 Rolling over from previous meeting:', previousMeeting.title)

        // Step 2.1: Get sections from previous meeting
        const prevSections = await getSectionsFromMeeting(previousMeeting.id)
        
        // Step 2.2: Copy sections to new meeting
        const newSections: Section[] = []
        
        for (const section of prevSections) {
          const { data: newSection, error: sectionError } = await supabase
            .from('sections')
            .insert({
              meeting_id: meetingData.id,
              title: section.title,
              order_index: section.order_index
            })
            .select()
            .single()

          if (sectionError) {
            console.error('Error inserting section:', sectionError)
          } else if (newSection) {
            newSections.push(newSection as Section)
          }
        }

        // Step 2.3: Create mapping of old section IDs to new section IDs
        const sectionIdMap: Record<number, number> = {}
        prevSections.forEach((oldSection, index) => {
          if (newSections[index]) {
            sectionIdMap[oldSection.id] = newSections[index].id
          }
        })

        // Step 2.4: Get topics from previous meeting
        const prevTopics = await getTopicsFromMeeting(previousMeeting.id)

        // Step 2.5: Copy topics to new meeting
        const topicIdMap: Record<number, number> = {}
        for (const topic of prevTopics) {
          const newSectionId = topic.section_id ? sectionIdMap[topic.section_id] : null

          const { data: newTopic, error: topicError } = await supabase
            .from('topics')
            .insert({
              meeting_id: meetingData.id,
              section_id: newSectionId,
              title: topic.title,
              description: topic.description,
              order_index: topic.order_index,
              rolled_over_from_topic_id: topic.id
            })
            .select()
            .single()

          if (topicError) {
            console.error('Error inserting topic:', topicError)
          } else if (newTopic) {
            topicIdMap[topic.id] = newTopic.id
          }
        }

        // Step 2.6: Get open tasks from previous meeting
        const openTasks = await getOpenTasksFromMeeting(previousMeeting.id)

        // Step 2.7: Copy open tasks to new topics
        let rolledOverTaskCount = 0
        for (const task of openTasks) {
          const newTopicId = topicIdMap[task.topic_id]
          
          if (newTopicId) {
            const { error: taskError } = await supabase
              .from('tasks')
              .insert({
                topic_id: newTopicId,
                description: task.description,
                assigned_name: task.assigned_name,
                assigned_email: task.assigned_email,
                assignees: task.assignees,
                due_date: task.due_date,
                status: task.status // Keep original status (open/in_progress)
              })

            if (taskError) {
              console.error('Error inserting task:', taskError)
            } else {
              rolledOverTaskCount++
            }
          }
        }

        // Step 2.8: Show success message with rollover info
        console.log(`✅ Meeting created with ${rolledOverTaskCount} tasks rolled over from "${previousMeeting.title}"`)
        
      } else {
        // ============================================
        // PATH B: Use TEMPLATE (first time this meeting type)
        // ============================================
        console.log('📋 Using company template (no previous meeting found)')

        // Compose sections from defaults array
        const standardSections = (meetingSections.length > 0 ? meetingSections : [
          "Call to Order",
          "Approval of Agenda",
          "Old Business / Business Arising",
          "New Business",
          "Financial Report",
          "Maintenance & Operations",
          "Correspondence",
          "Council Roundtable",
          "Adjournment"
        ]).map((title, idx) => ({
          title,
          order_index: idx + 1,
        }))

        // Insert sections
        const { data: insertedSections, error: sectionsError } = await supabase
          .from("sections")
          .insert(
            standardSections.map(section => ({
              meeting_id: meetingData.id,
              title: section.title,
              order_index: section.order_index,
            }))
          )
          .select()

        if (sectionsError) {
          console.error("Error inserting sections:", sectionsError)
        } else {
          // Insert preset topics for Call to Order, Approval of Agenda, Adjournment
          const presetTopics = [
            { section_title: "Call to Order", title: "Meeting called to order at [time]" },
            { section_title: "Approval of Agenda", title: "Approval of the agenda" },
            { section_title: "Adjournment", title: "Meeting adjourned at [time]" },
          ]

          // Map section title to section id
          const sectionIdMap: Record<string, number> = {}
          insertedSections?.forEach(section => {
            if (section.title && section.id) {
              sectionIdMap[section.title] = section.id
            }
          })

          // Insert preset topics
          const topicsToInsert = presetTopics.map(topic => ({
            meeting_id: meetingData.id,
            section_id: sectionIdMap[topic.section_title] || null,
            title: topic.title,
            order_index: 1,
          }))

          const { error: topicsError } = await supabase.from("topics").insert(topicsToInsert)
          if (topicsError) {
            console.error("Error inserting preset topics:", topicsError)
          }
        }
      }

      // ============================================
      // STEP 3: Success - close modal and refresh
      // ============================================
      onSuccess()
      onClose()
      
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-md border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-foreground">Create New Meeting</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Building Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Building *
            </label>
            {buildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading buildings...</p>
            ) : (
              <select
                name="buildingId"
                value={formData.buildingId}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Meeting Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., October 2024 Board Meeting"
              required
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Meeting Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Type *
            </label>
            <select
              name="meetingType"
              value={formData.meetingType}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {meetingTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Meeting Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Meeting Date *
            </label>
            <input
              type="date"
              name="meetingDate"
              value={formData.meetingDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Start Time (Optional)
            </label>
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">e.g., 7:00 PM</p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Location (Optional)
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Conference Room A or Zoom Meetings"
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Strata Plan Number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Strata Plan Number (Optional)
            </label>
            <input
              type="text"
              name="strataPlanNumber"
              value={formData.strataPlanNumber}
              onChange={handleInputChange}
              placeholder="e.g., LMS1234"
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">Reference number for the building/strata</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-transparent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
            >
              {loading ? "Creating..." : "Create Meeting"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
