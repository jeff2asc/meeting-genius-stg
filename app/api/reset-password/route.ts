import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { triggerJanusResync, syncPasswordToJanus } from '@/lib/janus-client'



// Use administrative Supabase client from @/lib/supabase
// to handle hardcoded fallbacks and singletons.
const supabase = createAdminClient()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action } = body

        // ─── ACTION: request ─────────────────────────────────────────────────
        if (action === 'request') {
            const { email } = body

            if (!email) {
                return NextResponse.json({ error: 'Email is required' }, { status: 400 })
            }

            // 1. Look up user
            const { data: user } = await supabase
                .from('users')
                .select('id, name, email, company_id, smtp_config')
                .eq('email', email.toLowerCase().trim())
                .single()

            if (user) {
                console.log(`[Reset] Found user: ${user.email}. Generating token...`)

                // 2. Generate token (expires in 1 hour)
                const token = crypto.randomUUID()
                const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()

                // Preserve existing smtp_config values (like host, user, etc.)
                const currentConfig = user.smtp_config && typeof user.smtp_config === 'object' ? user.smtp_config : {}

                // 🛠️ FIX: Store in smtp_config because reset_token column doesn't exist
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        smtp_config: {
                            ...currentConfig,
                            reset_token: token,
                            reset_token_expiry: expiry
                        }
                    })
                    .eq('id', user.id)

                if (updateError) {
                    console.error('[Reset] CRITICAL ERROR: FAILED to save token to database. RLS likely blocking update:', updateError)
                    return NextResponse.json({
                        error: 'Failed to generate reset link. Please contact support or try again later.',
                        details: 'Persistence failure'
                    }, { status: 500 })
                }

                const origin = request.headers.get('origin') || 'http://localhost:3000'
                const resetLink = `${origin}/?reset_token=${token}`

                // 3. Dispatch Email with Fallback Logic
                try {
                    let smtpConfig = null;

                    // Try User's Company SMTP First
                    if (user.company_id) {
                        const { data: company } = await supabase
                            .from('companies')
                            .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email, smtp_use_tls')
                            .eq('id', user.company_id)
                            .single()

                        if (company?.smtp_host && company?.smtp_user && company?.smtp_password) {
                            console.log(`[Reset] Using Company SMTP: ${company.smtp_host}`)
                            smtpConfig = company
                        }
                    }

                    // FALLBACK: Use System Default (Master) SMTP if company settings are missing
                    if (!smtpConfig) {
                        console.log(`[Reset] Fallback: Using System Default Mailer (Meeting Genius)`)
                        smtpConfig = {
                            smtp_host: 'smtp.gmail.com',
                            smtp_port: 587,
                            smtp_user: 'jeffreydomingo1412@gmail.com',
                            smtp_password: 'gbpp afze kqgx ypvj',
                            smtp_from_name: 'Meeting Genius Support',
                            smtp_from_email: 'jeffreydomingo1412@gmail.com',
                            smtp_use_tls: true
                        }
                    }

                    const transporter = nodemailer.createTransport({
                        host: smtpConfig.smtp_host as string,
                        port: (smtpConfig.smtp_port as number) || 587,
                        secure: smtpConfig.smtp_port === 465,
                        auth: { user: smtpConfig.smtp_user as string, pass: smtpConfig.smtp_password as string },
                        tls: { rejectUnauthorized: smtpConfig.smtp_use_tls !== false },
                    } as any)

                    const fromHeader = smtpConfig.smtp_from_name
                        ? `"${smtpConfig.smtp_from_name}" <${smtpConfig.smtp_from_email || smtpConfig.smtp_user}>`
                        : smtpConfig.smtp_from_email || smtpConfig.smtp_user

                    await transporter.sendMail({
                        from: fromHeader as string,
                        to: user.email,
                        subject: 'Reset Your Meeting Genius Password',
                        html: `
                                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px; border: 1px solid #e2e8f0;">
                                    <h1 style="color: #1e293b; font-size: 22px; margin-bottom: 16px;">Password Reset</h1>
                                    <p style="color: #475569; line-height: 1.6;">Hi ${user.name},</p>
                                    <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">
                                        We received a request to reset your Meeting Genius password. Click the button below to set a new password.
                                        This link expires in <strong>1 hour</strong>.
                                    </p>
                                    <a href="${resetLink}"
                                        style="display: inline-block; background: #2563eb; color: white;
                                               text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                        Reset Password
                                    </a>
                                    <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                                        If you didn't request this, you can safely ignore this email.
                                    </p>
                                </div>
                            `,
                    })
                    console.log(`[Reset] SUCCESS: Reset email sent to ${user.email}`)

                } catch (emailErr) {
                    console.error('[Reset] CRITICAL: Email dispatch failed even with fallback!', emailErr)
                }
            } else {
                console.log(`[Reset] SKIP: Email not found in database: ${email}`)
            }

            // Security: Always return generic success
            return NextResponse.json({
                success: true,
                message: "If your email is registered, you'll receive a reset link shortly."
            })
        }

        // ─── ACTION: reset ────────────────────────────────────────────────────
        if (action === 'reset') {
            const { token, email, newPassword } = body

            if (!token || !email || !newPassword) {
                return NextResponse.json({ error: 'Token, email, and new password are required' }, { status: 400 })
            }

            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
            }

            // 🛠️ FIX: Look inside smtp_config for the token AND verify email
            const { data: user, error: findError } = await supabase
                .from('users')
                .select('id, email, user_type, smtp_config')
                .eq('smtp_config->>reset_token', token)
                .single()


            if (findError || !user) {
                console.error('[Reset] Invalid or non-existent token:', token, findError)
                return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
            }

            // 🛡️ SECURITY: Verify email matches the token owner
            if (user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
                console.error(`[Reset] Email mismatch. Token belongs to ${user.email}, but user entered ${email}`)
                return NextResponse.json({ error: 'Invalid email for this reset link.' }, { status: 403 })
            }

            const config = (user.smtp_config || {}) as any
            const expiry = config.reset_token_expiry

            // Check expiry
            if (!expiry || new Date(expiry) < new Date()) {
                return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })
            }

            // Hash the new password
            const salt = await bcrypt.genSalt(10)
            const newHash = await bcrypt.hash(newPassword, salt)

            // Update password and CLEAR ONLY the reset data from smtp_config
            const updatedConfig = { ...config }
            delete updatedConfig.reset_token
            delete updatedConfig.reset_token_expiry

            const { error: updateError } = await supabase
                .from('users')
                .update({
                    password_hash: newHash,
                    smtp_config: updatedConfig
                })
                .eq('id', user.id)

            if (updateError) {
                console.error('Error updating password:', updateError)
                return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 })
            }

            // 🔄 Notify Janus for real-time password sync (legacy webhook)
            triggerJanusResync('user_password_reset', {
                id: user.id,
                email: user.email,
                password: newHash
            }, 'user')

            // 💪 Strong SSO sync: write the new hash directly to Janus DB (skips master accounts)
            syncPasswordToJanus(user.email, newHash, (user as any).user_type || '')

            return NextResponse.json({ success: true, message: 'Password reset successfully. You can now log in.' })

        }

        // ─── ACTION: admin-set ────────────────────────────────────────────────
        if (action === 'admin-set') {
            const { userId, newPassword } = body

            if (!userId || !newPassword) {
                return NextResponse.json({ error: 'userId and newPassword are required' }, { status: 400 })
            }

            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
            }

            // Fetch the user first so we have email + user_type for the Janus sync
            const { data: targetUser, error: fetchError } = await supabase
                .from('users')
                .select('id, email, user_type')
                .eq('id', userId)
                .single()

            if (fetchError || !targetUser) {
                console.error('[Admin Set Password] User not found:', fetchError)
                return NextResponse.json({ error: 'User not found' }, { status: 404 })
            }

            const salt = await bcrypt.genSalt(10)
            const newHash = await bcrypt.hash(newPassword, salt)

            const { error: updateError } = await supabase
                .from('users')
                .update({ password_hash: newHash })
                .eq('id', userId)

            if (updateError) {
                console.error('[Admin Set Password] Error:', updateError)
                return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
            }

            // 🔄 Notify Janus for real-time password sync (legacy webhook)
            triggerJanusResync('user_password_reset', {
                id: userId,
                email: targetUser.email,
                password: newHash
            }, 'user')

            // 💪 Strong SSO sync: write the new hash directly to Janus DB (skips master accounts)
            syncPasswordToJanus(targetUser.email, newHash, targetUser.user_type || '')

            console.log(`[Admin Set Password] Password updated and synced to Janus for ${targetUser.email} (id=${userId})`)
            return NextResponse.json({ success: true, message: 'Password updated successfully.' })

        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error) {
        console.error('Reset password error:', error)
        return NextResponse.json(
            { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        )
    }
}
