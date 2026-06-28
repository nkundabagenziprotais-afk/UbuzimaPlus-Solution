<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Solution;
use Illuminate\Http\JsonResponse;

class SolutionController extends Controller
{
    public function index(): JsonResponse
    {
        $solutions = Solution::query()
            ->select(['id', 'name', 'code', 'description', 'status', 'created_at'])
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $solutions,
        ]);
    }
}
