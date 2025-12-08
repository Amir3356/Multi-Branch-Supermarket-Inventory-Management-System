<?php

use App\Features\Stock\Services\StockRebuilder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Atomic stock and numbering, for branches where several Cashiers or Inventory Officers work at once:
 * - id_sequences: one locked counter per kind of record, instead of "highest id + 1" (two saves at once got the same id)
 * - stock_batches: each branch's units per batch on the server, taken out with a guarded update in the same transaction
 *   as the sale, transfer or damaged item, so stock can't be used twice. Filled from the existing records.
 */
return new class extends Migration
{
    // Counter name => [table, column, prefix length], each starting after the highest number already used
    private const COUNTERS = [
        'sales' => [['sales', 'id', 3]],
        'stock_transfers' => [['stock_transfers', 'id', 4]],
        'damaged_items' => [['damaged_items', 'id', 4]],
        'expenses' => [['expenses', 'id', 4]],
        'procurements' => [['procurements', 'id', 3]],
        'branches' => [['branches', 'id', 3]],
        'batches' => [['procurements', 'batch', 3], ['stock_transfers', 'received_batch', 3]],
    ];

    public function up(): void
    {
        Schema::create('id_sequences', function (Blueprint $table) {
            $table->string('name', 40)->primary();
            $table->unsignedBigInteger('value');
        });

        foreach (self::COUNTERS as $name => $sources) {
            $highest = 0;
            foreach ($sources as [$table, $column, $prefix]) {
                $highest = max($highest, (int) DB::table($table)->whereNotNull($column)->pluck($column)
                    ->filter(fn ($value) => $column !== 'id' ? str_starts_with($value, 'BT-') : true)
                    ->map(fn ($value) => (int) substr($value, $prefix))->max());
            }
            DB::table('id_sequences')->insert(['name' => $name, 'value' => $highest]);
        }

        Schema::create('stock_batches', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->string('product');
            $table->string('product_key'); // lower-case name: how sales, transfers and damaged items find the product
            $table->string('category');
            $table->string('med_id', 20)->nullable();
            $table->string('batch', 50);
            $table->date('expiry_date')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->integer('units');
            $table->timestamps();
            $table->unique(['branch_id', 'product_key', 'batch']);
        });
        // The database itself refuses stock below zero, whatever the code does
        DB::statement('alter table stock_batches add constraint stock_batches_units_not_negative check (units >= 0)');

        app(StockRebuilder::class)->rebuild();
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_batches');
        Schema::dropIfExists('id_sequences');
    }
};
