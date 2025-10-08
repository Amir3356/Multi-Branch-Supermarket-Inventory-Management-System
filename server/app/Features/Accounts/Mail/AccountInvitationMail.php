<?php

namespace App\Features\Accounts\Mail;

use App\Features\Accounts\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class AccountInvitationMail extends Mailable
{
    public function __construct(
        public User $user,
        public string $link,
        public int $expiresInHours,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'You have been invited to '.config('app.name'));
    }

    public function content(): Content
    {
        return new Content(markdown: 'accounts::mail.invitation');
    }
}
