"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase, isLoggedIn, getCurrentUser } from "@/lib/supabase"
import ExternalAccessLogin from "@/components/ExternalAccessLogin"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    CheckCircle,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Plus,
    Pencil,
    X,
    Save,
    FileText,
    CheckSquare,
    Gavel,
    StickyNote,
    Lock,
    Loader2,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
    id: number
    title: string
    meeting_date: string
    meeting_type: string | null
    status: string
    location: string | null
    buildings: { name: string } | null
    attendees: any[]
}

interface Section {
    id: number
    title: string
    order_index: number
    topics: Topic[]
}

interface Topic {
    id: number
    title: string
    description: string | null
    section_id: number | null
    order_index: number
    created_by_name: string | null
    updated_by_name: string | null
}

interface Note {
    id: number
    content: string
    created_at: string
    visibility: string
}

interface Task {
    id: number
    description: string
    status: string
    assigned_name: string | null
    due_date: string | null
}

interface Decision {
    id: number
    motion_text: string
    result: string | null
    votes_for: number | null
    votes_against: number | null
    votes_abstain: number | null
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MeetingExternalPage() {
    const params = useParams()
    const token = params.token as string

    const [loading, setLoading] = useState(false)
    const [meeting, setMeeting] = useState<Meeting | null>(null)
    const [sections, setSections] = useState<Section[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [meetingLoading, setMeetingLoading] = useState(true)
    const [isAttendeeMode, setIsAttendeeMode] = useState(false)
    const [attendeeEmail, setAttendeeEmail] = useState<string | null>(null)
    const [attendeeName, setAttendeeName] = useState<string | null>(null)

    // Expanded sections
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
    const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set())

    // Topic data cache
    const [topicNotes, setTopicNotes] = useState<Record<number, Note[]>>({})
    const [topicTasks, setTopicTasks] = useState<Record<number, Task[]>>({})
    const [topicDecisions, setTopicDecisions] = useState<Record<number, Decision[]>>({})

    // Add topic form
    const [showAddTopic, setShowAddTopic] = useState<number | null>(null) // sectionId
    const [newTopicTitle, setNewTopicTitle] = useState("")
    const [newTopicDesc, setNewTopicDesc] = useState("")
    const [savingTopic, setSavingTopic] = useState(false)

    // Edit topic inline
    const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
    const [editTopicTitle, setEditTopicTitle] = useState("")
    const [editTopicDesc, setEditTopicDesc] = useState("")
    const [savingEdit, setSavingEdit] = useState(false)

    // ─── Fetch meeting by token ──────────────────────────────────────────────────

    useEffect(() => {
        // Initial setup
        const checkAuthAndFetchMeeting = async () => {
            const loggedIn = isLoggedIn()
            let alreadyAuth = false
            let storedEmail = sessionStorage.getItem(`external_attendee_email_${token}`)
            let storedName = sessionStorage.getItem(`external_attendee_name_${token}`)

            if (loggedIn) {
                const user = getCurrentUser()
                setCurrentUser(user)
                setIsAuthenticated(true)
                alreadyAuth = true
            } else if (storedEmail && storedName) {
                setAttendeeEmail(storedEmail)
                setAttendeeName(storedName)
                setIsAttendeeMode(true)
                setIsAuthenticated(true)
                alreadyAuth = true
            }

            // Always fetch meeting data first to check attendees even if not "authenticated" yet
            await fetchMeetingMetadata(alreadyAuth)
        }

        if (token) checkAuthAndFetchMeeting()
    }, [token])

    const fetchMeetingMetadata = async (alreadyAuth: boolean) => {
        setMeetingLoading(true)
        try {
            const { data, error: err } = await supabase
                .from("meetings")
                .select(`
                    id,
                    title,
                    meeting_date,
                    meeting_type,
                    status,
                    location,
                    external_update_token,
                    attendees,
                    buildings(name)
                `)
                .eq("external_update_token", token)
                .single()

            if (err || !data) {
                setError("Meeting not found or this link is invalid.")
                setMeetingLoading(false)
                return
            }

            if (data.status === "minutes") {
                setError("This meeting has been finalized. The link is no longer active.")
                setMeetingLoading(false)
                return
            }

            setMeeting(data as any)

            if (alreadyAuth) {
                fetchMeetingSections(data.id)
            }
        } catch {
            setError("Failed to load meeting metadata.")
        } finally {
            setMeetingLoading(false)
        }
    }

    const handleAttendeeLogin = (attendee: any) => {
        setAttendeeEmail(attendee.email)
        setAttendeeName(attendee.name)
        setIsAttendeeMode(true)
        setIsAuthenticated(true)

        // Store in session storage for this session
        sessionStorage.setItem(`external_attendee_email_${token}`, attendee.email)
        sessionStorage.setItem(`external_attendee_name_${token}`, attendee.name)

        if (meeting) {
            fetchMeetingSections(meeting.id)
        }
    }

    const fetchMeetingSections = async (meetingId: number) => {
        setLoading(true)
        try {
            await fetchSections(meetingId)
        } catch {
            setError("Failed to load meeting content.")
        } finally {
            setLoading(false)
        }
    }

    const fetchSections = async (meetingId: number) => {
        const { data: sectionsData } = await supabase
            .from("sections")
            .select("*")
            .eq("meeting_id", meetingId)
            .order("order_index")

        const { data: topicsData } = await supabase
            .from("topics")
            .select("id, title, description, section_id, order_index, created_by_name, updated_by_name")
            .eq("meeting_id", meetingId)
            .order("order_index")

        if (!sectionsData) return

        const built: Section[] = sectionsData.map((s) => ({
            id: s.id,
            title: s.title,
            order_index: s.order_index,
            topics: (topicsData || [])
                .filter((t) => t.section_id === s.id)
                .map((t) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    section_id: t.section_id,
                    order_index: t.order_index,
                    created_by_name: t.created_by_name,
                    updated_by_name: t.updated_by_name,
                })),
        }))

