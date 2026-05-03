"use client"

import { useState, useEffect } from "react"
import { 
  X, 
  Search, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Loader2,
  FileText,
  ListTodo,
  StickyNote,
  FileCheck,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  supabase, 
  getPreviousMeetingOfSameType, 
  getTopicsFromMeeting,
  createAdminClient
} from "@/lib/supabase"
import { toast } from "sonner"

interface RolloverTopicModalProps {
  isOpen: boolean
  onClose: () => void
  meetingId: string
  buildingId: number
  meetingType: string
  sections: Array<{ id: number; title: string }>
  onSuccess: () => void
}

export default function RolloverTopicModal({
  isOpen,
  onClose,
  meetingId,
  buildingId,
  meetingType,
  sections,
  onSuccess
}: RolloverTopicModalProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [prevMeeting, setPrevMeeting] = useState<any>(null)
  const [prevTopics, setPrevTopics] = useState<any[]>([])
  const [prevTasks, setPrevTasks] = useState<any[]>([])
  const [prevNotes, setPrevNotes] = useState<any[]>([])
  const [prevDecisions, setPrevDecisions] = useState<any[]>([])
  const [prevSections, setPrevSections] = useState<any[]>([])
  
  // Selections
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([])
  const [selectedDecisionIds, setSelectedDecisionIds] = useState<number[]>([])
  
  const [expandedTopics, setExpandedTopics] = useState<number[]>([])
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset selections when opening
      setSelectedTopicIds([])
      setSelectedTaskIds([])
      setSelectedNoteIds([])
      setSelectedDecisionIds([])
      setTargetSectionId(null)
      fetchPreviousMeetingData()
    }
  }, [isOpen])

  const fetchPreviousMeetingData = async () => {
    setFetching(true)
    try {
      const previous = await getPreviousMeetingOfSameType(buildingId, meetingType, parseInt(meetingId))
      
      if (previous) {
        setPrevMeeting(previous)
        const topics = await getTopicsFromMeeting(previous.id)

        // ⭐ NEW: Filter out topics that are already in the CURRENT meeting
        // We look at 'rolled_over_from_topic_id' in the current meeting's topics
        const { data: currentMeetingTopics } = await supabase
          .from('topics')
          .select('rolled_over_from_topic_id')
          .eq('meeting_id', parseInt(meetingId))
          .not('rolled_over_from_topic_id', 'is', null)
        
        const alreadyRolledOverIds = (currentMeetingTopics || []).map(t => t.rolled_over_from_topic_id)
        
        const availableTopics = (topics || []).filter(t => !alreadyRolledOverIds.includes(t.id))
        setPrevTopics(availableTopics)

        const [tasksRes, notesRes, decisionsRes, sectionsRes] = await Promise.all([
          supabase.from('tasks').select('*').in('topic_id', availableTopics.length > 0 ? availableTopics.map(t => t.id) : [0]),
          supabase.from('notes').select('*').in('topic_id', availableTopics.length > 0 ? availableTopics.map(t => t.id) : [0]),
          supabase.from('decisions').select('*').in('topic_id', availableTopics.length > 0 ? availableTopics.map(t => t.id) : [0]),
          supabase.from('sections').select('*').eq('meeting_id', previous.id).order('order_index')
        ])
        
        setPrevTasks(tasksRes.data || [])
        setPrevNotes(notesRes.data || [])
        setPrevDecisions(decisionsRes.data || [])
        setPrevSections(sectionsRes.data || [])
      }
    } catch (err) {
      console.error("Error fetching rollover data:", err)
      toast.error("Could not fetch previous meeting data")
    } finally {
      setFetching(false)
    }
  }

  const handleRollover = async () => {
    if (selectedTopicIds.length === 0) {
      toast.error("Please select at least one topic to roll over")
      return
    }

    setLoading(true)
    try {
      const adminSupabase = createAdminClient()
      const meetingIdNum = parseInt(meetingId)
      
      // Determine the target section ID
      if (!targetSectionId) {
        toast.error("Please select a target section")
        return
      }
      const finalTargetSectionId = targetSectionId

      // Get current max order_index for target section
      const { data: existingTopics } = await adminSupabase
        .from('topics')
        .select('order_index')
        .eq('section_id', finalTargetSectionId)
        .order('order_index', { ascending: false })
        .limit(1)
      
      let nextOrderIndex = (existingTopics?.[0]?.order_index || 0) + 1

      for (const topicId of selectedTopicIds) {
        const topic = prevTopics.find(t => t.id === topicId)
        if (!topic) continue

        const { data: newTopic, error: topicError } = await adminSupabase
          .from('topics')
          .insert({
            meeting_id: meetingIdNum,
            section_id: finalTargetSectionId,
            title: topic.title,
            description: topic.description,
            order_index: nextOrderIndex++,
            rolled_over_from_topic_id: topic.id,
            created_at: topic.created_at // Preserve original creation date
          })
          .select()
          .single()

        if (topicError) throw topicError

        if (newTopic) {
          // Clone items
          const topicTasks = prevTasks.filter(t => t.topic_id === topicId && selectedTaskIds.includes(t.id))
          if (topicTasks.length > 0) {
            const toInsert = topicTasks.map(t => {
              const { id, updated_at, ...rest } = t;
              return { ...rest, topic_id: newTopic.id };
            })
            await adminSupabase.from('tasks').insert(toInsert)
          }

          const topicNotes = prevNotes.filter(n => n.topic_id === topicId && selectedNoteIds.includes(n.id))
          if (topicNotes.length > 0) {
            const toInsert = topicNotes.map(n => {
              const { id, updated_at, ...rest } = n;
              return { ...rest, topic_id: newTopic.id };
            })
            await adminSupabase.from('notes').insert(toInsert)
          }

          const topicDecisions = prevDecisions.filter(d => d.topic_id === topicId && selectedDecisionIds.includes(d.id))
          if (topicDecisions.length > 0) {
            const toInsert = topicDecisions.map(d => {
              const { id, edited_at, ...rest } = d;
              return { ...rest, topic_id: newTopic.id };
            })
            await adminSupabase.from('decisions').insert(toInsert)
          }
        }
      }

      toast.success(`Successfully rolled over ${selectedTopicIds.length} topics`)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error("Rollover error:", err)
      toast.error(err.message || "Failed to roll over topics")
    } finally {
      setLoading(false)
    }
  }

  const toggleTopic = (topicId: number, checked: boolean) => {
    if (checked) {
      setSelectedTopicIds(prev => [...prev, topicId])
      // Also select all items under this topic by default
      setSelectedTaskIds(prev => [...prev, ...prevTasks.filter(t => t.topic_id === topicId).map(t => t.id)])
      setSelectedNoteIds(prev => [...prev, ...prevNotes.filter(n => n.topic_id === topicId).map(n => n.id)])
      setSelectedDecisionIds(prev => [...prev, ...prevDecisions.filter(d => d.topic_id === topicId).map(d => d.id)])
    } else {
      setSelectedTopicIds(prev => prev.filter(id => id !== topicId))
      // Deselect all items under this topic
      const topicTaskIds = prevTasks.filter(t => t.topic_id === topicId).map(t => t.id)
      const topicNoteIds = prevNotes.filter(n => n.topic_id === topicId).map(n => n.id)
      const topicDecisionIds = prevDecisions.filter(d => d.topic_id === topicId).map(d => d.id)
      
      setSelectedTaskIds(prev => prev.filter(id => !topicTaskIds.includes(id)))
      setSelectedNoteIds(prev => prev.filter(id => !topicNoteIds.includes(id)))
      setSelectedDecisionIds(prev => prev.filter(id => !topicDecisionIds.includes(id)))
    }
  }

  const toggleExpanded = (topicId: number) => {
    setExpandedTopics(prev => 
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl border-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-background to-decision-purple/10 p-6">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Calendar className="h-6 w-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-foreground leading-tight">Rollover Topics</h2>
                <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                   Import topics from the previous {meetingType}
                </p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted transition-all active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
          {fetching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
               <Loader2 className="h-10 w-10 animate-spin text-primary" />
               <p className="text-muted-foreground font-medium">Fetching previous meeting data...</p>
            </div>
          ) : !prevMeeting ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
               <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
               </div>
               <div>
                  <p className="text-lg font-bold text-foreground">No Previous Meeting Found</p>
                  <p className="text-muted-foreground max-w-xs mx-auto">We couldn't find a previous {meetingType} for this building to roll over from.</p>
               </div>
               <Button variant="outline" onClick={onClose} className="rounded-xl">Go Back</Button>
            </div>
          ) : (
            <>
               {/* Target Selection */}
               <div className="space-y-3">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                     Target Section
                     <Badge variant="outline" className={`${!targetSectionId ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"} text-[10px]`}>
                        {!targetSectionId ? "SELECTION REQUIRED" : "SELECTED"}
                     </Badge>
                  </label>
                  <div className="relative">
                     <select 
                        className={`w-full px-4 py-3.5 rounded-xl border-2 bg-background text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer ${!targetSectionId ? "border-red-200 text-muted-foreground" : "border-primary text-foreground"}`}
                        value={targetSectionId || ""}
                        onChange={(e) => setTargetSectionId(parseInt(e.target.value))}
                     >
                        <option value="" disabled>-- Select where these topics should go --</option>
                        {sections.map(s => (
                           <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                     </select>
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <ChevronDown className="h-5 w-5" />
                     </div>
                  </div>
                  {!targetSectionId && (
                     <p className="text-[10px] text-red-500 font-bold ml-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        You must choose a section before you can import
                     </p>
                  )}
               </div>

               {/* Topic List */}
               <div className="flex-1 min-h-0 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                     <label className="text-sm font-bold text-foreground flex items-center gap-2">
                        Select Topics to Roll Over
                        <Badge variant="outline" className="text-[10px]">{selectedTopicIds.length} Selected</Badge>
                     </label>
                  </div>

                  <ScrollArea className="flex-1 border-2 border-border rounded-2xl bg-muted/30">
                     <div className="p-4 space-y-3">
                        {prevSections.map(section => {
                           const sectionTopics = prevTopics.filter(t => t.section_id === section.id)
                           if (sectionTopics.length === 0) return null
                           
                           return (
                              <div key={section.id} className="space-y-2">
                                 <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">{section.title}</h4>
                                 {sectionTopics.map(topic => (
                                    <div key={topic.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${selectedTopicIds.includes(topic.id) ? "border-primary shadow-sm" : "border-border"}`}>
                                       <div className="flex items-center p-3 gap-3">
                                          <Checkbox 
                                             checked={selectedTopicIds.includes(topic.id)}
                                             onCheckedChange={(checked) => toggleTopic(topic.id, !!checked)}
                                          />
                                          <div className="flex-1 min-w-0" onClick={() => toggleExpanded(topic.id)}>
                                             <div className="text-sm font-bold truncate cursor-pointer">{topic.title}</div>
                                             <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                                   <ListTodo className="h-3 w-3" /> {prevTasks.filter(t => t.topic_id === topic.id).length} Tasks
                                                </span>
                                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                                   <StickyNote className="h-3 w-3" /> {prevNotes.filter(n => n.topic_id === topic.id).length} Notes
                                                </span>
                                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                                   <FileCheck className="h-3 w-3" /> {prevDecisions.filter(d => d.topic_id === topic.id).length} Decisions
                                                </span>
                                             </div>
                                          </div>
                                          <button onClick={() => toggleExpanded(topic.id)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                                             {expandedTopics.includes(topic.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                          </button>
                                       </div>

                                       {expandedTopics.includes(topic.id) && (
                                          <div className="bg-muted/30 border-t border-border p-3 space-y-3">
                                             {/* Tasks Selection */}
                                             {prevTasks.filter(t => t.topic_id === topic.id).length > 0 && (
                                                <div className="space-y-1.5">
                                                   <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                      <ListTodo className="h-3 w-3" /> Include Tasks
                                                   </p>
                                                   <div className="space-y-1 ml-1">
                                                      {prevTasks.filter(t => t.topic_id === topic.id).map(task => (
                                                         <div key={task.id} className="flex items-center gap-2">
                                                            <Checkbox 
                                                               checked={selectedTaskIds.includes(task.id)}
                                                               onCheckedChange={(checked) => {
                                                                  if (checked) setSelectedTaskIds(prev => [...prev, task.id])
                                                                  else setSelectedTaskIds(prev => prev.filter(id => id !== task.id))
                                                               }}
                                                               className="h-3.5 w-3.5"
                                                            />
                                                            <span className="text-[11px] text-foreground truncate">{task.description}</span>
                                                         </div>
                                                      ))}
                                                   </div>
                                                </div>
                                             )}

                                             {/* Notes Selection */}
                                             {prevNotes.filter(n => n.topic_id === topic.id).length > 0 && (
                                                <div className="space-y-1.5">
                                                   <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                      <StickyNote className="h-3 w-3" /> Include Notes
                                                   </p>
                                                   <div className="space-y-1 ml-1">
                                                      {prevNotes.filter(n => n.topic_id === topic.id).map(note => (
                                                         <div key={note.id} className="flex items-center gap-2">
                                                            <Checkbox 
                                                               checked={selectedNoteIds.includes(note.id)}
                                                               onCheckedChange={(checked) => {
                                                                  if (checked) setSelectedNoteIds(prev => [...prev, note.id])
                                                                  else setSelectedNoteIds(prev => prev.filter(id => id !== note.id))
                                                               }}
                                                               className="h-3.5 w-3.5"
                                                            />
                                                            <span className="text-[11px] text-foreground line-clamp-1 italic">"{note.content}"</span>
                                                         </div>
                                                      ))}
                                                   </div>
                                                </div>
                                             )}

                                             {/* Decisions Selection */}
                                             {prevDecisions.filter(d => d.topic_id === topic.id).length > 0 && (
                                                <div className="space-y-1.5">
                                                   <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                      <FileCheck className="h-3 w-3" /> Include Decisions
                                                   </p>
                                                   <div className="space-y-1 ml-1">
                                                      {prevDecisions.filter(d => d.topic_id === topic.id).map(dec => (
                                                         <div key={dec.id} className="flex items-center gap-2">
                                                            <Checkbox 
                                                               checked={selectedDecisionIds.includes(dec.id)}
                                                               onCheckedChange={(checked) => {
                                                                  if (checked) setSelectedDecisionIds(prev => [...prev, dec.id])
                                                                  else setSelectedDecisionIds(prev => prev.filter(id => id !== dec.id))
                                                               }}
                                                               className="h-3.5 w-3.5"
                                                            />
                                                            <span className="text-[11px] font-medium text-foreground truncate">{dec.motion_text}</span>
                                                         </div>
                                                      ))}
                                                   </div>
                                                </div>
                                             )}
                                          </div>
                                       )}
                                    </div>
                                 ))}
                              </div>
                           )
                        })}
                     </div>
                  </ScrollArea>
               </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/10 flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl h-12 font-bold"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRollover}
            className="flex-1 rounded-xl h-12 font-bold bg-gradient-to-r from-primary to-decision-purple text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
            disabled={loading || fetching || !prevMeeting || selectedTopicIds.length === 0 || !targetSectionId}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing Rollover...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirm Rollover
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
