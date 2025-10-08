<x-mail::message>
# Reset your password

Hi {{ $user->full_name }}, we received a request to reset the password for your account.

<x-mail::button :url="$link">
Choose a new password
</x-mail::button>

This link expires in {{ $expiresInMinutes }} minutes. If you didn't ask for a reset, you can ignore this email; your password won't change.

{{ config('app.name') }}
</x-mail::message>