        setSections(built)
        // Expand all sections by default
        setExpandedSections(new Set(built.map((s) => s.id)))
    }

    // ─── Fetch topic detail (lazy) ───────────────────────────────────────────────

    const fetchTopicDetail = async (topicId: number) => {
        const [notesRes, tasksRes, decisionsRes] = await Promise.all([
            supabase
                .from("notes")
                .select("id, content, created_at, visibility")
                .eq("topic_id", topicId)
                .eq("visibility", "public")
                .order("created_at", { ascending: false }),
            supabase
                .from("tasks")
                .select("id, description, status, assigned_name, due_date")
                .eq("topic_id", topicId)
                .order("created_at", { ascending: false }),
            supabase
                .from("decisions")
                .select("id, motion_text, result, votes_for, votes_against, votes_abstain")
                .eq("topic_id", topicId)
                .order("recorded_at", { ascending: true }),
        ])

        setTopicNotes((prev) => ({ ...prev, [topicId]: notesRes.data || [] }))
        setTopicTasks((prev) => ({ ...prev, [topicId]: tasksRes.data || [] }))
        setTopicDecisions((prev) => ({ ...prev, [topicId]: decisionsRes.data || [] }))
    }

    const toggleTopicExpand = async (topicId: number) => {
        setExpandedTopics((prev) => {
            const next = new Set(prev)
            if (next.has(topicId)) {
                next.delete(topicId)
            } else {
                next.add(topicId)
                // Lazy-load details
                fetchTopicDetail(topicId)
            }
            return next
        })
    }

    // ─── Add Topic ───────────────────────────────────────────────────────────────

    const handleAddTopic = async (sectionId: number) => {
        if (!newTopicTitle.trim() || !meeting) return
        setSavingTopic(true)

        // Find next order_index
        const sec = sections.find((s) => s.id === sectionId)
        const nextOrder = sec ? (sec.topics.length > 0 ? Math.max(...sec.topics.map((t) => t.order_index)) + 1 : 0) : 0

        const { data, error: insertErr } = await supabase
            .from("topics")
            .insert({
                meeting_id: meeting.id,
                section_id: sectionId,
                title: newTopicTitle.trim(),
                description: newTopicDesc.trim() || null,
                order_index: nextOrder,
                created_by_name: attendeeName || currentUser?.name || "Attendee",
            })
            .select()
            .single()

        if (!insertErr && data) {
            setSections((prev) =>
                prev.map((s) =>
                    s.id === sectionId
                        ? {
                            ...s, topics: [...s.topics, {
                                id: data.id,
                                title: data.title,
                                description: data.description,
                                section_id: data.section_id,
                                order_index: data.order_index,
                                created_by_name: data.created_by_name,
                                updated_by_name: data.updated_by_name
                            }]
                        }
                        : s
                )
            )
            setNewTopicTitle("")
            setNewTopicDesc("")
            setShowAddTopic(null)
        }

        setSavingTopic(false)
    }

    // ─── Edit Topic ──────────────────────────────────────────────────────────────

    const startEditTopic = (topic: Topic) => {
        setEditingTopicId(topic.id)
        setEditTopicTitle(topic.title)
        setEditTopicDesc(topic.description || "")
    }

    const saveEditTopic = async (topicId: number, sectionId: number | null) => {
        if (!editTopicTitle.trim()) return
        setSavingEdit(true)

        const { error: updateErr } = await supabase
            .from("topics")
            .update({
                title: editTopicTitle.trim(),
                description: editTopicDesc.trim() || null,
                updated_by_name: attendeeName || currentUser?.name || "Attendee"
            })
            .eq("id", topicId)

        if (!updateErr) {
            setSections((prev) =>
                prev.map((s) =>
                    s.id === sectionId
                        ? {
                            ...s,
                            topics: s.topics.map((t) =>
                                t.id === topicId
                                    ? {
                                        ...t,
                                        title: editTopicTitle.trim(),
                                        description: editTopicDesc.trim() || null,
                                        updated_by_name: attendeeName || currentUser?.name || "Attendee"
                                    }
                                    : t
                            ),
                        }
                        : s
                )
            )
            setEditingTopicId(null)
        }

        setSavingEdit(false)
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    const getTaskStatusStyle = (status: string) => {
        switch (status) {
            case "completed": return "text-green-700 bg-green-100"
            case "in_progress": return "text-yellow-700 bg-yellow-100"
            case "blocked": return "text-red-700 bg-red-100"
            default: return "text-blue-700 bg-blue-100"
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────────

    if (meetingLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Unavailable</h1>
                    <p className="text-gray-600">{error}</p>
                </Card>
            </div>
        )
    }

    if (!isAuthenticated && meeting) {
        return <ExternalAccessLogin attendees={meeting.attendees || []} onSuccess={handleAttendeeLogin} />
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading meeting...</p>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Unavailable</h1>
                    <p className="text-gray-600">{error}</p>
                </Card>
            </div>
        )
    }

    if (!meeting) return null

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
            <div className="max-w-4xl mx-auto py-8">

                {/* Header */}
                <div className="text-center mb-8">
                    <img src="/MG2 logo.png" alt="Meeting Genius" className="h-10 w-auto mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
                    <div className="flex items-center justify-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                        {meeting.buildings?.name && <span>📍 {meeting.buildings.name}</span>}
                        {meeting.meeting_type && <span>📋 {meeting.meeting_type}</span>}
                        <span>📅 {new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                        {meeting.location && <span>🏢 {meeting.location}</span>}
                    </div>

                    {/* Read-only notice */}
                    <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700">
                        <Lock className="h-3.5 w-3.5" />
                        You can view all topics and add or edit topics. Notes, tasks, and decisions are read-only.
                    </div>
                </div>

                {/* Sections */}
                <div className="space-y-4">
                    {sections.length === 0 ? (
                        <Card className="p-8 text-center text-gray-500">No sections found for this meeting.</Card>
                    ) : (
                        sections.map((section, sIdx) => (
                            <Card key={section.id} className="overflow-hidden shadow-sm border border-border">
                                {/* Section Header */}
                                <button
                                    className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-slate-800 hover:to-slate-900 transition-colors"
                                    onClick={() =>
                                        setExpandedSections((prev) => {
                                            const next = new Set(prev)
                                            next.has(section.id) ? next.delete(section.id) : next.add(section.id)
                                            return next
                                        })
                                    }
                                >
                                    <span className="font-semibold text-sm tracking-wide">
                                        {sIdx + 1}. {section.title}
                                    </span>
                                    {expandedSections.has(section.id) ? (
                                        <ChevronDown className="h-4 w-4 opacity-70" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 opacity-70" />
                                    )}
                                </button>

                                {expandedSections.has(section.id) && (
                                    <div className="divide-y divide-border">
                                        {/* Topics */}
                                        {section.topics.map((topic, tIdx) => (
                                            <div key={topic.id} className="bg-white">
                                                {/* Topic Row */}
                                                {editingTopicId === topic.id ? (
                                                    <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
                                                        <input
                                                            className="w-full text-sm font-semibold px-3 py-2 border border-border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            value={editTopicTitle}
                                                            onChange={(e) => setEditTopicTitle(e.target.value)}
                                                            placeholder="Topic title"
                                                        />
                                                        <textarea
                                                            className="w-full text-sm px-3 py-2 border border-border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                            value={editTopicDesc}
                                                            onChange={(e) => setEditTopicDesc(e.target.value)}
                                                            placeholder="Description (optional)"
                                                            rows={3}
                                                        />
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => saveEditTopic(topic.id, topic.section_id)}
                                                                disabled={savingEdit || !editTopicTitle.trim()}
                                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                            >
                                                                <Save className="h-3.5 w-3.5 mr-1" />
                                                                {savingEdit ? "Saving..." : "Save"}
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setEditingTopicId(null)}>
                                                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                                        onClick={() => toggleTopicExpand(topic.id)}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <span className="text-xs font-mono text-slate-400 shrink-0">
                                                                {sIdx + 1}.{tIdx + 1}
                                                            </span>
                                                            <span className="text-sm font-medium text-slate-800 truncate">{topic.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-3 shrink-0">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                                                                onClick={(e) => { e.stopPropagation(); startEditTopic(topic) }}
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            {expandedTopics.has(topic.id) ? (
                                                                <ChevronDown className="h-4 w-4 text-slate-400" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Topic Detail */}
                                                {expandedTopics.has(topic.id) && editingTopicId !== topic.id && (
                                                    <div className="px-5 pb-4 pt-1 space-y-4 bg-slate-50 border-t border-border">
                                                        {/* Description */}
                                                        {topic.description && (
                                                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{topic.description}</p>
                                                        )}

                                                        {/* Audit Info */}
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 font-medium italic border-b border-slate-200 pb-2">
                                                            {topic.created_by_name && (
                                                                <span>👤 Added by: {topic.created_by_name}</span>
                                                            )}
                                                            {topic.updated_by_name && (
                                                                <span>✏️ Last edited by: {topic.updated_by_name}</span>
                                                            )}
                                                        </div>

                                                        {/* Notes */}
                                                        {(topicNotes[topic.id] ?? []).length > 0 && (
                                                            <div>
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                                    <StickyNote className="h-3.5 w-3.5" /> Notes
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {topicNotes[topic.id].map((note) => (
                                                                        <div key={note.id} className="text-sm text-slate-700 bg-white border border-border rounded-lg px-3 py-2 whitespace-pre-wrap">
                                                                            {note.content}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Tasks */}
                                                        {(topicTasks[topic.id] ?? []).length > 0 && (
                                                            <div>
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                                    <CheckSquare className="h-3.5 w-3.5" /> Tasks
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {topicTasks[topic.id].map((task) => (
                                                                        <div key={task.id} className="flex items-start gap-3 text-sm bg-white border border-border rounded-lg px-3 py-2">
                                                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${getTaskStatusStyle(task.status)}`}>
                                                                                {task.status.replace("_", " ")}
                                                                            </span>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-slate-700">{task.description}</p>
                                                                                {(task.assigned_name || task.due_date) && (
                                                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                                                        {task.assigned_name && <>Assigned to: {task.assigned_name}</>}
                                                                                        {task.assigned_name && task.due_date && " · "}
                                                                                        {task.due_date && <>Due: {new Date(task.due_date).toLocaleDateString()}</>}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Decisions / Motions */}
                                                        {(topicDecisions[topic.id] ?? []).length > 0 && (
                                                            <div>
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                                    <Gavel className="h-3.5 w-3.5" /> Decisions & Motions
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {topicDecisions[topic.id].map((d, dIdx) => (
                                                                        <div key={d.id} className="bg-white border border-border rounded-lg px-3 py-2">
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <p className="text-sm text-slate-700 flex-1">
                                                                                    <span className="font-semibold text-slate-500 mr-2">
                                                                                        MOTION {sIdx + 1}.{tIdx + 1}
                                                                                    </span>
                                                                                    {d.motion_text}
                                                                                </p>
                                                                                {d.result && (
                                                                                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                                                                        {d.result}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {(d.votes_for !== null || d.votes_against !== null || d.votes_abstain !== null) && (
                                                                                <p className="text-xs text-slate-400 mt-1">
                                                                                    For: {d.votes_for ?? 0} · Against: {d.votes_against ?? 0} · Abstain: {d.votes_abstain ?? 0}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Empty state */}
                                                        {!topic.description &&
                                                            (topicNotes[topic.id] ?? []).length === 0 &&
                                                            (topicTasks[topic.id] ?? []).length === 0 &&
                                                            (topicDecisions[topic.id] ?? []).length === 0 && (
                                                                <p className="text-sm text-slate-400 italic">No details recorded for this topic yet.</p>
                                                            )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Add Topic Form */}
                                        {showAddTopic === section.id ? (
                                            <div className="p-4 bg-blue-50 border-t border-border">
                                                <p className="text-sm font-semibold text-blue-700 mb-3">Add New Topic to "{section.title}"</p>
                                                <input
                                                    className="w-full text-sm px-3 py-2 border border-border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    value={newTopicTitle}
                                                    onChange={(e) => setNewTopicTitle(e.target.value)}
                                                    placeholder="Topic title *"
                                                    autoFocus
                                                />
                                                <textarea
                                                    className="w-full text-sm px-3 py-2 border border-border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                    value={newTopicDesc}
                                                    onChange={(e) => setNewTopicDesc(e.target.value)}
                                                    placeholder="Description (optional)"
                                                    rows={3}
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAddTopic(section.id)}
                                                        disabled={savingTopic || !newTopicTitle.trim()}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                    >
                                                        <Save className="h-3.5 w-3.5 mr-1" />
                                                        {savingTopic ? "Saving..." : "Add Topic"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => { setShowAddTopic(null); setNewTopicTitle(""); setNewTopicDesc("") }}
                                                    >
                                                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-5 py-3 border-t border-border bg-white">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs"
                                                    onClick={() => { setShowAddTopic(section.id); setNewTopicTitle(""); setNewTopicDesc("") }}
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Topic
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-10 text-sm text-gray-400">
                    Powered by <span className="font-semibold text-blue-500">Meeting Genius</span>
                </div>
            </div>
        </div>
    )
}
