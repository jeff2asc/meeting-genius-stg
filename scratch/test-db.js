const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = '/opt/meetinggenius/app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  console.log('--- LINKING UNSECTIONED TOPICS TO SECTIONS ---');

  // Fetch all topics where section_id is null
  const { data: topics, error: tErr } = await supabase
    .from('topics')
    .select('id, meeting_id, title')
    .is('section_id', null);

  if (tErr) {
    console.error('Error fetching unsectioned topics:', tErr);
    process.exit(1);
  }

  console.log(`Found ${topics.length} unsectioned topics in the database.`);

  let updatedCount = 0;

  for (const topic of topics) {
    // Fetch sections for this meeting ordered by order_index
    const { data: sections, error: sErr } = await supabase
      .from('sections')
      .select('id, title')
      .eq('meeting_id', topic.meeting_id)
      .order('order_index');

    if (sErr) {
      console.error(`Error fetching sections for meeting ${topic.meeting_id}:`, sErr);
      continue;
    }

    if (!sections || sections.length === 0) {
      console.log(`Meeting ID ${topic.meeting_id} has no sections yet. Skipping...`);
      continue;
    }

    // Determine the best section.
    // Try to find a section that matches the topic's context, otherwise default to the first section.
    let bestSection = sections[0];

    // If the topic is "Approval of the agenda", try to put it in "Approval of Agenda" or similar
    const lowerTitle = topic.title.toLowerCase();
    if (lowerTitle.includes('agenda')) {
      const match = sections.find(s => s.title.toLowerCase().includes('agenda'));
      if (match) bestSection = match;
    } else if (lowerTitle.includes('adjourn')) {
      const match = sections.find(s => s.title.toLowerCase().includes('adjournment'));
      if (match) bestSection = match;
    } else if (lowerTitle.includes('call to order') || lowerTitle.includes('quorum')) {
      const match = sections.find(s => s.title.toLowerCase().includes('call to order'));
      if (match) bestSection = match;
    } else {
      // Put general topics in "New Business" or "Old Business" if they exist, else first section
      const newBiz = sections.find(s => s.title.toLowerCase().includes('new business'));
      if (newBiz) bestSection = newBiz;
    }

    console.log(`Linking Topic "${topic.title}" (ID ${topic.id}) in Meeting ${topic.meeting_id} to Section "${bestSection.title}" (ID ${bestSection.id})`);

    const { error: upErr } = await supabase
      .from('topics')
      .update({ section_id: bestSection.id })
      .eq('id', topic.id);

    if (upErr) {
      console.error(`Error updating topic ${topic.id}:`, upErr);
    } else {
      updatedCount++;
    }
  }

  console.log(`\n--- LINKING COMPLETE. Total topics linked: ${updatedCount} ---`);
}

run();
