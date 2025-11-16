"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight, Calendar,
  Clock, MapPin, FileText, Edit2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TopicCard from "./topic-card"
import Timer from "./timer"
import CreateSectionModal from "./create-section-modal"
import CreateTopicModal from "./create-topic-modal"
import EditMeetingModal from "./EditMeetingModal"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { canEditMeeting, isReadOnly } from "@/lib/permissions"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface MeetingViewProps {
  meetingId: string
  onBack: () => void
  onTaskClick: (topicId: number) => void
  onNoteClick: (topicId: number) => void
  onDecisionClick: (topicId: number) => void
}

interface Topic {
  id: number
  title: string
  description: string | null
  section_id: number | null
  attachments: number
  tasks: number
  decisions: number
  order_index?: number
}

interface Section {
  id: number
  title: string
  order_index: number
  topics: Topic[]
  isExpanded: boolean
}

export default function MeetingView({
  meetingId,
  onBack,
  onTaskClick,
  onNoteClick,
  onDecisionClick
}: MeetingViewProps) {
  const [meeting, setMeeting] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false)
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false)
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<{ id: number; title: string } | null>(null)

  const currentUser = getCurrentUser()
  const userCanEdit = currentUser ? canEditMeeting(currentUser.user_type) : false
  const userIsReadOnly = currentUser ? isReadOnly(currentUser.user_type) : false

  useEffect(() => {
    setIsMounted(true)
  }, [])
  useEffect(() => {
    if (meetingId) fetchMeetingData()
  }, [meetingId])

  const fetchMeetingData = async () => {
    try {
      setLoading(true)
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*, buildings(name)")
        .eq("id", meetingId)
        .single()
      if (meetingError) {
        console.error("Error fetching meeting:", meetingError)
        return
      }
      setMeeting({
        title: meetingData.title,
        building: meetingData.buildings?.name || "Unknown",
        meeting_date: meetingData.meeting_date,
        location: meetingData.location,
        start_time: meetingData.start_time,
        meeting_type: meetingData.meeting_type,
        strata_plan_number: meetingData.strata_plan_number,
        status: meetingData.status
      })
      await fetchSectionsAndTopics()
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSectionsAndTopics = async () => {
    try {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")
      if (sectionsError) {
        console.error("Error fetching sections:", sectionsError)
        return
      }
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select(`
          *,
          notes(count),
          tasks(count),
          decisions(count)
        `)
        .eq("meeting_id", meetingId)
        .order("order_index")
      if (topicsError) {
        console.error("Error fetching topics:", topicsError)
        return
      }
      const sectionsWithTopics: Section[] = (sectionsData || []).map((section) => ({
        id: section.id,
        title: section.title,
        order_index: section.order_index,
        isExpanded: false, // collapsed by default
        topics: (topicsData || []).filter(
          (topic) => topic.section_id === section.id
        ).map((topic) => ({
          id: topic.id,
          title: topic.title,
          description: topic.description,
          section_id: topic.section_id,
          attachments: 0,
          tasks: topic.tasks?.[0]?.count || 0,
          decisions: topic.decisions?.[0]?.count || 0,
          order_index: topic.order_index,
        }))
      }))
      setSections(sectionsWithTopics)
    } catch (err) {
      console.error("Unexpected error fetching sections/topics:", err)
    }
  }

  const handleAddTopic = (sectionId: number, sectionTitle: string) => {
    if (!userCanEdit) {
      alert("You do not have permission to add topics.")
      return
    }
    setSelectedSection({ id: sectionId, title: sectionTitle })
    setShowCreateTopicModal(true)
  }

  const updateTopic = async (id: number, updates: Partial<Topic>) => {
    if (!userCanEdit) {
      alert("You do not have permission to edit topics.")
      return
    }
    try {
      const { error } = await supabase
        .from("topics")
        .update({
          title: updates.title,
          description: updates.description
        })
        .eq("id", id)
      if (error) {
        console.error("Error updating topic:", error)
        return
      }
      await fetchSectionsAndTopics()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const deleteTopic = async (id: number) => {
    if (!userCanEdit) {
      alert("You do not have permission to delete topics.")
      return
    }
    try {
      const { error } = await supabase
        .from("topics")
        .delete()
        .eq("id", id)
      if (error) {
        console.error("Error deleting topic:", error)
        return
      }
      await fetchSectionsAndTopics()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const toggleSection = (sectionId: number) => {
    setSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              isExpanded: !s.isExpanded
            }
          : s
      )
    )
  }

  const onDragEnd = async (result: any) => {
    if (!result.destination) return

    const { source, destination, type } = result

    if (type === "SECTION") {
      const newSections = Array.from(sections)
      const [removed] = newSections.splice(source.index, 1)
      newSections.splice(destination.index, 0, removed)
      newSections.forEach((s, idx) => {
        s.order_index = idx + 1
      })
      setSections(newSections)
      try {
        await Promise.all(
          newSections.map((section) =>
            supabase.from("sections")
              .update({ order_index: section.order_index })
              .eq("id", section.id)
          )
        )
      } catch (err) {
        console.error("Failed to update sections order:", err)
      }
    } else if (type === "TOPIC") {
      const fromIdx = sections.findIndex((s) => s.id === Number(source.droppableId))
      const toIdx = sections.findIndex((s) => s.id === Number(destination.droppableId))
      if (fromIdx === -1 || toIdx === -1) return
      const fromSection = sections[fromIdx]
      const toSection = sections[toIdx]
      const sourceTopics = Array.from(fromSection.topics)
      const destTopics = Array.from(toSection.topics)
      const [removed] = sourceTopics.splice(source.index, 1)
      if (fromIdx === toIdx) {
        sourceTopics.splice(destination.index, 0, removed)
        const newSections = [...sections]
        newSections[fromIdx].topics = sourceTopics
        newSections[fromIdx].topics.forEach((t, idx) => t.order_index = idx + 1)
        setSections(newSections)
        try {
          await Promise.all(
            newSections[fromIdx].topics.map((topic) =>
              supabase.from("topics").update({ order_index: topic.order_index }).eq("id", topic.id)
            )
          )
        } catch (err) { }
      } else {
        destTopics.splice(destination.index, 0, removed)
        const newSections = [...sections]
        newSections[fromIdx].topics = sourceTopics
        newSections[toIdx].topics = destTopics
        removed.section_id = newSections[toIdx].id
        newSections[fromIdx].topics.forEach((t, idx) => t.order_index = idx + 1)
        newSections[toIdx].topics.forEach((t, idx) => t.order_index = idx + 1)
        setSections(newSections)
        try {
          await Promise.all([
            ...newSections[fromIdx].topics.map((topic) =>
              supabase.from("topics").update({ order_index: topic.order_index }).eq("id", topic.id)
            ),
            ...newSections[toIdx].topics.map((topic) =>
              supabase.from("topics").update({
                order_index: topic.order_index,
                section_id: newSections[toIdx].id,
              }).eq("id", topic.id)
            )
          ])
        } catch (err) { }
      }
    }
  }

  // HEADER CONTENT ADDED HERE!
  return (
    <>
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">Meeting Genius</h1>
              {meeting && (
                <span className="ml-5 bg-muted px-3 py-1 rounded text-sm">{meeting.building}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Add your global navigation, user, org switch, admin, logout(s) here if needed */}
            </div>
          </div>
        </div>
      </header>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-sections" type="SECTION">
          {(provided: any) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6"
            >
              {sections.map((section, index) => (
                <Draggable key={section.id} draggableId={section.id.toString()} index={index}>
                  {(provided: any) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <Card className="border-0 bg-gradient-to-r from-primary/10 to-decision-purple/10 mb-3">
                        <button
                          {...provided.dragHandleProps}
                          onClick={() => toggleSection(section.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {section.isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-primary" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-primary" />
                            )}
                            <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                            <span className="text-sm text-muted-foreground">
                              ({section.topics.length} {section.topics.length === 1 ? 'topic' : 'topics'})
                            </span>
                          </div>
                          {userCanEdit && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddTopic(section.id, section.title)
                              }}
                              className="bg-primary hover:bg-primary/90"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Topic
                            </Button>
                          )}
                        </button>
                        {section.isExpanded && (
                          <Droppable droppableId={section.id.toString()} type="TOPIC">
                            {(provided: any) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-4 ml-8"
                              >
                                {section.topics.length > 0 ? (
                                  section.topics.map((topic, idx) => (
                                    <Draggable
                                      key={topic.id}
                                      draggableId={`topic-${topic.id}`}
                                      index={idx}
                                    >
                                      {(provided: any) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                        >
                                          <TopicCard
                                            topic={topic}
                                            topicNumber={idx + 1}
                                            onUpdate={updates => updateTopic(topic.id, updates)}
                                            onDelete={id => deleteTopic(id)}
                                            onTaskClick={() => onTaskClick(topic.id)}
                                            onNoteClick={() => onNoteClick(topic.id)}
                                            onDecisionClick={() => onDecisionClick(topic.id)}
                                            isReadOnly={userIsReadOnly}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  ))
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                                    {userCanEdit
                                      ? 'No topics in this section yet. Click "Add Topic" to create one.'
                                      : 'No topics in this section yet.'}
                                  </div>
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </>
  )
}
