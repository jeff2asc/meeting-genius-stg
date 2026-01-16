"use client"

import { useState, useEffect, useRef } from "react"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { Sparkles } from "lucide-react"

interface GeniusWord {
  id: number
  shortcode: string
  description: string
}

interface GeniusWordsInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
  isTextarea?: boolean
}

export default function GeniusWordsInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
  disabled = false,
  isTextarea = true
}: GeniusWordsInputProps) {
  const [geniusWords, setGeniusWords] = useState<GeniusWord[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<GeniusWord[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()

  // Fetch user's GeniusWords on mount
  useEffect(() => {
    fetchGeniusWords()
  }, [])

  const fetchGeniusWords = async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('genius_words')
        .select('id, shortcode, description')
        .eq('user_id', currentUser.id)
        .order('shortcode', { ascending: true })

      if (!error && data) {
        setGeniusWords(data)
      }
    } catch (err) {
      console.error('Error fetching genius words:', err)
    }
  }

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0
    
    onChange(newValue)
    setCursorPosition(cursorPos)

    // Check if user is typing a shortcode
    const textBeforeCursor = newValue.substring(0, cursorPos)
    const match = textBeforeCursor.match(/#(\w*)$/)

    if (match) {
      const searchTerm = match[1].toLowerCase()
      const filtered = geniusWords.filter(gw =>
        gw.shortcode.toLowerCase().includes(`#${searchTerm}`)
      )
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSelectedIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }

  // Handle suggestion selection
  const insertSuggestion = (geniusWord: GeniusWord) => {
    const textBeforeCursor = value.substring(0, cursorPosition)
    const textAfterCursor = value.substring(cursorPosition)
    
    // Find the # position
    const hashIndex = textBeforeCursor.lastIndexOf('#')
    
    if (hashIndex !== -1) {
      const newValue = 
        value.substring(0, hashIndex) + 
        geniusWord.description + 
        textAfterCursor

      onChange(newValue)
      setShowSuggestions(false)
      
      // Set cursor position after inserted text
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = hashIndex + geniusWord.description.length
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
          inputRef.current.focus()
        }
      }, 0)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
    } else if (e.key === 'Enter' && filteredSuggestions.length > 0) {
      e.preventDefault()
      insertSuggestion(filteredSuggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const baseClassName = "w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"

  return (
    <div className="relative">
      {isTextarea ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={`${baseClassName} resize-none ${className}`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`${baseClassName} ${className}`}
        />
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium text-muted-foreground">
              GeniusWords Suggestions
            </span>
          </div>
          {filteredSuggestions.map((gw, index) => (
            <button
              key={gw.id}
              onClick={() => insertSuggestion(gw)}
              className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                index === selectedIndex ? 'bg-primary/10' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <code className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-mono shrink-0">
                  {gw.shortcode}
                </code>
                <span className="text-sm text-foreground flex-1">
                  {gw.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
