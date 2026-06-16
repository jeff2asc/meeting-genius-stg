import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { supabase } from '@/lib/supabase'
import { isAuthorizedRequest } from '@/lib/auth-server'

// Use centralized Supabase client from @/lib/supabase
// to handle hardcoded fallbacks and singletons.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, to, subject, html, text } = body

    // API Key verification
    if (!isAuthorizedRequest(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      )
    }

    // Validation
    if (!companyId || !to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, to, subject, html' },
        { status: 400 }
      )
    }

    // Fetch company SMTP settings
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_use_tls')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('Error fetching company:', companyError)
      return NextResponse.json(
        { error: 'Company not found or SMTP not configured' },
        { status: 404 }
      )
    }

    // Check if SMTP is configured for this company
    if (!company.smtp_host || !company.smtp_user || !company.smtp_password) {
      return NextResponse.json(
        { error: 'SMTP not configured for this company' },
        { status: 400 }
      )
    }

    // Create Nodemailer transporter with company SMTP settings
    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: company.smtp_port || 587,
      secure: company.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: company.smtp_user,
        pass: company.smtp_password,
      },
      tls: {
        rejectUnauthorized: company.smtp_use_tls !== false,
      },
    })

    // Verify connection
    try {
      await transporter.verify()
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError)
      return NextResponse.json(
        { error: 'SMTP connection failed. Please check company SMTP settings.' },
        { status: 500 }
      )
    }

    // Send email
    const info = await transporter.sendMail({
      from: company.smtp_from_name 
        ? `"${company.smtp_from_name}" <${company.smtp_from_email || company.smtp_user}>`
        : company.smtp_from_email || company.smtp_user,
      to,
      subject,
      html,
      text: text || undefined,
      attachments: body.attachments || [],
    })

    console.log('Email sent:', info.messageId)

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    })

  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
