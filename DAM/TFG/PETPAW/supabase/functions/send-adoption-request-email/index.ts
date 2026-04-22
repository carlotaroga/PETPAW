import { createClient } from 'supabase'
import { Resend } from 'resend'

interface AdoptionRequestData {
  adoptionRequestId: number
}

interface AdoptionRequest {
  id: number
  user_id: string
  pet_id: number
  message: string
  status: string
  created_at: string
}

interface User {
  id: string
  name: string
  surnames: string
  email: string
  phone: string
}

interface Pet {
  id: number
  name: string
  breed: string
  description: string
}

interface Shelter {
  id: number
  name: string
  email: string
  address: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    const { adoptionRequestId }: AdoptionRequestData = await req.json()

    if (!adoptionRequestId) {
      throw new Error('adoptionRequestId is required')
    }

    // Fetch adoption request with related data
    const { data: adoptionRequest, error: requestError } = await supabaseClient
      .from('adoption_requests')
      .select(`
        id,
        user_id,
        pet_id,
        message,
        status,
        created_at,
        users (
          id,
          name,
          surnames,
          email,
          phone
        ),
        pets (
          id,
          name,
          breed,
          description,
          shelters (
            id,
            name,
            email,
            address
          )
        )
      `)
      .eq('id', adoptionRequestId)
      .single()

    if (requestError) {
      throw new Error(`Error fetching adoption request: ${requestError.message}`)
    }

    if (!adoptionRequest) {
      throw new Error('Adoption request not found')
    }

    const user = adoptionRequest.users as User
    const pet = adoptionRequest.pets as Pet
    const shelter = (adoptionRequest.pets as any).shelters as Shelter

    if (!user || !pet || !shelter) {
      throw new Error('Missing required data: user, pet, or shelter')
    }

    // Send email using Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'PETPAW <noreply@petpaw.com>',
      to: shelter.email,
      subject: `Nueva solicitud de adopción para ${pet.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Nueva solicitud de adopción</h1>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #495057; margin-top: 0;">Información de la mascota</h2>
            <p><strong>Nombre:</strong> ${pet.name}</p>
            <p><strong>Raza:</strong> ${pet.breed || 'No especificada'}</p>
            <p><strong>Descripción:</strong> ${pet.description || 'Sin descripción'}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #495057; margin-top: 0;">Información del solicitante</h2>
            <p><strong>Nombre:</strong> ${user.name} ${user.surnames}</p>
            <p><strong>Email:</strong> <a href="mailto:${user.email}">${user.email}</a></p>
            <p><strong>Teléfono:</strong> ${user.phone || 'No proporcionado'}</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #856404; margin-top: 0;">Mensaje del solicitante</h2>
            <p style="white-space: pre-wrap; color: #856404;">${adoptionRequest.message}</p>
          </div>

          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #0c5460; margin-top: 0;">Información de la protectora</h2>
            <p><strong>Protectora:</strong> ${shelter.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${shelter.email}">${shelter.email}</a></p>
            <p><strong>Ubicación:</strong> ${shelter.address}</p>
          </div>

          <p style="color: #6c757d; font-size: 14px;">
            Esta solicitud fue enviada a través de PETPAW el ${new Date(adoptionRequest.created_at).toLocaleDateString('es-ES')}.
          </p>
        </div>
      `,
    })

    if (emailError) {
      throw new Error(`Error sending email: ${emailError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Adoption request email sent successfully',
        emailId: emailData?.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in send-adoption-request-email function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
