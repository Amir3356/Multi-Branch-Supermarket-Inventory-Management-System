<?php

namespace App\Features\AccessReviews\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessReview extends Model
{
    protected $fillable = ['period_start', 'period_end', 'period_type', 'scheduled', 'generated_by', 'summary', 'rows', 'reviewed_at', 'reviewed_by', 'review_note'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'scheduled' => 'boolean',
            'summary' => 'array',
            'rows' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
