"use client"

import { useEffect, useState, useRef } from "react"
import { Clock } from "lucide-react"

interface TimerProps {
  elapsedTime: number
  isRecording: boolean
  meetingId: string
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void
}

export default function Timer({ 
  elapsedTime, 
  isRecording, 
  meetingId,
  onRecordingComplete 
}: TimerProps) {
  const [time, setTime] = useState(0)
  const [isClient, setIsClient] = useState(false)

  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const systemStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isClient) return

    if (isRecording) {
      startRecording()
    } else {
      stopRecording()
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [isRecording, isClient])

  const startRecording = async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      console.error("Recording only works in browser")
      return
    }

    try {
      audioChunksRef.current = []

      // ⭐ NEW: Ask user which mode they want
      const useMicOnly = confirm(
        "🎤 Recording Mode\n\n" +
        "Click OK to record MICROPHONE ONLY (recommended)\n" +
        "Click Cancel to record SYSTEM AUDIO + MICROPHONE (for virtual meetings)"
      )

      if (useMicOnly) {
        // ⭐ MICROPHONE ONLY MODE
        await startMicrophoneOnlyRecording()
      } else {
        // ⭐ SYSTEM AUDIO + MICROPHONE MODE
        await startFullRecording()
      }

    } catch (error: any) {
      console.error("❌ Error starting recording:", error)
      handleRecordingError(error)
    }
  }

  // ⭐ NEW: Microphone-only recording (simple & reliable)
  const startMicrophoneOnlyRecording = async () => {
    try {
      console.log("🎤 Starting microphone-only recording...")

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = micStream
      startMediaRecorder(micStream)
      console.log("✅ Microphone-only recording started!")

    } catch (error: any) {
      throw error
    }
  }

  // ⭐ EXISTING: Full recording with system audio + microphone
  const startFullRecording = async () => {
    try {
      console.log("🎬 Starting system audio + microphone recording...")

      // Step 1: Get system audio (screen/tab share with audio)
      const systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // Must include video
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } as any,
      })

      // Remove video track
      const videoTracks = systemStream.getVideoTracks()
      videoTracks.forEach(track => track.stop())
      systemStreamRef.current = systemStream

      // Step 2: Get microphone audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })
      streamRef.current = micStream

      // Step 3: Combine both audio streams
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error("AudioContext not supported")
      }

      const audioContext = new AudioContextClass()
      const systemAudioTracks = systemStream.getAudioTracks()

      if (systemAudioTracks.length === 0) {
        // No system audio - fallback to microphone only
        console.warn("⚠️ No system audio available, using microphone only")
        const micSource = audioContext.createMediaStreamSource(micStream)
        const destination = audioContext.createMediaStreamDestination()
        micSource.connect(destination)
        startMediaRecorder(destination.stream)
        return
      }

      // Both system audio and microphone available
      const systemSource = audioContext.createMediaStreamSource(systemStream)
      const micSource = audioContext.createMediaStreamSource(micStream)
      const destination = audioContext.createMediaStreamDestination()

      systemSource.connect(destination)
      micSource.connect(destination)

      console.log("✅ Combined audio stream created")
      startMediaRecorder(destination.stream)

    } catch (error: any) {
      throw error
    }
  }

  const handleRecordingError = (error: any) => {
    let errorMessage = ""

    if (error.name === "NotAllowedError") {
      errorMessage = 
        "🎤 Microphone Access Denied\n\n" +
        "To record the meeting, please:\n" +
        "1. Click the 🔒 lock icon in your browser address bar\n" +
        "2. Set Microphone to 'Allow'\n" +
        "3. Refresh the page and try again"
    } else if (error.name === "NotFoundError") {
      errorMessage = 
        "🎤 No Microphone Found\n\n" +
        "Please connect a microphone and try again."
    } else if (error.name === "NotReadableError") {
      errorMessage = 
        "⚠️ Microphone Already in Use\n\n" +
        "Please close other apps using your microphone and try again."
    } else if (error.name === "AbortError") {
      errorMessage = 
        "❌ Screen Share Cancelled\n\n" +
        "Recording cancelled. Click 'Record' again to try microphone-only mode."
    } else if (error.name === "NotSupportedError") {
      errorMessage = 
        "⚠️ Browser Not Fully Supported\n\n" +
        "Your browser doesn't support audio capture from screen sharing.\n\n" +
        "Try using:\n" +
        "• Chrome/Edge (recommended)\n" +
        "• Firefox\n\n" +
        "Or click 'Record' again and choose microphone-only mode."
    } else {
      errorMessage = 
        "❌ Could not start recording\n\n" +
        "Error: " + error.message + "\n\n" +
        "Try microphone-only mode by clicking OK when prompted."
    }

    alert(errorMessage)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(track => track.stop())
    }
  }

  const startMediaRecorder = (stream: MediaStream) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    })

    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      const duration = time

      console.log(`🎙️ Recording stopped. Duration: ${duration}s, Size: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`)

      if (onRecordingComplete) {
        onRecordingComplete(audioBlob, duration)
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }

    mediaRecorder.start(1000)
    console.log("🔴 Recording started!")
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log("⏹️ Stopping recording...")
      mediaRecorderRef.current.stop()
    }
  }

  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = time % 60

  const formatTime = (num: number) => String(num).padStart(2, "0")

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
      isRecording ? 'bg-red-100 animate-pulse' : 'bg-muted'
    }`}>
      <Clock className={`h-4 w-4 ${isRecording ? 'text-red-600' : 'text-primary'}`} />
      <span className={`font-mono font-semibold ${
        isRecording ? 'text-red-600' : 'text-foreground'
      }`}>
        {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
      </span>
      {isRecording && (
        <span className="ml-2 h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
      )}
    </div>
  )
}