import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Falta un token de autenticacion valido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token no valido o sesion expirada" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { adoptionRequestId } = await req.json();

    if (!adoptionRequestId) {
      return new Response(
        JSON.stringify({ error: "Falta adoptionRequestId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const { data: requestRow, error: requestError } = await supabase
      .from("adoption_requests")
      .select("id, user_id, pet_id, message, status, created_at")
      .eq("id", adoptionRequestId)
      .single();

    if (requestError || !requestRow) {
      throw requestError || new Error("Solicitud no encontrada");
    }

    if (requestRow.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "No tienes permiso para enviar esta solicitud" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, name, surnames, email, phone")
      .eq("id", requestRow.user_id)
      .single();

    if (userError || !userRow) {
      throw userError || new Error("Usuario no encontrado");
    }

    const { data: petRow, error: petError } = await supabase
      .from("pets")
      .select("id, name, shelter_id")
      .eq("id", requestRow.pet_id)
      .single();

    if (petError || !petRow) {
      throw petError || new Error("Mascota no encontrada");
    }

    const { data: shelterRow, error: shelterError } = await supabase
      .from("shelters")
      .select("id, name, email")
      .eq("id", petRow.shelter_id)
      .single();

    if (shelterError || !shelterRow) {
      throw shelterError || new Error("Protectora no encontrada");
    }

    const safeMessage = (requestRow.message || "").replace(/\n/g, "<br>");

    const emailResponse = await resend.emails.send({
      from: "PETPAW <onboarding@resend.dev>",
      to: shelterRow.email,
      subject: `Nueva solicitud de adopción para ${petRow.name}`,
      html: `
        <h2>Nueva solicitud de adopción</h2>
        <p><strong>Mascota:</strong> ${petRow.name}</p>
        <p><strong>Protectora:</strong> ${shelterRow.name}</p>
        <hr>
        <p><strong>Solicitante:</strong> ${userRow.name ?? ""} ${userRow.surnames ?? ""}</p>
        <p><strong>Email:</strong> ${userRow.email ?? "No indicado"}</p>
        <p><strong>Teléfono:</strong> ${userRow.phone ?? "No indicado"}</p>
        <hr>
        <p><strong>Mensaje:</strong></p>
        <p>${safeMessage}</p>
      `,
    });

    return new Response(
      JSON.stringify({ ok: true, emailResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge Function error:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
