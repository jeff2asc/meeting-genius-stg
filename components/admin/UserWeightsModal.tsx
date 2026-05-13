"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, User as UserIcon } from "lucide-react"

interface UserWeightsModalProps {
  isOpen: boolean
  onClose: () => void
  users: any[]
  loading: boolean
  onUpdateWeight: (userId: number, weight: number) => Promise<void>
}

export default function UserWeightsModal({ isOpen, onClose, users, loading, onUpdateWeight }: UserWeightsModalProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.user_type?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [users, searchQuery])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-6 border-b border-border bg-muted/20">
          <DialogTitle className="text-xl flex items-center gap-2">
            🎯 Individual User Weights
          </DialogTitle>
          <DialogDescription>
            Manage custom voting power for specific people. These override role-based weights.
          </DialogDescription>
          
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-background"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>{searchQuery ? "No users match your search." : "No users found in this company."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {user.user_type?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Weight:</span>
                    <Input
                      type="number"
                      step="0.1"
                      className="w-20 h-9 rounded-lg bg-background font-bold text-xs"
                      value={user.voting_weight ?? 1.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateWeight(user.id, isNaN(val) ? 0 : val);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
