"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileUp, Loader2, AlertCircle, FileText, CheckCircle2, ChevronRight, 
  ChevronDown, Settings, ListPlus, Trash2, Plus, Info
} from "lucide-react"
import { toast } from "sonner"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface ParsedNote {
  content: string
  import?: boolean
}

interface ParsedDecision {
  motion_text: string
  result: string | null
  moved_by?: string | null
  seconded_by?: string | null
  import?: boolean
}

interface ParsedTask {
  description: string
  assigned_name: string | null
  due_date: string | null
  import?: boolean
}

interface ParsedTopic {
  title: string
  description: string
  notes: ParsedNote[]
  decisions: ParsedDecision[]
  tasks: ParsedTask[]
  // Mapping state
  destSectionType: "new" | "existing"
  destSectionId: string // section id or new section title
  destTopicType: "new" | "existing"
  destTopicId: string // topic id or new topic title
}

interface ParsedSection {
  title: string
  topics: ParsedTopic[]
}

interface ImportMinutesModalProps {
  isOpen: boolean
  onClose: () => void
  meetingId: number
  sections: Array<{
    id: number
    title: string
    topics: Array<{ id: number; title: string }>
  }>
  onSuccess: () => void
}

export function ImportMinutesModal({
  isOpen,
  onClose,
  meetingId,
  sections,
  onSuccess,
}: ImportMinutesModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [parsedSections, setParsedSections] = useState<ParsedSection[]>([])
  const [activeSectionIdx, setActiveSectionIdx] = useState<number>(0)
  const [activeTopicIdx, setActiveTopicIdx] = useState<number>(0)
  const [isImporting, setIsImporting] = useState(false)

  // Clear state on close
  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setParsedSections([])
      setActiveSectionIdx(0)
      setActiveTopicIdx(0)
    }
  }, [isOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const allowedTypes = [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.pdf') && !selectedFile.name.endsWith('.docx') && !selectedFile.name.endsWith('.txt')) {
      toast.error("Invalid file type. Only .txt, .pdf, and .docx files are allowed.")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.")
      return
    }

    setFile(selectedFile)
  }

  const handleParse = async () => {
    if (!file) {
      toast.error("Please select a file to upload.")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/minutes/parse-pdf", {
        method: "POST",
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to parse document")
      }

      // Format the parsed sections with default import flags and mapping types
      const rawSections = result.structure?.sections || []
      const processed: ParsedSection[] = rawSections.map((sec: any) => ({
        title: sec.title || "Untitled Section",
        topics: (sec.topics || []).map((top: any) => ({
          title: top.title || "Untitled Topic",
          description: top.description || "",
          notes: (top.notes || []).map((n: any) => ({ ...n, import: true })),
          decisions: (top.decisions || []).map((d: any) => ({ ...d, import: true })),
          tasks: (top.tasks || []).map((t: any) => ({ ...t, import: true })),
          // Default: map to new section using parsed section title
          destSectionType: "new",
          destSectionId: sec.title || "New Section",
          destTopicType: "new",
          destTopicId: top.title || "New Topic",
        }))
      }))

      setParsedSections(processed)
      setActiveSectionIdx(0)
      setActiveTopicIdx(0)
      toast.success("Document analyzed successfully!")
    } catch (error: any) {
      console.error("Parsing error:", error)
      toast.error(error.message || "Failed to parse minutes document")
    } finally {
      setIsUploading(false)
    }
  }

  const handleImport = async () => {
    if (parsedSections.length === 0) return

    setIsImporting(true)
    try {
      const currentUser = getCurrentUser()
      
      // We keep a cache of newly inserted section titles to avoid duplicate creations
      const newSectionCache: Record<string, number> = {}

      // Loop through all sections & topics to insert
      for (let sIdx = 0; sIdx < parsedSections.length; sIdx++) {
        const sec = parsedSections[sIdx]
        for (let tIdx = 0; tIdx < sec.topics.length; tIdx++) {
          const topic = sec.topics[tIdx]
          
          let targetSectionId: number

          if (topic.destSectionType === "existing") {
            targetSectionId = parseInt(topic.destSectionId, 10)
          } else {
            // "new" section
            const newTitle = topic.destSectionId.trim()
            if (newSectionCache[newTitle]) {
              targetSectionId = newSectionCache[newTitle]
            } else {
              // Get current max order_index of sections in meeting
              const { data: currentSecs } = await supabase
                .from("sections")
                .select("order_index")
                .eq("meeting_id", meetingId)
              
              const maxOrder = currentSecs && currentSecs.length > 0 
                ? Math.max(...currentSecs.map((s: any) => s.order_index || 0)) 
                : 0

              const { data: newSec, error: newSecErr } = await supabase
                .from("sections")
                .insert({
                  meeting_id: meetingId,
                  title: newTitle,
                  order_index: maxOrder + 1
                })
                .select()
                .single()

              if (newSecErr) throw newSecErr
              targetSectionId = newSec.id
              newSectionCache[newTitle] = targetSectionId
            }
          }

          let targetTopicId: number

          if (topic.destTopicType === "existing") {
            targetTopicId = parseInt(topic.destTopicId, 10)
            
            // Append or update description
            if (topic.description) {
              const { data: existingTopic } = await supabase
                .from("topics")
                .select("description")
                .eq("id", targetTopicId)
                .single()
              
              const existingDesc = existingTopic?.description || ""
              const newDesc = existingDesc 
                ? `${existingDesc}\n\n[Imported]: ${topic.description}` 
                : topic.description

              await supabase
                .from("topics")
                .update({ description: newDesc })
                .eq("id", targetTopicId)
            }
          } else {
            // Get current max order_index of topics in section
            const { data: currentTops } = await supabase
              .from("topics")
              .select("order_index")
              .eq("section_id", targetSectionId)
            
            const maxOrder = currentTops && currentTops.length > 0 
              ? Math.max(...currentTops.map((t: any) => t.order_index || 0)) 
              : 0

            const { data: newTop, error: newTopErr } = await supabase
              .from("topics")
              .insert({
                meeting_id: meetingId,
                section_id: targetSectionId,
                title: topic.destTopicId.trim() || topic.title,
                description: topic.description,
                order_index: maxOrder + 1,
                is_incamera: false
              })
              .select()
              .single()

            if (newTopErr) throw newTopErr
            targetTopicId = newTop.id
          }

          // Insert notes
          const notesToInsert = topic.notes
            .filter(n => n.import && n.content.trim())
            .map(n => ({
              topic_id: targetTopicId,
              content: n.content,
              visibility: "public"
            }))
          
          if (notesToInsert.length > 0) {
            const { error: notesErr } = await supabase
              .from("notes")
              .insert(notesToInsert)
            if (notesErr) console.error("Notes insertion error:", notesErr)
          }

          // Insert decisions
          const decisionsToInsert = topic.decisions
            .filter(d => d.import && d.motion_text.trim())
            .map(d => ({
              topic_id: targetTopicId,
              motion_text: d.motion_text,
              result: d.result || "Carried",
              moved_by: d.moved_by || null,
              seconded_by: d.seconded_by || null
            }))

          if (decisionsToInsert.length > 0) {
            const { error: decErr } = await supabase
              .from("decisions")
              .insert(decisionsToInsert)
            if (decErr) console.error("Decisions insertion error:", decErr)
          }

          // Insert tasks
          const tasksToInsert = topic.tasks
            .filter(t => t.import && t.description.trim())
            .map(t => ({
              topic_id: targetTopicId,
              description: t.description,
              assigned_name: t.assigned_name || null,
              due_date: t.due_date || null,
              status: "open",
              created_by: currentUser?.id ? parseInt(String(currentUser.id)) : null
            }))

          if (tasksToInsert.length > 0) {
            const { error: taskErr } = await supabase
              .from("tasks")
              .insert(tasksToInsert)
            if (taskErr) console.error("Tasks insertion error:", taskErr)
          }
        }
      }

      toast.success("Minutes imported successfully!")
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error("Import error:", error)
      toast.error(error.message || "Failed to import minutes")
    } finally {
      setIsImporting(false)
    }
  }

  // Active items helpers
  const activeTopic = parsedSections[activeSectionIdx]?.topics[activeTopicIdx]

  const updateActiveTopic = (updates: Partial<ParsedTopic>) => {
    setParsedSections(prev => {
      const next = [...prev]
      const sec = { ...next[activeSectionIdx] }
      const topics = [...sec.topics]
      topics[activeTopicIdx] = { ...topics[activeTopicIdx], ...updates }
      sec.topics = topics
      next[activeSectionIdx] = sec
      return next
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && !isUploading && !isImporting && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-6 gap-4">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileUp className="h-5 w-5 text-emerald-600" />
            Import PDF Minutes (AI Ingestion)
          </DialogTitle>
        </DialogHeader>

        {parsedSections.length === 0 ? (
          // STEP 1: Upload and parse PDF
          <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-6 bg-slate-50/50">
            <div className="bg-emerald-100 dark:bg-emerald-950 p-4 rounded-full">
              <FileText className="h-10 w-10 text-emerald-600" />
            </div>
            
            <div className="text-center space-y-1.5 max-w-md">
              <h3 className="font-semibold text-base">Select meeting minutes document</h3>
              <p className="text-sm text-muted-foreground leading-normal">
                Upload a minutes PDF, Word, or TXT file. AI will break paragraphs into topics, decisions, notes, and tasks.
              </p>
            </div>

            <div className="w-full max-w-xs flex flex-col items-center">
              <Input
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileChange}
                disabled={isUploading}
                className="cursor-pointer file:text-emerald-700 bg-white"
              />
              <span className="text-[11px] text-muted-foreground mt-1.5">Max file size: 10MB</span>
            </div>

            {file && (
              <div className="flex items-center gap-3 bg-white border rounded-lg p-3 w-full max-w-md shadow-sm">
                <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-800">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={!file || isUploading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Analyze Document
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // STEP 2: Review and Assign Topics / Paragraphs
          <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden min-h-[50vh]">
            {/* Sidebar list of extracted sections & topics */}
            <div className="col-span-4 border rounded-xl overflow-y-auto bg-slate-50/50 p-3 flex flex-col gap-2 max-h-[60vh]">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">Extracted Topics</h4>
              
              {parsedSections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase px-2 py-1 truncate">
                    {section.title}
                  </div>
                  <div className="flex flex-col gap-1 pl-2">
                    {section.topics.map((topic, tIdx) => {
                      const isActive = activeSectionIdx === sIdx && activeTopicIdx === tIdx
                      const hasNotes = topic.notes.some(n => n.import)
                      const hasDecisions = topic.decisions.some(d => d.import)
                      const hasTasks = topic.tasks.some(t => t.import)
                      
                      return (
                        <button
                          key={tIdx}
                          onClick={() => {
                            setActiveSectionIdx(sIdx)
                            setActiveTopicIdx(tIdx)
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 ${
                            isActive
                              ? "bg-white border-emerald-500 shadow-sm ring-1 ring-emerald-500"
                              : "bg-white/80 border-slate-100 hover:bg-white"
                          }`}
                        >
                          <span className={`text-xs font-semibold truncate ${isActive ? "text-emerald-700" : "text-slate-800"}`}>
                            {topic.title}
                          </span>
                          
                          <div className="flex flex-wrap gap-1.5 items-center mt-1">
                            {topic.destSectionType === "new" ? (
                              <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                + {topic.destSectionId || "New Section"}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                Mapped
                              </span>
                            )}

                            <div className="flex gap-1 ml-auto text-[10px] text-muted-foreground">
                              {hasNotes && <span>📝</span>}
                              {hasDecisions && <span>⚖️</span>}
                              {hasTasks && <span>✅</span>}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Main edit area for active topic */}
            <div className="col-span-8 flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2">
              {activeTopic ? (
                <div className="space-y-4">
                  {/* Mapping / Destination Setup */}
                  <div className="bg-slate-50 border rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <ListPlus className="h-4 w-4 text-emerald-600" />
                      Import Destination &amp; Mapping
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Section Mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Section Destination</Label>
                        <Select
                          value={activeTopic.destSectionType}
                          onValueChange={(val: "new" | "existing") => {
                            const defaultSecId = val === "existing" && sections.length > 0 
                              ? String(sections[0].id) 
                              : parsedSections[activeSectionIdx].title
                            
                            updateActiveTopic({
                              destSectionType: val,
                              destSectionId: defaultSecId,
                              destTopicType: "new",
                              destTopicId: activeTopic.title
                            })
                          }}
                        >
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Create New Section</SelectItem>
                            <SelectItem value="existing" disabled={sections.length === 0}>
                              Assign to Existing Section
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Section Input / Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">
                          {activeTopic.destSectionType === "new" ? "New Section Title" : "Select Section"}
                        </Label>
                        {activeTopic.destSectionType === "new" ? (
                          <Input
                            value={activeTopic.destSectionId}
                            onChange={(e) => updateActiveTopic({ destSectionId: e.target.value })}
                            className="bg-white h-9 text-sm"
                          />
                        ) : (
                          <Select
                            value={activeTopic.destSectionId}
                            onValueChange={(val) => {
                              updateActiveTopic({ destSectionId: val })
                            }}
                          >
                            <SelectTrigger className="bg-white h-9">
                              <SelectValue placeholder="Choose a section..." />
                            </SelectTrigger>
                            <SelectContent>
                              {sections.map(s => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-3 mt-1">
                      {/* Topic Mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Topic Destination</Label>
                        <Select
                          value={activeTopic.destTopicType}
                          disabled={activeTopic.destSectionType === "new"}
                          onValueChange={(val: "new" | "existing") => {
                            const section = sections.find(s => String(s.id) === activeTopic.destSectionId)
                            const defaultTopId = val === "existing" && section && section.topics.length > 0
                              ? String(section.topics[0].id)
                              : activeTopic.title

                            updateActiveTopic({
                              destTopicType: val,
                              destTopicId: defaultTopId
                            })
                          }}
                        >
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Create New Topic</SelectItem>
                            <SelectItem value="existing">Assign to Existing Topic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Topic Input / Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">
                          {activeTopic.destTopicType === "new" ? "New Topic Title" : "Select Topic"}
                        </Label>
                        {activeTopic.destTopicType === "new" ? (
                          <Input
                            value={activeTopic.destTopicId}
                            onChange={(e) => updateActiveTopic({ destTopicId: e.target.value })}
                            className="bg-white h-9 text-sm"
                          />
                        ) : (
                          <Select
                            value={activeTopic.destTopicId}
                            onValueChange={(val) => updateActiveTopic({ destTopicId: val })}
                          >
                            <SelectTrigger className="bg-white h-9">
                              <SelectValue placeholder="Choose a topic..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(sections.find(s => String(s.id) === activeTopic.destSectionId)?.topics || []).map(t => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Topic Title & Description */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">Extracted Title (Reference)</Label>
                      <Input
                        value={activeTopic.title}
                        onChange={(e) => updateActiveTopic({ title: e.target.value })}
                        className="text-sm font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">Paragraph Content / Discussion Text</Label>
                      <Textarea
                        value={activeTopic.description}
                        onChange={(e) => updateActiveTopic({ description: e.target.value })}
                        className="min-h-[140px] text-sm leading-relaxed resize-y"
                        placeholder="Enter paragraphs/discussion text..."
                      />
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Parsed Notes ({(activeTopic.notes || []).length})</h5>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const notes = [...(activeTopic.notes || []), { content: "", import: true }]
                          updateActiveTopic({ notes })
                        }}
                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Note
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {activeTopic.notes.map((note, nIdx) => (
                        <div key={nIdx} className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border">
                          <input
                            type="checkbox"
                            checked={note.import}
                            onChange={(e) => {
                              const notes = [...activeTopic.notes]
                              notes[nIdx] = { ...notes[nIdx], import: e.target.checked }
                              updateActiveTopic({ notes })
                            }}
                            className="mt-2.5 h-4 w-4 cursor-pointer accent-emerald-600 rounded"
                          />
                          <Textarea
                            value={note.content}
                            onChange={(e) => {
                              const notes = [...activeTopic.notes]
                              notes[nIdx] = { ...notes[nIdx], content: e.target.value }
                              updateActiveTopic({ notes })
                            }}
                            className="flex-1 text-xs resize-none bg-white p-2 min-h-[40px]"
                            placeholder="Enter note content..."
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const notes = activeTopic.notes.filter((_, idx) => idx !== nIdx)
                              updateActiveTopic({ notes })
                            }}
                            className="text-red-500 hover:bg-red-50 hover:text-red-600 h-8 w-8 mt-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {activeTopic.notes.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed rounded">No notes parsed for this topic</p>
                      )}
                    </div>
                  </div>

                  {/* Decisions List */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Parsed Decisions ({(activeTopic.decisions || []).length})</h5>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const decisions = [...(activeTopic.decisions || []), { motion_text: "", result: "Carried", import: true }]
                          updateActiveTopic({ decisions })
                        }}
                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Decision
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {activeTopic.decisions.map((dec, dIdx) => (
                        <div key={dIdx} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border space-y-2 flex-col">
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="checkbox"
                              checked={dec.import}
                              onChange={(e) => {
                                const decisions = [...activeTopic.decisions]
                                decisions[dIdx] = { ...decisions[dIdx], import: e.target.checked }
                                updateActiveTopic({ decisions })
                              }}
                              className="h-4 w-4 cursor-pointer accent-emerald-600 rounded"
                            />
                            <span className="text-xs font-bold text-slate-500">Decision details</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const decisions = activeTopic.decisions.filter((_, idx) => idx !== dIdx)
                                updateActiveTopic({ decisions })
                              }}
                              className="text-red-500 hover:bg-red-50 hover:text-red-600 h-8 w-8 ml-auto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          
                          <Textarea
                            value={dec.motion_text}
                            onChange={(e) => {
                              const decisions = [...activeTopic.decisions]
                              decisions[dIdx] = { ...decisions[dIdx], motion_text: e.target.value }
                              updateActiveTopic({ decisions })
                            }}
                            className="w-full text-xs bg-white p-2 min-h-[50px] resize-none"
                            placeholder="Enter motion/decision text..."
                          />

                          <div className="grid grid-cols-3 gap-2 w-full">
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Result</Label>
                              <Input
                                value={dec.result || ""}
                                onChange={(e) => {
                                  const decisions = [...activeTopic.decisions]
                                  decisions[dIdx] = { ...decisions[dIdx], result: e.target.value }
                                  updateActiveTopic({ decisions })
                                }}
                                className="bg-white h-7 text-xs"
                                placeholder="Carried/Defeated"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Moved By</Label>
                              <Input
                                value={dec.moved_by || ""}
                                onChange={(e) => {
                                  const decisions = [...activeTopic.decisions]
                                  decisions[dIdx] = { ...decisions[dIdx], moved_by: e.target.value }
                                  updateActiveTopic({ decisions })
                                }}
                                className="bg-white h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Seconded By</Label>
                              <Input
                                value={dec.seconded_by || ""}
                                onChange={(e) => {
                                  const decisions = [...activeTopic.decisions]
                                  decisions[dIdx] = { ...decisions[dIdx], seconded_by: e.target.value }
                                  updateActiveTopic({ decisions })
                                }}
                                className="bg-white h-7 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {activeTopic.decisions.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed rounded">No decisions parsed for this topic</p>
                      )}
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Parsed Tasks ({(activeTopic.tasks || []).length})</h5>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const tasks = [...(activeTopic.tasks || []), { description: "", assigned_name: "", due_date: "", import: true }]
                          updateActiveTopic({ tasks })
                        }}
                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Task
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {activeTopic.tasks.map((task, tIdx) => (
                        <div key={tIdx} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border space-y-2 flex-col">
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="checkbox"
                              checked={task.import}
                              onChange={(e) => {
                                const tasks = [...activeTopic.tasks]
                                tasks[tIdx] = { ...tasks[tIdx], import: e.target.checked }
                                updateActiveTopic({ tasks })
                              }}
                              className="h-4 w-4 cursor-pointer accent-emerald-600 rounded"
                            />
                            <span className="text-xs font-bold text-slate-500">Action Item details</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const tasks = activeTopic.tasks.filter((_, idx) => idx !== tIdx)
                                updateActiveTopic({ tasks })
                              }}
                              className="text-red-500 hover:bg-red-50 hover:text-red-600 h-8 w-8 ml-auto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <Textarea
                            value={task.description}
                            onChange={(e) => {
                              const tasks = [...activeTopic.tasks]
                              tasks[tIdx] = { ...tasks[tIdx], description: e.target.value }
                              updateActiveTopic({ tasks })
                            }}
                            className="w-full text-xs bg-white p-2 min-h-[50px] resize-none"
                            placeholder="Enter task/action item description..."
                          />

                          <div className="grid grid-cols-2 gap-2 w-full">
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Assignee Name</Label>
                              <Input
                                value={task.assigned_name || ""}
                                onChange={(e) => {
                                  const tasks = [...activeTopic.tasks]
                                  tasks[tIdx] = { ...tasks[tIdx], assigned_name: e.target.value }
                                  updateActiveTopic({ tasks })
                                }}
                                className="bg-white h-7 text-xs"
                                placeholder="E.g. John Doe"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground uppercase font-bold">Due Date</Label>
                              <Input
                                type="date"
                                value={task.due_date || ""}
                                onChange={(e) => {
                                  const tasks = [...activeTopic.tasks]
                                  tasks[tIdx] = { ...tasks[tIdx], due_date: e.target.value || null }
                                  updateActiveTopic({ tasks })
                                }}
                                className="bg-white h-7 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {activeTopic.tasks.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed rounded">No tasks parsed for this topic</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Info className="h-8 w-8 mb-2" />
                  <p className="text-sm font-medium">Select a topic from the left sidebar to edit details and mapping.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {parsedSections.length > 0 && (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setParsedSections([])
                setFile(null)
              }}
              disabled={isImporting}
            >
              Back to Upload
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing into Meeting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Import Minutes into Meeting
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
