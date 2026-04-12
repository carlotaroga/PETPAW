import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://hfwkaedcpvpfccwbcrie.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2thZWRjcHZwZmNjd2JjcmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjEwOTcsImV4cCI6MjA4NDQ5NzA5N30.WTkRsnOpDEnqzffLzNQ0AZl18ROu59dlLCupkDatwHQ'

const supabase = createClient(supabaseUrl, supabaseKey)

export async function fetchPets() {
  const { data, error } = await supabase.from('pets').select('*')
  if (error) {
    console.error('Error cargando mascotas:', error.message)
    return []
  }
  return data ?? []
}
