"use client"

import { useEffect, useState, use } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Loader2, AlertCircle, Calendar, MapPin, Clock } from "lucide-react"
import ExternalAccessLogin from "@/components/ExternalAccessLogin"
import TopicCard from "@/components/topic-card"
import { formatUtcToLocalLong, formatUtcToLocalShort } from "@/lib/timezone"

interface PageProps {
  params: Promise<{ token: string }>
}

export default function ExternalMeetingPage({ params }: PageProps) {
  const { token } = use(params)
  
  const [loading, setLoading] = useState(true)
  const [meeting, setMeeting] = useState<any>(null)
  const [attendees, setAttendees] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [authenticatedAttendee, setAuthenticatedAttendee] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      fetchMeetingData()
    }
  }, [token])

  const fetchMeetingData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch meeting
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select(`
          *,
          buildings(*)
        `)
        .eq("external_update_token", token)
        .single()

      if (meetingError || !meetingData) {
        setError("This meeting link is invalid or has expired.")
        setLoading(false)
        return
      }

      setMeeting(meetingData)
      setAttendees(meetingData.attendees || [])

      // 2. Fetch sections and topics
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select(`
          *,
          topics(*)
        `)
        .eq("meeting_id", meetingData.id)
        .order("order_index")

      if (sectionsError) {
        console.error("Error fetching sections:", sectionsError)
      } else {
        setSections(sectionsData || [])
      }

    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred while loading the meeting.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading meeting data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full p-8 text-center shadow-xl">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a href="/" className="text-primary hover:underline font-medium">Return to Homepage</a>
        </Card>
      </div>
    )
  }

  // Not authenticated yet - show login
  if (!authenticatedAttendee) {
    return (
      <ExternalAccessLogin 
        attendees={attendees} 
        onSuccess={(attendee) => setAuthenticatedAttendee(attendee)} 
      />
    )
  }

  // Authenticated - show meeting view
  return (
    <div className="min-h-screen bg-muted/10">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {meeting.buildings?.name}
                </span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-xs font-medium text-primary">
                  {meeting.meeting_type}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-decision-purple bg-clip-text text-transparent">
                {meeting.title}
              </h1>
            </div>
            
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatUtcToLocalLong(meeting.meeting_date)}</span>
              </div>
              {meeting.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{meeting.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome Message */}
        <div className="mb-8 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {authenticatedAttendee.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm">Logged in as <strong>{authenticatedAttendee.name}</strong></p>
            <p className="text-xs text-muted-foreground">You have guest access to this meeting agenda.</p>
          </div>
        </div>

        {/* Sections & Topics */}
        <div className="space-y-12">
          {sections.length > 0 ? (
            sections.map((section, sIdx) => (
              <div key={section.id} className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-foreground">
                    {sIdx + 1}. {section.title}
                  </span>
                  <div className="h-[1px] flex-1 bg-border" />
                </div>

                <div className="grid gap-6">
                  {section.topics && section.topics.length > 0 ? (
                    section.topics
                      .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                      .map((topic: any, tIdx: number) => (
                        <TopicCard 
                          key={topic.id} 
                          topic={topic} 
                          topicNumber={tIdx + 1}
                          meetingId={meeting.id}
                          meetingStatus={meeting.status}
                          isReadOnly={true}
                          onUpdate={() => {}}
                          onDelete={() => {}}
                          onTaskClick={() => {}}
                          onNoteClick={() => {}}
                          onDecisionClick={() => {}}
                        />
                      ))
                  ) : (
                    <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                      No topics in this section
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No sections found for this meeting.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-10 border-t bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <img src="/MG2 logo.png" alt="Meeting Genius" className="h-8 w-auto mx-auto mb-4 opacity-50 gray-scale" />
          <p className="text-xs text-muted-foreground">
            &copy; 2026 Meeting Genius. Secure External Access Portal.
          </p>
        </div>
      </footer>
    </div>
  )
}
