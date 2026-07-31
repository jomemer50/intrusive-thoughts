const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhijiwqeqpvitwrolkoj.supabase.co',
  'sb_publishable_w8xyJ-odtZPENh1xUmJb7A_yy378WTX'
);

async function check() {
  const { data: conv, error } = await supabase.from('conversations').select('id');
  console.log("ALL CONVERSATIONS:", conv.map(c => c.id));
}
check();
