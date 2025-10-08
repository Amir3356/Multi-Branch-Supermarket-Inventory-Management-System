<x-mail::message>
# Welcome, {{ $user->full_name }}

The Owner has created a **{{ $user->role->label() }}** account for you{{ $user->branch ? ' at '.$user->branch->name : '' }}.

Click the button below to choose your password and open your dashboard.

<x-mail::button :url="$link">
Set up my account
</x-mail::button>

This link expires in {{ $expiresInHours }} hours. If it has expired, ask the Owner to resend the invitation.

If you weren't expecting this email, you can ignore it.

{{ config('app.name') }}
</x-mail::message>
