import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatUtcToLocalLong } from "@/lib/timezone"
import { getCurrentUser, supabase } from "@/lib/supabase"
import type { TicketTag, RiskLevel } from "@/lib/supabase"
import {
  formatJanusTicketDisplayLabel,
  getJanusTicketRef,
  openJanusTicketSSO,
} from "@/lib/janus"
import { ExternalLink, Calendar, Building, DollarSign, AlertCircle, CheckCircle2, Clock, User, Shield, Info, Tag } from "lucide-react"
import { useState, useEffect } from "react"

interface TicketDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  ticket: any | null
}

export default function TicketDetailsModal({
  isOpen,
  onClose,
  ticket,
}: TicketDetailsModalProps) {
  if (!ticket) return null

  const isComplaint = ticket._type === 'complaint' || ticket.type === 'complaint'
  const ticketKind = isComplaint ? 'complaint' as const : 'repair' as const
  const ticketLabel = formatJanusTicketDisplayLabel(ticket, ticketKind)

  const currentUser = getCurrentUser()
  const [isOpeningJanus, setIsOpeningJanus] = useState(false)
  const [companyTicketTags, setCompanyTicketTags] = useState<TicketTag[]>([])
  const [companyRiskLevels, setCompanyRiskLevels] = useState<RiskLevel[]>([])

  const ticketRef = getJanusTicketRef(ticket)

  // Load company-level ticket tags and risk levels
  useEffect(() => {
    const companyId = ticket?.company_id
    if (!companyId) return
    supabase
      .from('companies')
      .select('ticket_tags, risk_levels')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any
          if (d.ticket_tags) setCompanyTicketTags(d.ticket_tags as TicketTag[])
          if (d.risk_levels) setCompanyRiskLevels(d.risk_levels as RiskLevel[])
        }
      })
  }, [ticket?.company_id])

  // Context-sensitive tags: hide tags marked hide_on_closed when ticket is closed
  const isClosed = ['closed', 'resolved', 'completed'].includes(ticket?.status?.toLowerCase() || '')
  const visibleTags = companyTicketTags.filter(tag => !(tag.hide_on_closed && isClosed))

  // Resolve risk level display
  const riskLevel = ticket?.risk_level
    ? companyRiskLevels.find(r => r.value === ticket.risk_level)
    : null

  const openInJanus = async () => {
    if (!currentUser?.email) return
    setIsOpeningJanus(true)
    const ok = await openJanusTicketSSO(ticket, currentUser.email)
    if (!ok) {
      // Fallback: surface a toast-like inline message — no toast import needed,
      // the button label change is enough feedback for a modal context.
      console.error("[TicketDetailsModal] SSO open failed for ticket", ticketRef)
    }
    setIsOpeningJanus(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border border-border shadow-2xl p-0 overflow-hidden">
        {/* Header Section with colored accent */}
        <div className={`w-full h-2 ${isComplaint ? 'bg-amber-500' : 'bg-primary'}`} />
        
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">
                  Ticket ID: <span className="text-foreground">{ticketLabel}</span>
                </span>
                <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold">
                  {isComplaint ? 'Complaint' : 'Repair'}
                </Badge>
                <Badge variant="secondary" className={`uppercase text-[10px] tracking-wider font-bold ${
                  ticket.priority?.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-100 text-amber-700'
                }`}>
                  {ticket.priority || 'MEDIUM'} PRIORITY
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-bold pt-2">{ticket.title}</DialogTitle>
              <p className="sr-only">{isComplaint ? 'Complaint' : 'Repair'} ticket details for {ticket.title}</p>
            </div>
          </div>
          {/* Context-sensitive ticket tags */}
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {visibleTags.map(tag => (
                <span key={tag.label}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}>
                  <Tag className="h-2.5 w-2.5" />{tag.label}
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Building
              </span>
              <p className="text-sm font-medium">{ticket.building_name || "N/A"}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Company
              </span>
              <p className="text-sm font-medium">{ticket.company_name || "N/A"}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Status
              </span>
              <p className="text-sm font-medium capitalize">{ticket.status || "Open"}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Submitted By
              </span>
              <p className="text-sm font-medium">
                {ticket.sender_name || "Anonymous"}
                {ticket.unit_number && <span className="text-xs text-muted-foreground block">Unit: {ticket.unit_number}</span>}
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Source
              </span>
              <p className="text-sm font-medium capitalize">{ticket.source || "Portal"}</p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Budget/Est.
              </span>
              <p className="text-sm font-medium text-green-600 dark:text-green-500 font-bold">
                {ticket.budget || ticket.estimated_cost ? `$${ticket.budget || ticket.estimated_cost}` : "N/A"}
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Created At
              </span>
              <p className="text-xs font-medium">{ticket.created_at ? formatUtcToLocalLong(ticket.created_at) : "N/A"}</p>
            </div>
            <div className="space-y-1.5 col-span-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Last Updated
              </span>
              <p className="text-xs font-medium">{ticket.updated_at ? formatUtcToLocalLong(ticket.updated_at) : "N/A"}</p>
            </div>
            {riskLevel && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Risk Level
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: riskLevel.color + '20', color: riskLevel.color }}>
                  {riskLevel.label}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileTextIcon className="h-4 w-4 text-muted-foreground" />
              Description
            </h4>
            <div className="bg-muted/20 p-4 rounded-xl border border-border/50 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {ticket.description || <span className="italic text-muted-foreground">No description provided.</span>}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-muted/10 border-t border-border/50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={openInJanus}
            disabled={isOpeningJanus || !currentUser?.email || !ticketRef}
            className={isComplaint ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary'}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {isOpeningJanus ? "Opening…" : "View in Janus"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FileTextIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  )
}
