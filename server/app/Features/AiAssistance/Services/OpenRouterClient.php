<?php

namespace App\Features\AiAssistance\Services;

use Generator;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * OpenRouter's OpenAI-compatible chat completions (https://openrouter.ai/docs).
 * The server-side equivalent of `openrouter.chat.send({ chatRequest: { model, messages, stream } })`.
 */
class OpenRouterClient
{
    /**
     * Sends a conversation and returns the assistant's whole reply text.
     *
     * $messages follow the OpenAI shape: [['role' => 'system'|'user'|'assistant', 'content' => string|array], ...].
     * $options are passed straight through (temperature, max_tokens, reasoning, ...).
     */
    public function chat(array $messages, array $options = []): string
    {
        $response = $this->send($this->payload($messages, $options));

        // Some models open their reply with blank lines
        return trim((string) $response->json('choices.0.message.content', ''));
    }

    /**
     * Same request with stream: true: yields the reply piece by piece as OpenRouter sends it.
     * The generator's return value is the usage OpenRouter sends in the final chunk
     * (prompt_tokens, completion_tokens, completion_tokens_details.reasoning_tokens, cost, ...), or null.
     *
     *     $stream = $client->stream($messages);
     *     foreach ($stream as $text) { echo $text; }
     *     $reasoningTokens = $stream->getReturn()['completion_tokens_details']['reasoning_tokens'] ?? null;
     */
    public function stream(array $messages, array $options = []): Generator
    {
        $body = $this->send($this->payload($messages, [...$options, 'stream' => true]), stream: true)->toPsrResponse()->getBody();

        $buffer = '';
        $usage = null;
        $started = false;
        while (! $body->eof()) {
            $buffer .= $body->read(1024);

            while (($end = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $end));
                $buffer = substr($buffer, $end + 1);

                // Server-sent events: skip blank lines and ": OPENROUTER PROCESSING" keep-alive comments
                if (! str_starts_with($line, 'data:')) {
                    continue;
                }
                $data = trim(substr($line, 5));
                if ($data === '[DONE]') {
                    return $usage;
                }

                $chunk = json_decode($data, true);
                if (isset($chunk['error'])) {
                    abort(502, 'The AI service stopped mid-answer: '.($chunk['error']['message'] ?? 'unknown error'));
                }
                $text = $chunk['choices'][0]['delta']['content'] ?? '';
                // Some models open their reply with blank lines
                if (! $started) {
                    $text = ltrim($text);
                }
                if ($text !== '') {
                    $started = true;
                    yield $text;
                }
                $usage = $chunk['usage'] ?? $usage;
            }
        }

        return $usage;
    }

    /** One question, one answer: a user prompt with an optional system prompt. */
    public function ask(string $prompt, ?string $system = null, array $options = []): string
    {
        return $this->chat($this->messages($prompt, $system), $options);
    }

    /** One question, answer streamed piece by piece (see stream()). */
    public function askStream(string $prompt, ?string $system = null, array $options = []): Generator
    {
        return $this->stream($this->messages($prompt, $system), $options);
    }

    /** Whether OPENROUTER_API_KEY is set, so callers can hide AI features instead of failing. */
    public function isConfigured(): bool
    {
        return (bool) config('services.openrouter.api_key');
    }

    private function messages(string $prompt, ?string $system): array
    {
        return array_values(array_filter([
            $system !== null ? ['role' => 'system', 'content' => $system] : null,
            ['role' => 'user', 'content' => $prompt],
        ]));
    }

    private function payload(array $messages, array $options): array
    {
        return ['model' => config('services.openrouter.model'), 'messages' => $messages, ...$options];
    }

    private function send(array $payload, bool $stream = false): Response
    {
        $key = config('services.openrouter.api_key');
        if (! $key) {
            abort(503, 'AI Assistance is not configured. Set OPENROUTER_API_KEY in the server .env file.');
        }

        try {
            $response = Http::baseUrl(config('services.openrouter.base_url'))
                ->withToken($key)
                // Optional: names this app in the OpenRouter dashboard and its app rankings
                ->withHeaders(['HTTP-Referer' => config('pharmacy.frontend_url'), 'X-Title' => config('app.name')])
                ->acceptJson()
                ->timeout(config('services.openrouter.timeout'))
                ->withOptions(['stream' => $stream])
                ->post('/chat/completions', $payload);
        } catch (ConnectionException) {
            abort(502, "Can't reach the AI service right now. Try again in a moment.");
        }

        if ($response->status() === 401 || $response->status() === 403) {
            abort(503, 'The AI service rejected the API key. Check OPENROUTER_API_KEY in the server .env file.');
        }
        if ($response->status() === 402) {
            abort(503, 'The OpenRouter account is out of credits. Add credits or switch OPENROUTER_MODEL to a free model.');
        }
        if ($response->status() === 429) {
            abort(429, 'The AI service is busy (rate limit reached). Try again in a moment.');
        }
        if (! $response->successful()) {
            abort(502, 'The AI service could not answer: '.$this->errorMessage($response));
        }

        return $response;
    }

    // OpenRouter errors are { error: { code, message, metadata } }; for "Provider returned error" the reason is in metadata.raw
    private function errorMessage(Response $response): string
    {
        $raw = $response->json('error.metadata.raw');
        $provider = is_string($raw) ? (json_decode($raw, true)['message'] ?? null) : null;

        return $provider ?: $response->json('error.message') ?: "unexpected response ({$response->status()}).";
    }
}
