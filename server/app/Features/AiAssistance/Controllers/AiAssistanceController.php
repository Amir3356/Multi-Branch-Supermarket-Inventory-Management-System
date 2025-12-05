<?php

namespace App\Features\AiAssistance\Controllers;

use App\Features\AiAssistance\Services\RecommendationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// AI Assistance: recommendations and questions for the signed-in user's role, from the data that role can see
class AiAssistanceController
{
    public function __construct(private RecommendationEngine $engine) {}

    public function recommendations(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->engine->recommendations($request->user(), $request->boolean('refresh'))]);
    }

    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:20'],
            'messages.*.role' => ['required', 'string', 'in:user,assistant'],
            'messages.*.content' => ['required', 'string', 'max:2000'],
        ], ['messages.*.content.max' => 'Keep each message under 2000 characters.']);

        $messages = array_map(fn ($m) => ['role' => $m['role'], 'content' => $m['content']], $data['messages']);
        if (end($messages)['role'] !== 'user') {
            abort(422, 'The last message must be your question.');
        }

        return response()->json(['data' => ['reply' => $this->engine->chat($request->user(), $messages)]]);
    }
}
