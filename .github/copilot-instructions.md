# Copilot / AI agent instructions — PhotoOverhaul

Purpose: give an AI coding agent the minimal, actionable knowledge to be productive in this small Python repo.

- **Quick environment (Windows)**
  - Create venv and install runtime deps:
    ```powershell
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install pillow pillow-heif extcolors numpy
    ```

- **How the project is run**
  - CLI HEIC converter: run `main.py` with a directory argument:
    - `python main.py C:\path\to\heics -q 90 -w 4`
    - `main.convert_heic_to_jpg(heic_dir, output_quality, max_workers)` is the conversion entry point.
  - GUI organizer: run `photoOrganizer.py` to open a Tkinter interface (it calls `openPhotoOrganizerGUI()` on module run).
    - `python photoOrganizer.py` launches the GUI.
  - Misc scripts: `squareUp.py` and `group.py` execute top-level work when run (they loop immediately).

- **Big-picture architecture & responsibilities**
  - `main.py`: conversion engine. Converts HEIC → JPG using `pillow_heif` (calls `register_heif_opener()`), uses `ThreadPoolExecutor` for parallel conversion and basic progress printing.
  - `photoOrganizer.py`: Tkinter GUI + orchestration. Reads EXIF (tag 306) to derive dates, composes target paths (uses `dateSorted` template), and calls `main.convert_heic_to_jpg()` inside `convertHEICtoJPEG()`.
  - `squareUp.py`: image padding utility (pads images to square) and writes outputs to a hard-coded folder.
  - `group.py`: small dedupe / date-sorting helper that copies files into date buckets.

- **Important codebase patterns and gotchas (do not change lightly)**
  - Many modules have top-level side effects and immediately-run code (e.g., `openPhotoOrganizerGUI()` at the bottom of `photoOrganizer.py`, and loops at the bottom of `squareUp.py` and `group.py`). Prefer running files as scripts for testing instead of importing them.
  - Hard-coded Windows paths are used throughout (e.g., `saveDir`, `dateSorted`, output dirs). If changing paths, update all occurrences.
  - Global state: `photoOrganizer.py` relies heavily on globals (`filePathsToWorkWith`, `chosenFolder`, etc.). Refactors should preserve behavior or be explicit about changing run-time semantics.
  - Date extraction: code expects EXIF tag `306` (DateTime) and converts `YYYY:MM:DD` → `YYYY_MM_DD`; many file-naming operations depend on this exact format.
  - `dateSorted` uses a replace-style placeholder (`'...\SortedByDate\{}'`); callers replace `{}` with the year.
  - Error handling is minimal; functions often print instead of raising. Tests and small changes should be conservative and preserve print/log behavior unless standardizing logging.

- **Integration points / dependencies**
  - pillow-heif (`pillow-heif` package, imported as `pillow_heif`) — required for HEIC support; `register_heif_opener()` is called in `main.py` and at import in `photoOrganizer.py`.
  - PIL / Pillow for image I/O and EXIF.
  - `extcolors`, `numpy` are used by image utilities (`squareUp.py`, color extraction in `photoOrganizer.py`).
  - UI: `tkinter` is used for the GUI; interactive behavior is implemented directly in `photoOrganizer.py`.

- **Development guidance for AI agents**
  - When adding or changing behavior, run the targeted script directly to verify (e.g., run `python main.py ...` or `python photoOrganizer.py`) because importing modules may execute UI or work loops.
  - Preserve Windows path semantics in quick fixes; if converting to cross-platform paths, update all hard-coded strings and test on Windows.
  - Keep thread-safety in mind for `main.py`'s `ThreadPoolExecutor` and avoid introducing shared mutable state without synchronization.
  - Small improvements (clarifying variable names, adding logging, wrapping top-level execution under `if __name__ == '__main__'`) are welcome but ensure they don't change how the user currently runs scripts.

- **Key files to inspect when making changes**
  - `main.py` — conversion engine and CLI
  - `photoOrganizer.py` — GUI, orchestration, EXIF/date handling
  - `squareUp.py` — image padding utility
  - `group.py` — dedupe/date-grouping helper

- **If you find or add tests / requirements**
  - Add a `requirements.txt` (pin versions) and update this file with install steps.
  - Prefer adding small unit tests around pure functions (date parsing, file-name generation) not GUI code.

If anything here is unclear or you want templates for tests or a `requirements.txt`, tell me which part to expand. 
