<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Access reviews are called User Reports in the app now: earlier audit log entries take the new name, so filtering finds them */
return new class extends Migration
{
    private const ACTIONS = [
        'Access review generated' => 'User report generated',
        'Access review regenerated' => 'User report regenerated',
        'Access review deleted' => 'User report deleted',
    ];

    public function up(): void
    {
        DB::table('audit_logs')->where('module', 'Access Reviews')->update(['module' => 'User Report']);
        foreach (self::ACTIONS as $old => $new) {
            DB::table('audit_logs')->where('action', $old)->update(['action' => $new]);
        }
    }

    public function down(): void
    {
        DB::table('audit_logs')->where('module', 'User Report')->update(['module' => 'Access Reviews']);
        foreach (self::ACTIONS as $old => $new) {
            DB::table('audit_logs')->where('action', $new)->update(['action' => $old]);
        }
    }
};
