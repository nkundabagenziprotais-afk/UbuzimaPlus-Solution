<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TENANT_ID = 1;

    private const MARKER =
        'aquila_finance_f3_r3';

    private const RELEASE =
        'F3-R3';

    private const ACCOUNT_BLUEPRINT_SHA =
        'b5799b7a57ca4039df39aff9878c7336ea936d1eca326fd3c33e3a9300ebdfc0';

    private const MAPPING_BLUEPRINT_SHA =
        'e0a51f4cf59a14e4a250dc6c9b6239567e32daf29d40210a74c9ffedc864fa94';

    private const ACCOUNTS_B64 =
        'W3siY29kZSI6IjEwNDAiLCJuYW1lIjoiQ2FzaCBEZXBvc2l0cyBpbiBUcmFuc2l0IiwidHlwZSI6ImFzc2V0Iiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGNl9CQU5LSU5HIn0seyJjb2RlIjoiMTA1MCIsIm5hbWUiOiJQYXltZW50IFNldHRsZW1lbnQgQ2xlYXJpbmciLCJ0eXBlIjoiYXNzZXQiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkY2X0JBTktJTkcifSx7ImNvZGUiOiIxMTIwIiwibmFtZSI6IlN0YWZmIEFkdmFuY2VzICYgUmVjZWl2YWJsZXMiLCJ0eXBlIjoiYXNzZXQiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkY5X1BBWVJPTEwifSx7ImNvZGUiOiIxMTMwIiwibmFtZSI6IlN1cHBsaWVyIEFkdmFuY2VzICYgUHJlcGF5bWVudHMiLCJ0eXBlIjoiYXNzZXQiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkY0X0FQIn0seyJjb2RlIjoiMTE0MCIsIm5hbWUiOiJWQVQgSW5wdXQgUmVjb3ZlcmFibGUiLCJ0eXBlIjoiYXNzZXQiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkY4X1RBWCJ9LHsiY29kZSI6IjExNTAiLCJuYW1lIjoiSW50ZXItYnJhbmNoIFJlY2VpdmFibGUiLCJ0eXBlIjoiYXNzZXQiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkYxMl9CUkFOQ0gifSx7ImNvZGUiOiIxMjEwIiwibmFtZSI6IkludmVudG9yeSBpbiBUcmFuc2l0IiwidHlwZSI6ImFzc2V0Iiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIxIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjEyMDAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJjb2RlIjoiMTMwMCIsIm5hbWUiOiJQcmVwYWlkIEV4cGVuc2VzIiwidHlwZSI6ImFzc2V0Iiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiMTM5MCIsIm5hbWUiOiJGaXhlZCBBc3NldHMiLCJ0eXBlIjoiYXNzZXQiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImNvZGUiOiIxNDAwIiwibmFtZSI6IkZ1cm5pdHVyZSAmIEZpeHR1cmVzIiwidHlwZSI6ImFzc2V0Iiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjEzOTAiLCJwYWNrYWdlIjoiRjExX0ZJWEVEX0FTU0VUUyJ9LHsiY29kZSI6IjE0MTAiLCJuYW1lIjoiUGhhcm1hY3kgJiBNZWRpY2FsIEVxdWlwbWVudCIsInR5cGUiOiJhc3NldCIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIxMzkwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImNvZGUiOiIxNDIwIiwibmFtZSI6IkNvbXB1dGVyICYgUE9TIEVxdWlwbWVudCIsInR5cGUiOiJhc3NldCIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIxMzkwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImNvZGUiOiIxNDMwIiwibmFtZSI6Ik1vdG9yIFZlaGljbGVzIiwidHlwZSI6ImFzc2V0Iiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjEzOTAiLCJwYWNrYWdlIjoiRjExX0ZJWEVEX0FTU0VUUyJ9LHsiY29kZSI6IjE0OTAiLCJuYW1lIjoiQWNjdW11bGF0ZWQgRGVwcmVjaWF0aW9uIiwidHlwZSI6ImFzc2V0Iiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIxMzkwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImNvZGUiOiIyMTEwIiwibmFtZSI6IldpdGhob2xkaW5nIFRheCBQYXlhYmxlIiwidHlwZSI6ImxpYWJpbGl0eSIsIm5vcm1hbF9iYWxhbmNlIjoiY3JlZGl0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkY4X1RBWCJ9LHsiY29kZSI6IjIxMjAiLCJuYW1lIjoiUEFZRSBQYXlhYmxlIiwidHlwZSI6ImxpYWJpbGl0eSIsIm5vcm1hbF9iYWxhbmNlIjoiY3JlZGl0IiwiY29udHJvbCI6IjEiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiIiwicGFja2FnZSI6IkY5X1BBWVJPTEwifSx7ImNvZGUiOiIyMTMwIiwibmFtZSI6IlBlbnNpb24gLyBSU1NCIFBheWFibGUiLCJ0eXBlIjoibGlhYmlsaXR5Iiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMSIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsiY29kZSI6IjIxNDAiLCJuYW1lIjoiTmV0IFNhbGFyaWVzIFBheWFibGUiLCJ0eXBlIjoibGlhYmlsaXR5Iiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMSIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsiY29kZSI6IjIxNTAiLCJuYW1lIjoiT3RoZXIgUGF5cm9sbCBEZWR1Y3Rpb25zIFBheWFibGUiLCJ0eXBlIjoibGlhYmlsaXR5Iiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMSIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsiY29kZSI6IjIyNTAiLCJuYW1lIjoiSW50ZXItYnJhbmNoIFBheWFibGUiLCJ0eXBlIjoibGlhYmlsaXR5Iiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMSIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIiLCJwYWNrYWdlIjoiRjEyX0JSQU5DSCJ9LHsiY29kZSI6IjIzMDAiLCJuYW1lIjoiQ3VzdG9tZXIgRGVwb3NpdHMgJiBBZHZhbmNlcyIsInR5cGUiOiJsaWFiaWxpdHkiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIxIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGNV9BUiJ9LHsiY29kZSI6IjI0MDAiLCJuYW1lIjoiQWNjcnVlZCBFeHBlbnNlcyIsInR5cGUiOiJsaWFiaWxpdHkiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIxIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGNF9BUCJ9LHsiY29kZSI6IjMxMDAiLCJuYW1lIjoiT3duZXIgQ2FwaXRhbCIsInR5cGUiOiJlcXVpdHkiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiMzIwMCIsIm5hbWUiOiJSZXRhaW5lZCBFYXJuaW5ncyIsInR5cGUiOiJlcXVpdHkiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiNDAyMCIsIm5hbWUiOiJSZXRhaWwgU2FsZXMgUmV2ZW51ZSIsInR5cGUiOiJpbmNvbWUiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjQwMDAiLCJwYWNrYWdlIjoiRjNfUkVWRU5VRSJ9LHsiY29kZSI6IjQwMzAiLCJuYW1lIjoiV2hvbGVzYWxlIFNhbGVzIFJldmVudWUiLCJ0eXBlIjoiaW5jb21lIiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI0MDAwIiwicGFja2FnZSI6IkYzX1JFVkVOVUUifSx7ImNvZGUiOiI0MDQwIiwibmFtZSI6Ikluc3VyYW5jZSBTYWxlcyBSZXZlbnVlIiwidHlwZSI6ImluY29tZSIsIm5vcm1hbF9iYWxhbmNlIjoiY3JlZGl0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNDAwMCIsInBhY2thZ2UiOiJGM19SRVZFTlVFIn0seyJjb2RlIjoiNDA1MCIsIm5hbWUiOiJPdGhlciBPcGVyYXRpbmcgUmV2ZW51ZSIsInR5cGUiOiJpbmNvbWUiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjQwMDAiLCJwYWNrYWdlIjoiRjNfUkVWRU5VRSJ9LHsiY29kZSI6IjQwNzAiLCJuYW1lIjoiU2FsZXMgRGlzY291bnRzICYgQWxsb3dhbmNlcyIsInR5cGUiOiJpbmNvbWUiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNDAwMCIsInBhY2thZ2UiOiJGM19SRVZFTlVFIn0seyJjb2RlIjoiNDkwMCIsIm5hbWUiOiJJbnZlbnRvcnkgQWRqdXN0bWVudCBHYWlucyIsInR5cGUiOiJpbmNvbWUiLCJub3JtYWxfYmFsYW5jZSI6ImNyZWRpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IiIsInBhY2thZ2UiOiJGN19JTlZFTlRPUlkifSx7ImNvZGUiOiI0OTEwIiwibmFtZSI6IkZvcmVpZ24gRXhjaGFuZ2UgR2FpbnMiLCJ0eXBlIjoiaW5jb21lIiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIiLCJwYWNrYWdlIjoiRjZfQkFOS0lORyJ9LHsiY29kZSI6IjQ5MjAiLCJuYW1lIjoiQ2FzaCBPdmVyIC8gUm91bmRpbmcgR2FpbnMiLCJ0eXBlIjoiaW5jb21lIiwibm9ybWFsX2JhbGFuY2UiOiJjcmVkaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiIiLCJwYWNrYWdlIjoiRjZfQkFOS0lORyJ9LHsiY29kZSI6IjUwMTAiLCJuYW1lIjoiSW52ZW50b3J5IFNocmlua2FnZSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjUwMDAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJjb2RlIjoiNTAyMCIsIm5hbWUiOiJFeHBpcmVkIFN0b2NrIFdyaXRlLU9mZiIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjUwMDAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJjb2RlIjoiNTAzMCIsIm5hbWUiOiJEYW1hZ2VkIFN0b2NrIFdyaXRlLU9mZiIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjUwMDAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJjb2RlIjoiNTA0MCIsIm5hbWUiOiJJbnZlbnRvcnkgQWRqdXN0bWVudCBMb3NzIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNTAwMCIsInBhY2thZ2UiOiJGN19JTlZFTlRPUlkifSx7ImNvZGUiOiI1MDUwIiwibmFtZSI6IlB1cmNoYXNlIFByaWNlIFZhcmlhbmNlIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNTAwMCIsInBhY2thZ2UiOiJGNF9BUCJ9LHsiY29kZSI6IjYwMTAiLCJuYW1lIjoiU2FsYXJpZXMgJiBXYWdlcyIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsiY29kZSI6IjYwMjAiLCJuYW1lIjoiRW1wbG95ZXIgUGVuc2lvbiAvIFJTU0IgRXhwZW5zZSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsiY29kZSI6IjYwMzAiLCJuYW1lIjoiU3RhZmYgQmVuZWZpdHMiLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkY5X1BBWVJPTEwifSx7ImNvZGUiOiI2MDQwIiwibmFtZSI6IlJlbnQgRXhwZW5zZSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjNfQ09SRSJ9LHsiY29kZSI6IjYwNTAiLCJuYW1lIjoiVXRpbGl0aWVzIEV4cGVuc2UiLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImNvZGUiOiI2MDYwIiwibmFtZSI6IkJhbmsgQ2hhcmdlcyIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjZfQkFOS0lORyJ9LHsiY29kZSI6IjYwNzAiLCJuYW1lIjoiQ2FyZCBQcm9jZXNzaW5nIEZlZXMiLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkY2X0JBTktJTkcifSx7ImNvZGUiOiI2MDgwIiwibmFtZSI6Ik1vYmlsZSBNb25leSBGZWVzIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNjAwMCIsInBhY2thZ2UiOiJGNl9CQU5LSU5HIn0seyJjb2RlIjoiNjA5MCIsIm5hbWUiOiJJbnRlcm5ldCAmIENvbW11bmljYXRpb25zIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNjAwMCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiNjExMCIsIm5hbWUiOiJTdXBwbGllcyAmIENvbnN1bWFibGVzIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNjAwMCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiNjEyMCIsIm5hbWUiOiJUcmFuc3BvcnQgJiBEZWxpdmVyeSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjNfQ09SRSJ9LHsiY29kZSI6IjYxMzAiLCJuYW1lIjoiUHJvZmVzc2lvbmFsIEZlZXMiLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImNvZGUiOiI2MTQwIiwibmFtZSI6IlJlcGFpcnMgJiBNYWludGVuYW5jZSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjNfQ09SRSJ9LHsiY29kZSI6IjYxNTAiLCJuYW1lIjoiTGljZW5jZXMgJiBTdWJzY3JpcHRpb25zIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNjAwMCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiNjE2MCIsIm5hbWUiOiJNYXJrZXRpbmcgJiBQcm9tb3Rpb24iLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImNvZGUiOiI2MTcwIiwibmFtZSI6IlNlY3VyaXR5IEV4cGVuc2UiLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImNvZGUiOiI2MTgwIiwibmFtZSI6IkJ1c2luZXNzIEluc3VyYW5jZSBFeHBlbnNlIiwidHlwZSI6ImV4cGVuc2UiLCJub3JtYWxfYmFsYW5jZSI6ImRlYml0IiwiY29udHJvbCI6IjAiLCJjYXNoX2JhbmsiOiIwIiwicGFyZW50IjoiNjAwMCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJjb2RlIjoiNjE5MCIsIm5hbWUiOiJEZXByZWNpYXRpb24gRXhwZW5zZSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjExX0ZJWEVEX0FTU0VUUyJ9LHsiY29kZSI6IjYyMDAiLCJuYW1lIjoiQmFkIERlYnQgRXhwZW5zZSIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjVfQVIifSx7ImNvZGUiOiI2MjEwIiwibmFtZSI6IkZvcmVpZ24gRXhjaGFuZ2UgTG9zcyIsInR5cGUiOiJleHBlbnNlIiwibm9ybWFsX2JhbGFuY2UiOiJkZWJpdCIsImNvbnRyb2wiOiIwIiwiY2FzaF9iYW5rIjoiMCIsInBhcmVudCI6IjYwMDAiLCJwYWNrYWdlIjoiRjZfQkFOS0lORyJ9LHsiY29kZSI6IjYyMjAiLCJuYW1lIjoiQ2FzaCBTaG9ydCAvIFRpbGwgVmFyaWFuY2UiLCJ0eXBlIjoiZXhwZW5zZSIsIm5vcm1hbF9iYWxhbmNlIjoiZGViaXQiLCJjb250cm9sIjoiMCIsImNhc2hfYmFuayI6IjAiLCJwYXJlbnQiOiI2MDAwIiwicGFja2FnZSI6IkY2X0JBTktJTkcifV0=';

    private const MAPPINGS_B64 =
        'W3sia2V5IjoiYmFuay5kZXBvc2l0X2luX3RyYW5zaXQiLCJjb2RlIjoiMTA0MCIsInBhY2thZ2UiOiJGNl9CQU5LSU5HIn0seyJrZXkiOiJwYXltZW50cy5zZXR0bGVtZW50X2NsZWFyaW5nIiwiY29kZSI6IjEwNTAiLCJwYWNrYWdlIjoiRjZfQkFOS0lORyJ9LHsia2V5IjoiZW1wbG95ZWUuYWR2YW5jZV9yZWNlaXZhYmxlIiwiY29kZSI6IjExMjAiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsia2V5Ijoic3VwcGxpZXIuYWR2YW5jZSIsImNvZGUiOiIxMTMwIiwicGFja2FnZSI6IkY0X0FQIn0seyJrZXkiOiJ0YXgudmF0X2lucHV0IiwiY29kZSI6IjExNDAiLCJwYWNrYWdlIjoiRjhfVEFYIn0seyJrZXkiOiJicmFuY2guZHVlX2Zyb20iLCJjb2RlIjoiMTE1MCIsInBhY2thZ2UiOiJGMTJfQlJBTkNIIn0seyJrZXkiOiJpbnZlbnRvcnkuaW5fdHJhbnNpdCIsImNvZGUiOiIxMjEwIiwicGFja2FnZSI6IkY3X0lOVkVOVE9SWSJ9LHsia2V5IjoiZXhwZW5zZXMucHJlcGFpZCIsImNvZGUiOiIxMzAwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImtleSI6ImZpeGVkX2Fzc2V0LmZ1cm5pdHVyZSIsImNvZGUiOiIxNDAwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImtleSI6ImZpeGVkX2Fzc2V0LnBoYXJtYWN5X2VxdWlwbWVudCIsImNvZGUiOiIxNDEwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImtleSI6ImZpeGVkX2Fzc2V0LmNvbXB1dGVyX3BvcyIsImNvZGUiOiIxNDIwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImtleSI6ImZpeGVkX2Fzc2V0LnZlaGljbGUiLCJjb2RlIjoiMTQzMCIsInBhY2thZ2UiOiJGMTFfRklYRURfQVNTRVRTIn0seyJrZXkiOiJmaXhlZF9hc3NldC5hY2N1bXVsYXRlZF9kZXByZWNpYXRpb24iLCJjb2RlIjoiMTQ5MCIsInBhY2thZ2UiOiJGMTFfRklYRURfQVNTRVRTIn0seyJrZXkiOiJ0YXgud2l0aGhvbGRpbmdfcGF5YWJsZSIsImNvZGUiOiIyMTEwIiwicGFja2FnZSI6IkY4X1RBWCJ9LHsia2V5IjoicGF5cm9sbC5wYXllX3BheWFibGUiLCJjb2RlIjoiMjEyMCIsInBhY2thZ2UiOiJGOV9QQVlST0xMIn0seyJrZXkiOiJwYXlyb2xsLnBlbnNpb25fcGF5YWJsZSIsImNvZGUiOiIyMTMwIiwicGFja2FnZSI6IkY5X1BBWVJPTEwifSx7ImtleSI6InBheXJvbGwubmV0X3BheWFibGUiLCJjb2RlIjoiMjE0MCIsInBhY2thZ2UiOiJGOV9QQVlST0xMIn0seyJrZXkiOiJwYXlyb2xsLm90aGVyX2RlZHVjdGlvbnNfcGF5YWJsZSIsImNvZGUiOiIyMTUwIiwicGFja2FnZSI6IkY5X1BBWVJPTEwifSx7ImtleSI6ImJyYW5jaC5kdWVfdG8iLCJjb2RlIjoiMjI1MCIsInBhY2thZ2UiOiJGMTJfQlJBTkNIIn0seyJrZXkiOiJjdXN0b21lci5kZXBvc2l0IiwiY29kZSI6IjIzMDAiLCJwYWNrYWdlIjoiRjVfQVIifSx7ImtleSI6ImV4cGVuc2VzLmFjY3J1ZWRfcGF5YWJsZSIsImNvZGUiOiIyNDAwIiwicGFja2FnZSI6IkY0X0FQIn0seyJrZXkiOiJlcXVpdHkub3duZXJfY2FwaXRhbCIsImNvZGUiOiIzMTAwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImtleSI6InNhbGVzLnJldGFpbF9yZXZlbnVlIiwiY29kZSI6IjQwMjAiLCJwYWNrYWdlIjoiRjNfUkVWRU5VRSJ9LHsia2V5Ijoic2FsZXMud2hvbGVzYWxlX3JldmVudWUiLCJjb2RlIjoiNDAzMCIsInBhY2thZ2UiOiJGM19SRVZFTlVFIn0seyJrZXkiOiJzYWxlcy5pbnN1cmFuY2VfcmV2ZW51ZSIsImNvZGUiOiI0MDQwIiwicGFja2FnZSI6IkYzX1JFVkVOVUUifSx7ImtleSI6InNhbGVzLm90aGVyX3JldmVudWUiLCJjb2RlIjoiNDA1MCIsInBhY2thZ2UiOiJGM19SRVZFTlVFIn0seyJrZXkiOiJzYWxlcy5kaXNjb3VudCIsImNvZGUiOiI0MDcwIiwicGFja2FnZSI6IkYzX1JFVkVOVUUifSx7ImtleSI6ImludmVudG9yeS5hZGp1c3RtZW50X2dhaW4iLCJjb2RlIjoiNDkwMCIsInBhY2thZ2UiOiJGN19JTlZFTlRPUlkifSx7ImtleSI6ImZ4LmdhaW4iLCJjb2RlIjoiNDkxMCIsInBhY2thZ2UiOiJGNl9CQU5LSU5HIn0seyJrZXkiOiJjYXNoLm92ZXJhZ2UiLCJjb2RlIjoiNDkyMCIsInBhY2thZ2UiOiJGNl9CQU5LSU5HIn0seyJrZXkiOiJpbnZlbnRvcnkuc2hyaW5rYWdlIiwiY29kZSI6IjUwMTAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJrZXkiOiJpbnZlbnRvcnkuZXhwaXJ5X3dyaXRlb2ZmIiwiY29kZSI6IjUwMjAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJrZXkiOiJpbnZlbnRvcnkuZGFtYWdlX3dyaXRlb2ZmIiwiY29kZSI6IjUwMzAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJrZXkiOiJpbnZlbnRvcnkuYWRqdXN0bWVudF9sb3NzIiwiY29kZSI6IjUwNDAiLCJwYWNrYWdlIjoiRjdfSU5WRU5UT1JZIn0seyJrZXkiOiJpbnZlbnRvcnkucHVyY2hhc2VfcHJpY2VfdmFyaWFuY2UiLCJjb2RlIjoiNTA1MCIsInBhY2thZ2UiOiJGNF9BUCJ9LHsia2V5IjoicGF5cm9sbC5zYWxhcnlfZXhwZW5zZSIsImNvZGUiOiI2MDEwIiwicGFja2FnZSI6IkY5X1BBWVJPTEwifSx7ImtleSI6InBheXJvbGwuZW1wbG95ZXJfcGVuc2lvbl9leHBlbnNlIiwiY29kZSI6IjYwMjAiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsia2V5IjoicGF5cm9sbC5zdGFmZl9iZW5lZml0c19leHBlbnNlIiwiY29kZSI6IjYwMzAiLCJwYWNrYWdlIjoiRjlfUEFZUk9MTCJ9LHsia2V5IjoiZXhwZW5zZXMucmVudCIsImNvZGUiOiI2MDQwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImtleSI6ImV4cGVuc2VzLnV0aWxpdGllcyIsImNvZGUiOiI2MDUwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImtleSI6ImJhbmsuZmVlcyIsImNvZGUiOiI2MDYwIiwicGFja2FnZSI6IkY2X0JBTktJTkcifSx7ImtleSI6ImNhcmQuZmVlcyIsImNvZGUiOiI2MDcwIiwicGFja2FnZSI6IkY2X0JBTktJTkcifSx7ImtleSI6Im1vbW8uZmVlcyIsImNvZGUiOiI2MDgwIiwicGFja2FnZSI6IkY2X0JBTktJTkcifSx7ImtleSI6ImV4cGVuc2VzLmludGVybmV0X2NvbW11bmljYXRpb25zIiwiY29kZSI6IjYwOTAiLCJwYWNrYWdlIjoiRjNfQ09SRSJ9LHsia2V5IjoiZXhwZW5zZXMuc3VwcGxpZXNfY29uc3VtYWJsZXMiLCJjb2RlIjoiNjExMCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJrZXkiOiJleHBlbnNlcy50cmFuc3BvcnRfZGVsaXZlcnkiLCJjb2RlIjoiNjEyMCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJrZXkiOiJleHBlbnNlcy5wcm9mZXNzaW9uYWxfZmVlcyIsImNvZGUiOiI2MTMwIiwicGFja2FnZSI6IkYzX0NPUkUifSx7ImtleSI6ImV4cGVuc2VzLnJlcGFpcnNfbWFpbnRlbmFuY2UiLCJjb2RlIjoiNjE0MCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJrZXkiOiJleHBlbnNlcy5saWNlbnNlc19zdWJzY3JpcHRpb25zIiwiY29kZSI6IjYxNTAiLCJwYWNrYWdlIjoiRjNfQ09SRSJ9LHsia2V5IjoiZXhwZW5zZXMubWFya2V0aW5nIiwiY29kZSI6IjYxNjAiLCJwYWNrYWdlIjoiRjNfQ09SRSJ9LHsia2V5IjoiZXhwZW5zZXMuc2VjdXJpdHkiLCJjb2RlIjoiNjE3MCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJrZXkiOiJleHBlbnNlcy5idXNpbmVzc19pbnN1cmFuY2UiLCJjb2RlIjoiNjE4MCIsInBhY2thZ2UiOiJGM19DT1JFIn0seyJrZXkiOiJmaXhlZF9hc3NldC5kZXByZWNpYXRpb25fZXhwZW5zZSIsImNvZGUiOiI2MTkwIiwicGFja2FnZSI6IkYxMV9GSVhFRF9BU1NFVFMifSx7ImtleSI6ImFyLmJhZF9kZWJ0X2V4cGVuc2UiLCJjb2RlIjoiNjIwMCIsInBhY2thZ2UiOiJGNV9BUiJ9LHsia2V5IjoiZngubG9zcyIsImNvZGUiOiI2MjEwIiwicGFja2FnZSI6IkY2X0JBTktJTkcifSx7ImtleSI6ImNhc2guc2hvcnRhZ2UiLCJjb2RlIjoiNjIyMCIsInBhY2thZ2UiOiJGNl9CQU5LSU5HIn1d';


    public function up(): void
    {
        $this->assertRequiredSchema();

        $accounts =
            $this->accounts();

        $mappings =
            $this->mappings();

        DB::transaction(
            function () use (
                $accounts,
                $mappings
            ): void {
                $this->assertExistingContract();

                $proposedCodes =
                    array_column(
                        $accounts,
                        'code'
                    );

                $proposedKeys =
                    array_column(
                        $mappings,
                        'key'
                    );

                if (
                    DB::table(
                        'finance_chart_of_accounts'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->whereIn(
                            'code',
                            $proposedCodes
                        )
                        ->exists()
                ) {
                    throw new RuntimeException(
                        'F3-R3 proposed account collision.'
                    );
                }

                if (
                    DB::table(
                        'finance_account_mappings'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->whereIn(
                            'mapping_key',
                            $proposedKeys
                        )
                        ->exists()
                ) {
                    throw new RuntimeException(
                        'F3-R3 proposed mapping collision.'
                    );
                }

                $now =
                    now();

                $pending =
                    $accounts;

                while (
                    count(
                        $pending
                    ) > 0
                ) {
                    $progress =
                        false;

                    foreach (
                        $pending
                        as
                        $index => $account
                    ) {
                        $parentCode =
                            trim(
                                (string)
                                    $account[
                                        'parent'
                                    ]
                            );

                        $parentId =
                            null;

                        if (
                            $parentCode
                            !==
                            ''
                        ) {
                            $parentId =
                                DB::table(
                                    'finance_chart_of_accounts'
                                )
                                    ->where(
                                        'tenant_id',
                                        self::TENANT_ID
                                    )
                                    ->where(
                                        'code',
                                        $parentCode
                                    )
                                    ->value(
                                        'id'
                                    );

                            if (
                                ! $parentId
                            ) {
                                continue;
                            }
                        }

                        DB::table(
                            'finance_chart_of_accounts'
                        )->insert([
                            'tenant_id'
                                => self::TENANT_ID,

                            'parent_id'
                                => $parentId,

                            'code'
                                => $account[
                                    'code'
                                ],

                            'name'
                                => $account[
                                    'name'
                                ],

                            'account_type'
                                => $account[
                                    'type'
                                ],

                            'normal_balance'
                                => $account[
                                    'normal_balance'
                                ],

                            'currency_code'
                                => 'RWF',

                            'is_control_account'
                                => (
                                    (string)
                                        $account[
                                            'control'
                                        ]
                                    ===
                                    '1'
                                ),

                            'is_cash_or_bank'
                                => (
                                    (string)
                                        $account[
                                            'cash_bank'
                                        ]
                                    ===
                                    '1'
                                ),

                            'is_active'
                                => true,

                            'metadata'
                                => $this->metadata(
                                    'chart_of_account',
                                    (string)
                                        $account[
                                            'package'
                                        ]
                                ),

                            'created_at'
                                => $now,

                            'updated_at'
                                => $now,
                        ]);

                        unset(
                            $pending[
                                $index
                            ]
                        );

                        $progress =
                            true;
                    }

                    if (
                        ! $progress
                    ) {
                        throw new RuntimeException(
                            'F3-R3 account parent dependency could not be resolved.'
                        );
                    }
                }

                foreach (
                    $mappings
                    as
                    $mapping
                ) {
                    $accountId =
                        DB::table(
                            'finance_chart_of_accounts'
                        )
                            ->where(
                                'tenant_id',
                                self::TENANT_ID
                            )
                            ->where(
                                'code',
                                $mapping[
                                    'code'
                                ]
                            )
                            ->value(
                                'id'
                            );

                    if (
                        ! $accountId
                    ) {
                        throw new RuntimeException(
                            'F3-R3 mapping account target is missing: '
                            .
                            $mapping[
                                'key'
                            ]
                        );
                    }

                    DB::table(
                        'finance_account_mappings'
                    )->insert([
                        'tenant_id'
                            => self::TENANT_ID,

                        'branch_id'
                            => null,

                        'mapping_key'
                            => $mapping[
                                'key'
                            ],

                        'finance_chart_of_account_id'
                            => $accountId,

                        'source_module'
                            => null,

                        'source_type'
                            => null,

                        'payment_method'
                            => null,

                        'currency_code'
                            => 'RWF',

                        'is_default'
                            => true,

                        'is_active'
                            => true,

                        'metadata'
                            => $this->metadata(
                                'account_mapping',
                                (string)
                                    $mapping[
                                        'package'
                                    ]
                            ),

                        'created_at'
                            => $now,

                        'updated_at'
                            => $now,
                    ]);
                }

                $accountCount =
                    DB::table(
                        'finance_chart_of_accounts'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->count();

                $mappingCount =
                    DB::table(
                        'finance_account_mappings'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->count();

                if (
                    (int)
                        $accountCount
                    !==
                    75
                ) {
                    throw new RuntimeException(
                        'F3-R3 final account count is not 75.'
                    );
                }

                if (
                    (int)
                        $mappingCount
                    !==
                    74
                ) {
                    throw new RuntimeException(
                        'F3-R3 final mapping count is not 74.'
                    );
                }
            }
        );
    }


    public function down(): void
    {
        $this->assertRequiredSchema();

        $accounts =
            $this->accounts();

        $mappings =
            $this->mappings();

        DB::transaction(
            function () use (
                $accounts,
                $mappings
            ): void {
                $codes =
                    array_column(
                        $accounts,
                        'code'
                    );

                $keys =
                    array_column(
                        $mappings,
                        'key'
                    );

                $accountRows =
                    DB::table(
                        'finance_chart_of_accounts'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->whereIn(
                            'code',
                            $codes
                        )
                        ->get([
                            'id',
                            'code',
                            'metadata',
                        ]);

                if (
                    $accountRows
                        ->count()
                    !==
                    58
                ) {
                    throw new RuntimeException(
                        'F3-R3 rollback refused: expected 58 managed accounts.'
                    );
                }

                $ids =
                    [];

                foreach (
                    $accountRows
                    as
                    $row
                ) {
                    $metadata =
                        json_decode(
                            (string)
                                (
                                    $row
                                        ->metadata
                                    ??
                                    '{}'
                                ),
                            true,
                            512,
                            JSON_THROW_ON_ERROR
                        );

                    if (
                        (
                            $metadata[
                                'f3_marker'
                            ]
                            ??
                            null
                        )
                        !==
                        self::MARKER
                    ) {
                        throw new RuntimeException(
                            'F3-R3 rollback refused: managed account metadata changed.'
                        );
                    }

                    $ids[] =
                        (int)
                            $row
                                ->id;
                }

                $mappingRows =
                    DB::table(
                        'finance_account_mappings as mappings'
                    )
                        ->join(
                            'finance_chart_of_accounts as accounts',
                            'accounts.id',
                            '=',
                            'mappings.finance_chart_of_account_id'
                        )
                        ->where(
                            'mappings.tenant_id',
                            self::TENANT_ID
                        )
                        ->whereNull(
                            'mappings.branch_id'
                        )
                        ->where(
                            'mappings.currency_code',
                            'RWF'
                        )
                        ->whereIn(
                            'mappings.mapping_key',
                            $keys
                        )
                        ->get([
                            'mappings.id',
                            'mappings.mapping_key',
                            'mappings.metadata',
                            'accounts.code as account_code',
                        ]);

                if (
                    $mappingRows
                        ->count()
                    !==
                    56
                ) {
                    throw new RuntimeException(
                        'F3-R3 rollback refused: expected 56 managed mappings.'
                    );
                }

                $expectedTargets =
                    [];

                foreach (
                    $mappings
                    as
                    $mapping
                ) {
                    $expectedTargets[
                        $mapping[
                            'key'
                        ]
                    ] =
                        $mapping[
                            'code'
                        ];
                }

                foreach (
                    $mappingRows
                    as
                    $row
                ) {
                    if (
                        (
                            $expectedTargets[
                                $row
                                    ->mapping_key
                            ]
                            ??
                            null
                        )
                        !==
                        $row
                            ->account_code
                    ) {
                        throw new RuntimeException(
                            'F3-R3 rollback refused: managed mapping target changed.'
                        );
                    }

                    $metadata =
                        json_decode(
                            (string)
                                (
                                    $row
                                        ->metadata
                                    ??
                                    '{}'
                                ),
                            true,
                            512,
                            JSON_THROW_ON_ERROR
                        );

                    if (
                        (
                            $metadata[
                                'f3_marker'
                            ]
                            ??
                            null
                        )
                        !==
                        self::MARKER
                    ) {
                        throw new RuntimeException(
                            'F3-R3 rollback refused: managed mapping metadata changed.'
                        );
                    }
                }

                $targetMappingCount =
                    DB::table(
                        'finance_account_mappings'
                    )
                        ->whereIn(
                            'finance_chart_of_account_id',
                            $ids
                        )
                        ->count();

                if (
                    (int)
                        $targetMappingCount
                    !==
                    56
                ) {
                    throw new RuntimeException(
                        'F3-R3 rollback refused: later mappings reference F3 accounts.'
                    );
                }

                foreach ([
                    [
                        'finance_journal_lines',
                        'chart_of_account_id',
                    ],
                    [
                        'finance_expense_lines',
                        'finance_chart_of_account_id',
                    ],
                    [
                        'finance_journal_draft_lines',
                        'finance_chart_of_account_id',
                    ],
                ] as $reference) {
                    [
                        $table,
                        $column
                    ] =
                        $reference;

                    if (
                        ! Schema::hasTable(
                            $table
                        )
                        ||
                        ! Schema::hasColumn(
                            $table,
                            $column
                        )
                    ) {
                        continue;
                    }

                    $count =
                        DB::table(
                            $table
                        )
                            ->whereIn(
                                $column,
                                $ids
                            )
                            ->count();

                    if (
                        (int)
                            $count
                        >
                        0
                    ) {
                        throw new RuntimeException(
                            "F3-R3 rollback refused: {$table} now references F3 accounts."
                        );
                    }
                }

                $externalChildren =
                    DB::table(
                        'finance_chart_of_accounts'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->whereIn(
                            'parent_id',
                            $ids
                        )
                        ->whereNotIn(
                            'code',
                            $codes
                        )
                        ->count();

                if (
                    (int)
                        $externalChildren
                    >
                    0
                ) {
                    throw new RuntimeException(
                        'F3-R3 rollback refused: later accounts depend on the F3 hierarchy.'
                    );
                }

                $deletedMappings =
                    DB::table(
                        'finance_account_mappings'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->whereNull(
                            'branch_id'
                        )
                        ->where(
                            'currency_code',
                            'RWF'
                        )
                        ->whereIn(
                            'mapping_key',
                            $keys
                        )
                        ->delete();

                if (
                    (int)
                        $deletedMappings
                    !==
                    56
                ) {
                    throw new RuntimeException(
                        'F3-R3 rollback mapping deletion count mismatch.'
                    );
                }

                $deletedAccounts =
                    DB::table(
                        'finance_chart_of_accounts'
                    )
                        ->where(
                            'tenant_id',
                            self::TENANT_ID
                        )
                        ->whereIn(
                            'code',
                            $codes
                        )
                        ->delete();

                if (
                    (int)
                        $deletedAccounts
                    !==
                    58
                ) {
                    throw new RuntimeException(
                        'F3-R3 rollback account deletion count mismatch.'
                    );
                }

                $this->assertExistingContract();
            }
        );
    }


    private function assertRequiredSchema(): void
    {
        foreach ([
            'finance_chart_of_accounts',
            'finance_account_mappings',
            'finance_journal_entries',
            'finance_journal_lines',
        ] as $table) {
            if (
                ! Schema::hasTable(
                    $table
                )
            ) {
                throw new RuntimeException(
                    "F3-R3 required table is missing: {$table}"
                );
            }
        }

        foreach ([
            'tenant_id',
            'parent_id',
            'code',
            'name',
            'account_type',
            'normal_balance',
            'currency_code',
            'is_control_account',
            'is_cash_or_bank',
            'is_active',
            'metadata',
            'created_at',
            'updated_at',
        ] as $column) {
            if (
                ! Schema::hasColumn(
                    'finance_chart_of_accounts',
                    $column
                )
            ) {
                throw new RuntimeException(
                    "F3-R3 COA column missing: {$column}"
                );
            }
        }

        foreach ([
            'tenant_id',
            'branch_id',
            'mapping_key',
            'finance_chart_of_account_id',
            'source_module',
            'source_type',
            'payment_method',
            'currency_code',
            'is_default',
            'is_active',
            'metadata',
            'created_at',
            'updated_at',
        ] as $column) {
            if (
                ! Schema::hasColumn(
                    'finance_account_mappings',
                    $column
                )
            ) {
                throw new RuntimeException(
                    "F3-R3 mapping column missing: {$column}"
                );
            }
        }
    }


    private function assertExistingContract(): void
    {
        $accountCount =
            DB::table(
                'finance_chart_of_accounts'
            )
                ->where(
                    'tenant_id',
                    self::TENANT_ID
                )
                ->count();

        $mappingCount =
            DB::table(
                'finance_account_mappings'
            )
                ->where(
                    'tenant_id',
                    self::TENANT_ID
                )
                ->count();

        if (
            (int)
                $accountCount
            !==
            17
        ) {
            throw new RuntimeException(
                'F3-R3 existing account count contract failed.'
            );
        }

        if (
            (int)
                $mappingCount
            !==
            18
        ) {
            throw new RuntimeException(
                'F3-R3 existing mapping count contract failed.'
            );
        }

        foreach (
            $this->legacyAccountIds()
            as
            $code => $id
        ) {
            $actualId =
                DB::table(
                    'finance_chart_of_accounts'
                )
                    ->where(
                        'tenant_id',
                        self::TENANT_ID
                    )
                    ->where(
                        'code',
                        $code
                    )
                    ->value(
                        'id'
                    );

            if (
                (int)
                    $actualId
                !==
                $id
            ) {
                throw new RuntimeException(
                    "F3-R3 historical account ID contract changed for {$code}."
                );
            }
        }

        $actual =
            [];

        $rows =
            DB::table(
                'finance_account_mappings as mappings'
            )
                ->join(
                    'finance_chart_of_accounts as accounts',
                    'accounts.id',
                    '=',
                    'mappings.finance_chart_of_account_id'
                )
                ->where(
                    'mappings.tenant_id',
                    self::TENANT_ID
                )
                ->get([
                    'mappings.mapping_key',
                    'accounts.code',
                ]);

        foreach (
            $rows
            as
            $row
        ) {
            $actual[
                (string)
                    $row
                        ->mapping_key
            ] =
                (string)
                    $row
                        ->code;
        }

        $expected =
            $this->legacyMappings();

        ksort(
            $actual
        );

        ksort(
            $expected
        );

        if (
            $actual
            !==
            $expected
        ) {
            throw new RuntimeException(
                'F3-R3 historical mapping contract changed.'
            );
        }
    }


    private function metadata(
        string $recordKind,
        string $package
    ): string {
        return json_encode(
            [
                'f3_marker'
                    => self::MARKER,

                'f3_release'
                    => self::RELEASE,

                'record_kind'
                    => $recordKind,

                'package'
                    => $package,

                'account_blueprint_sha256'
                    => self::ACCOUNT_BLUEPRINT_SHA,

                'mapping_blueprint_sha256'
                    => self::MAPPING_BLUEPRINT_SHA,
            ],
            JSON_UNESCAPED_SLASHES
            |
            JSON_UNESCAPED_UNICODE
            |
            JSON_THROW_ON_ERROR
        );
    }


    private function accounts(): array
    {
        return $this->decode(
            self::ACCOUNTS_B64
        );
    }


    private function mappings(): array
    {
        return $this->decode(
            self::MAPPINGS_B64
        );
    }


    private function decode(
        string $payload
    ): array {
        $decoded =
            base64_decode(
                $payload,
                true
            );

        if (
            $decoded
            ===
            false
        ) {
            throw new RuntimeException(
                'F3-R3 embedded blueprint decoding failed.'
            );
        }

        $result =
            json_decode(
                $decoded,
                true,
                512,
                JSON_THROW_ON_ERROR
            );

        if (
            ! is_array(
                $result
            )
        ) {
            throw new RuntimeException(
                'F3-R3 embedded blueprint is invalid.'
            );
        }

        return $result;
    }


    private function legacyAccountIds(): array
    {
        return [
            '1000' => 1,
            '1010' => 2,
            '1020' => 3,
            '1030' => 4,
            '1100' => 5,
            '1110' => 6,
            '1200' => 7,
            '2000' => 8,
            '2100' => 9,
            '2200' => 10,
            '3000' => 17,
            '4000' => 11,
            '4010' => 12,
            '5000' => 13,
            '6000' => 14,
            '6100' => 15,
            '7000' => 16,
        ];
    }


    private function legacyMappings(): array
    {
        return [
            'pos.cash' => '1000',
            'pos.bank' => '1010',
            'pos.card' => '1020',
            'pos.momo' => '1030',
            'pos.credit' => '1100',
            'pos.insurance' => '1110',
            'sales.revenue' => '4000',
            'sales.returns' => '4010',
            'sales.tax' => '2100',
            'inventory.asset' => '1200',
            'inventory.receipt_clearing' => '2200',
            'inventory.cogs' => '5000',
            'supplier.ap' => '2000',
            'supplier.expense' => '6100',
            'expenses.operating' => '6000',
            'insurance.receivable' => '1110',
            'insurance.writeoff' => '7000',
            'equity.opening' => '3000',
        ];
    }
};
