
import os

file_path = r'c:\Users\LENOVO\Videos\meeting-genius\components\meeting-view.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the corruption point. 
# We know from our view that line 215 (1-indexed) ends with 'alert("🔓 In-Camera removed from meeting")'
# And line 216 starts with 'id: section.id,' (mangled)

top_end_index = -1
for i, line in enumerate(lines):
    if 'alert("🔓 In-Camera removed from meeting")' in line:
        top_end_index = i
        break

if top_end_index == -1:
    print("Could not find top end index")
    exit(1)

bottom_start_index = -1
for i in range(top_end_index + 1, len(lines)):
    if 'id: section.id,' in line:
        # Wait, the mangling might be subtle.
        pass
    # We'll just look for the next thing we recognize.
    if 'tasks: tasksForThisTopic,' in lines[i]:
        # We want to keep everything from the Section object creation onwards, 
        # but we need to fix the header of that map.
        bottom_start_index = i
        break

# Actually, let's just REPLACE the whole messed up area.
# We know the top part ends after 'handleMeetingIncameraToggle' function.

restored_middle = """      }
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to update in-camera status")
    }
  }

  const fetchOpenTasksFromPreviousMeetings = async () => {
    if (!meeting) return []

    try {
      const { data: allMeetings, error: meetingsError } = await supabase
        .from("meetings")
        .select("id, meeting_date, title")
        .eq("building_id", meeting.building_id)
        .eq("meeting_type", meeting.meeting_type)
        .order("meeting_date", { ascending: false })

      if (meetingsError || !allMeetings) {
        console.error("Error fetching previous meetings:", meetingsError)
        return []
      }

      const meetingIds = allMeetings.map((m) => m.id)

      const { data: allTopics, error: topicsError } = await supabase
        .from("topics")
        .select("id, title, meeting_id")
        .in("meeting_id", meetingIds)

      if (topicsError || !allTopics) {
        console.error("Error fetching topics:", topicsError)
        return []
      }

      const topicIds = allTopics.map((t) => t.id)

      const { data: openTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*, topics(id, title, meeting_id)")
        .in("topic_id", topicIds)
        .in("status", ["open", "in_progress"])

      if (tasksError) {
        console.error("Error fetching open tasks:", tasksError)
        return []
      }

      return openTasks || []
    } catch (err) {
      console.error("Error in fetchOpenTasksFromPreviousMeetings:", err)
      return []
    }
  }

  const fetchSectionsAndTopics = async () => {
    try {
      const expandedStates = sections.reduce((acc, section) => {
        acc[section.id] = section.isExpanded
        return acc
      }, {} as Record<number, boolean>)

      const sectionsData = await apiClient.v1.sections.list(meetingId)
      const topicsData = await apiClient.v1.topics.list(meetingId)

      const allOpenTasks = await fetchOpenTasksFromPreviousMeetings()

      const sectionsWithTopics: Section[] = (sectionsData || []).map((section) => ({
"""

# Reconstruct the file:
# Part 1: Top (up to line 212 approx)
final_lines = lines[:top_end_index+1]
if not final_lines[-1].strip().endswith('}'):
    final_lines.append('      }\n')

# Part 2: Middle
final_lines.append(restored_middle)

# Part 3: Bottom
# Find where 'id: section.id,' starts in the current file.
for i in range(top_end_index + 1, len(lines)):
    if 'id: section.id,' in lines[i]:
        final_lines.extend(lines[i:])
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print("Restoration complete")
