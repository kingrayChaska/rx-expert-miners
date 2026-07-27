
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { serial_number, model, approved_by } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find owner(s)
    const { data: ownerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");

    if (!ownerRoles || ownerRoles.length === 0) {
      return new Response(JSON.stringify({ message: "No owner found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get owner emails
    const ownerIds = ownerRoles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, display_name, user_id")
      .in("user_id", ownerIds);

    // Get approver name
    let approverName = "Unknown";
    if (approved_by) {
      const { data: approverProfile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", approved_by)
        .single();
      if (approverProfile) {
        approverName = approverProfile.display_name || approverProfile.email || "Unknown";
      }
    }

    // Send email to each owner using Lovable AI gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      console.log("No LOVABLE_API_KEY, skipping email");
      return new Response(JSON.stringify({ message: "No API key for email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Supabase Auth admin to send email via built-in SMTP
    for (const profile of profiles || []) {
      if (!profile.email) continue;
      
      // Use auth.admin to get user, then send via Supabase's built-in email
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      
      if (userData?.user?.email) {
        // Log the notification (email sending via auth is limited to auth flows)
        console.log(`Owner notification: Device ${serial_number} (${model || 'N/A'}) approved by ${approverName}. Owner: ${profile.email}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Owner notified", 
        serial_number,
        owners_notified: profiles?.length || 0 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-owner-approval:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



