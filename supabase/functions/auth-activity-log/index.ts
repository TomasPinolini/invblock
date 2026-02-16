// Supabase Edge Function: Auth Activity Logger
// Triggered by Supabase Auth webhook on sign-in/sign-up events
// Logs auth activity to auth_events table and sends security alert
// email via Resend when a new device/IP combination is detected

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "tomaspinolini2003@gmail.com";
const SENDER_NAME = Deno.env.get("SENDER_NAME") || "Slock";
const APP_URL = Deno.env.get("APP_URL") || "https://invblock.vercel.app";

interface AuthWebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    email: string;
  };
  schema: string;
  old_record: unknown;
}

// Compute SHA-256 hash of user-agent + IP for device fingerprinting
async function computeDeviceHash(
  userAgent: string,
  ip: string
): Promise<string> {
  const data = new TextEncoder().encode(`${userAgent}|${ip}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Extract client IP from request headers
function extractIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated; take the first (client) IP
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

// Format timestamp in Argentina timezone (ART = UTC-3)
function formatTimestampART(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// Generate security alert email HTML
function generateSecurityEmailHTML(
  userAgent: string,
  ip: string,
  timestamp: Date
): string {
  const deviceSummary =
    userAgent.length > 100 ? userAgent.substring(0, 100) + "..." : userAgent;
  const formattedTime = formatTimestampART(timestamp);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Login Detected</title>
</head>
<body style="margin: 0; padding: 0; background-color: #18181b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #3f3f46;">
      <h1 style="color: #fafafa; margin: 0; font-size: 24px;">&#128272; New Login Detected</h1>
      <p style="color: #a1a1aa; margin: 8px 0 0; font-size: 14px;">We noticed a sign-in from a new device or location.</p>
    </div>

    <!-- Details Card -->
    <div style="background-color: #27272a; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #3f3f46;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Device</p>
        <p style="color: #fafafa; margin: 0; font-size: 14px; word-break: break-word;">${deviceSummary}</p>
      </div>

      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #3f3f46;">
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">IP Address</p>
        <p style="color: #fafafa; margin: 0; font-size: 14px; font-family: 'SF Mono', Monaco, monospace;">${ip}</p>
      </div>

      <div>
        <p style="color: #a1a1aa; margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</p>
        <p style="color: #fafafa; margin: 0; font-size: 14px;">${formattedTime}</p>
      </div>
    </div>

    <!-- Warning -->
    <div style="background-color: #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <p style="color: #fafafa; margin: 0 0 8px; font-size: 14px;">
        <strong>If this was you</strong>, no action is needed.
      </p>
      <p style="color: #f59e0b; margin: 0; font-size: 14px;">
        <strong>If this wasn't you</strong>, change your password immediately.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #3f3f46;">
      <p style="color: #71717a; margin: 0; font-size: 12px;">
        Sent by Slock Financial Command Center
      </p>
      <p style="color: #52525b; margin: 8px 0 0; font-size: 11px;">
        This is an automated security notification.
      </p>
    </div>
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #27272a; text-align:center;">
      <p style="color:#71717a; font-size:12px; margin:0;">
        You're receiving this because you have an account on Slock.
        <a href="${APP_URL}/settings#notifications" style="color:#60a5fa; text-decoration:underline;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Send email via Brevo
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Brevo API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

// Main handler
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse the webhook payload
    const payload: AuthWebhookPayload = await req.json();

    const userId = payload.record?.id;
    const email = payload.record?.email;
    const eventType = (payload.type || "unknown").toLowerCase();

    if (!userId) {
      throw new Error("Missing user ID in webhook payload");
    }

    console.log(
      `[auth-activity-log] Processing ${eventType} event for user ${userId}`
    );

    // Extract device info from request headers
    const ip = extractIP(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Compute device fingerprint hash
    const deviceHash = await computeDeviceHash(userAgent, ip);

    // Insert auth event into database
    const { data: inserted, error: insertError } = await supabase
      .from("auth_events")
      .insert({
        user_id: userId,
        event_type: eventType,
        ip_address: ip,
        user_agent: userAgent,
        device_hash: deviceHash,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert auth event: ${insertError.message}`);
    }

    const insertedId = inserted.id;
    console.log(`[auth-activity-log] Event logged with ID ${insertedId}`);

    // Check if this device has been seen before for this user
    const { data: previous, error: lookupError } = await supabase
      .from("auth_events")
      .select("id")
      .eq("user_id", userId)
      .eq("device_hash", deviceHash)
      .neq("id", insertedId)
      .limit(1);

    if (lookupError) {
      console.error(
        "[auth-activity-log] Failed to check previous devices:",
        lookupError.message
      );
      // Non-fatal: log the event but skip the email check
      return new Response(
        JSON.stringify({
          success: true,
          event_id: insertedId,
          new_device: null,
          email_sent: false,
          note: "Device lookup failed, event still logged",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const isNewDevice = !previous || previous.length === 0;

    let emailSent = false;

    if (isNewDevice && email) {
      // Check email preferences (opt-out model: default to true if no row)
      const { data: prefs } = await supabase
        .from("user_email_preferences")
        .select("security_alerts")
        .eq("user_id", userId)
        .single();

      if (prefs && prefs.security_alerts === false) {
        console.log(
          `[auth-activity-log] User ${userId} opted out of security alerts, skipping email`
        );
      } else {
        console.log(
          `[auth-activity-log] New device detected for ${userId}, sending security alert to ${email}`
        );

        const html = generateSecurityEmailHTML(userAgent, ip, new Date());
        emailSent = await sendEmail(
          email,
          "\u{1F510} New login to your Slock account",
          html
        );

        if (emailSent) {
          console.log(`[auth-activity-log] Security alert sent to ${email}`);
        } else {
          console.error(
            `[auth-activity-log] Failed to send security alert to ${email}`
          );
        }
      }
    } else if (!isNewDevice) {
      console.log(
        `[auth-activity-log] Known device for user ${userId}, no alert needed`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: insertedId,
        new_device: isNewDevice,
        email_sent: emailSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[auth-activity-log] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
