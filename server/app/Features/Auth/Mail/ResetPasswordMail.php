<?php

namespace App\Features\Auth\Mail;

use App\Features\Accounts\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ResetPasswordMail extends Mailable
{
    public string $link;

    public int $expiresInMinutes;

    public function __construct(public User $user, string $token)
    {
        $this->link = rtrim(config('pharmacy.frontend_url'), '/')
            .'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->email]);
        $this->expiresInMinutes = (int) config('auth.passwords.users.expire');
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Reset your '.config('app.name').' password');
    }

    public function content(): Content
    {
        return new Content(markdown: 'auth::mail.reset-password');
    }
}
