import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

interface TaskToCreate {
  description: string;
  assigned_name: string | null;
  assigned_email: string | null;
  due_date: string | null;
  topic_id: number | null;
  status?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const { transcript_id, tasks, user_id } = body;

    if (!transcript_id || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "Missing required fields: transcript_id or tasks" },
        { status: 400 }
      );
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: "No tasks to create" },
        { status: 400 }
      );
    }

    // Validate that all tasks have topic_id
    const invalidTasks = tasks.filter((task: TaskToCreate) => !task.topic_id);
    if (invalidTasks.length > 0) {
      return NextResponse.json(
        { error: "All tasks must have a topic_id assigned" },
        { status: 400 }
      );
    }

    // Prepare tasks for insertion
    const tasksToInsert = tasks.map((task: TaskToCreate) => ({
      topic_id: task.topic_id,
      description: task.description,
      assigned_name: task.assigned_name || null,
      assigned_email: task.assigned_email || null,
      due_date: task.due_date || null,
      status: task.status || "open",
      created_by: user_id ? parseInt(user_id) : null,
    }));

    // Bulk insert tasks
    const { data: createdTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting tasks:", insertError);
      return NextResponse.json(
        { error: "Failed to create tasks" },
        { status: 500 }
      );
    }

    // Update transcript record with task count
    const { error: updateError } = await supabase
      .from("meeting_transcripts")
      .update({ tasks_created_count: tasks.length })
      .eq("id", transcript_id);

    if (updateError) {
      console.error("Error updating transcript:", updateError);
      // Don't fail the request, tasks were created successfully
    }

    return NextResponse.json({
      success: true,
      created_count: createdTasks?.length || 0,
      task_ids: createdTasks?.map((t) => t.id) || [],
      message: `Successfully created ${createdTasks?.length || 0} task(s)`,
    });
  } catch (error) {
    console.error("Create tasks API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
