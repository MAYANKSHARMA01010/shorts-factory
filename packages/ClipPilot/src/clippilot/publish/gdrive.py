"""Google Drive publisher for Shorts Factory.

Uploads the final rendered video to a Google Drive folder,
organized by creation date (YYYY-MM-DD subfolders).

File naming:
  - Uses `master_metadata.title` from manifest.json as the upload filename.
  - If a file with that name already exists in the target folder, appends
    a counter suffix: "My Title (1).mp4", "My Title (2).mp4", etc.
  - Never uploads manifest.json — only the .mp4 video file.

Auth:
  - Service Account JSON (headless / recommended for automation).
  - Falls back to OAuth2 Application Default Credentials when no service
    account file is configured.

Required environment variables:
  GDRIVE_ROOT_FOLDER_ID         — ID of the root Google Drive folder.
  GDRIVE_SERVICE_ACCOUNT_FILE   — (optional) path to service account JSON.
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..brain import env as benv

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
#  Internal helpers                                                             #
# --------------------------------------------------------------------------- #

def _slugify_for_filename(title: str) -> str:
    """Strip characters that are problematic in filenames, keep it readable."""
    # Remove or replace characters that are illegal in most filesystems/Drive
    safe = re.sub(r'[\\/:*?"<>|]', "", title)
    # Collapse multiple spaces / leading-trailing whitespace
    safe = re.sub(r"\s+", " ", safe).strip()
    return safe or "video"


def _build_service(
    service_account_file: Optional[str] = None,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    refresh_token: Optional[str] = None,
):
    """Build and return an authenticated Google Drive v3 service object."""
    try:
        from googleapiclient.discovery import build
        from google.oauth2 import service_account
        from google.oauth2.credentials import Credentials
        from google.auth import default as google_auth_default
    except ImportError as exc:
        raise ImportError(
            "google-api-python-client and google-auth are required. "
            "Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
        ) from exc

    SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]

    # 1. Service Account JSON file
    if service_account_file and Path(service_account_file).exists():
        creds = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES
        )
        logger.info("[GDrive] Authenticated with service account: %s", service_account_file)

    # 2. OAuth2 Refresh Token (from env or YouTube OAuth)
    elif refresh_token and client_id and client_secret:
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )
        logger.info("[GDrive] Authenticated with OAuth2 User Refresh Token.")

    # 3. Fallback: Application Default Credentials (gcloud auth / env var)
    else:
        creds, _ = google_auth_default(scopes=SCOPES)
        logger.info("[GDrive] Authenticated with Application Default Credentials.")

    return build("drive", "v3", credentials=creds, cache_discovery=False)



# --------------------------------------------------------------------------- #
#  Core publisher class                                                         #
# --------------------------------------------------------------------------- #

class GoogleDrivePublisher:
    """Upload the final video of a ClipPilot project to Google Drive.

    Args:
        root_folder_id:       ID of the root Google Drive folder.
        service_account_file: Optional path to a service account JSON key.
    """

    def __init__(
        self,
        root_folder_id: str,
        service_account_file: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ):
        benv.load_dotenv()
        if not root_folder_id:
            raise ValueError("GDRIVE_ROOT_FOLDER_ID must be set.")
        self.root_folder_id = root_folder_id
        
        # Fall back to Drive / YouTube OAuth credentials if explicit params are not set
        cid = client_id or os.environ.get("GDRIVE_CLIENT_ID") or os.environ.get("YOUTUBE_CLIENT_ID")
        csec = client_secret or os.environ.get("GDRIVE_CLIENT_SECRET") or os.environ.get("YOUTUBE_CLIENT_SECRET")
        rt = refresh_token or os.environ.get("GDRIVE_REFRESH_TOKEN")

        self._service = _build_service(
            service_account_file=service_account_file,
            client_id=cid,
            client_secret=csec,
            refresh_token=rt,
        )



    # ------------------------------------------------------------------ #
    #  Folder management                                                    #
    # ------------------------------------------------------------------ #

    def get_or_create_date_folder(self, date_str: Optional[str] = None) -> str:
        """Return the Drive folder ID for `date_str` (YYYY-MM-DD), creating it if absent.

        Args:
            date_str: Date string in YYYY-MM-DD format.  Defaults to today (UTC).

        Returns:
            The Google Drive folder ID for the date subfolder.
        """
        if not date_str:
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Search for an existing folder with this name inside the root folder
        query = (
            f"name = '{date_str}' "
            f"and mimeType = 'application/vnd.google-apps.folder' "
            f"and '{self.root_folder_id}' in parents "
            f"and trashed = false"
        )
        results = (
            self._service.files()
            .list(q=query, fields="files(id, name)", pageSize=1)
            .execute()
        )
        files = results.get("files", [])
        if files:
            folder_id = files[0]["id"]
            logger.info("[GDrive] Found existing date folder '%s' (id=%s)", date_str, folder_id)
            return folder_id

        # Create the date folder
        metadata = {
            "name": date_str,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [self.root_folder_id],
        }
        folder = self._service.files().create(body=metadata, fields="id").execute()
        folder_id = folder["id"]
        logger.info("[GDrive] Created date folder '%s' (id=%s)", date_str, folder_id)
        return folder_id

    # ------------------------------------------------------------------ #
    #  Duplicate-safe filename resolution                                   #
    # ------------------------------------------------------------------ #

    def _resolve_unique_name(self, folder_id: str, desired_name: str) -> str:
        """Return `desired_name` or `desired_name (N)` to avoid collisions.

        E.g. if "My Video.mp4" already exists, returns "My Video (1).mp4".
        If that also exists, returns "My Video (2).mp4", etc.
        """
        stem = Path(desired_name).stem
        suffix = Path(desired_name).suffix  # ".mp4"

        query = (
            f"'{folder_id}' in parents "
            f"and mimeType != 'application/vnd.google-apps.folder' "
            f"and trashed = false"
        )
        results = (
            self._service.files()
            .list(q=query, fields="files(name)", pageSize=1000)
            .execute()
        )
        existing_names = {f["name"] for f in results.get("files", [])}

        if desired_name not in existing_names:
            return desired_name

        counter = 1
        while True:
            candidate = f"{stem} ({counter}){suffix}"
            if candidate not in existing_names:
                return candidate
            counter += 1

    # ------------------------------------------------------------------ #
    #  File upload                                                          #
    # ------------------------------------------------------------------ #

    def _upload_file(self, file_path: Path, folder_id: str, upload_name: str) -> str:
        """Upload a single file with resumable chunked upload.

        Returns:
            The Google Drive file ID of the uploaded file.
        """
        try:
            from googleapiclient.http import MediaFileUpload
        except ImportError as exc:
            raise ImportError("google-api-python-client is required.") from exc

        mime_type = "video/mp4" if file_path.suffix.lower() == ".mp4" else "application/octet-stream"

        file_metadata = {"name": upload_name, "parents": [folder_id]}
        media = MediaFileUpload(str(file_path), mimetype=mime_type, resumable=True, chunksize=5 * 1024 * 1024)

        request = self._service.files().create(
            body=file_metadata, media_body=media, fields="id, name, webViewLink"
        )

        response = None
        bytes_uploaded = 0
        file_size = file_path.stat().st_size
        logger.info("[GDrive] Uploading '%s' (%s MB) → Drive as '%s'",
                    file_path.name, round(file_size / 1_048_576, 1), upload_name)

        while response is None:
            status, response = request.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                logger.info("[GDrive]   … %d%%", pct)

        file_id = response.get("id")
        link = response.get("webViewLink", "")
        logger.info("[GDrive] ✓ Upload complete — Drive file id=%s  link=%s", file_id, link)
        return file_id

    # ------------------------------------------------------------------ #
    #  Public entry point                                                   #
    # ------------------------------------------------------------------ #

    def publish_project(self, project_dir: Path) -> dict:
        """Upload the final video of a ClipPilot project to Google Drive.

        Logic:
          1. Reads `manifest.json` to get the master_metadata.title → upload filename.
          2. Uses project `created_at` date for the date subfolder (falls back to today).
          3. Finds the final .mp4 video in the project folder.
          4. Resolves a unique destination name (appends (1), (2) … on collision).
          5. Gets-or-creates the YYYY-MM-DD subfolder inside the root folder.
          6. Uploads only the video. manifest.json is NOT uploaded.

        Returns:
            Dict with keys: success (bool), drive_file_id, drive_link, upload_name, date_folder.
        """
        project_dir = Path(project_dir)

        # ── 1. Read manifest ──────────────────────────────────────────────
        manifest_path = project_dir / "manifest.json"
        title: Optional[str] = None
        date_str: Optional[str] = None

        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                title = (
                    manifest.get("master_metadata", {}).get("title")
                    or manifest.get("project_info", {}).get("generation_params", {}).get("title")
                )
                created_at = manifest.get("project_info", {}).get("created_at", "")
                if created_at:
                    date_str = created_at[:10]  # take "YYYY-MM-DD" from ISO timestamp
            except Exception as exc:
                logger.warning("[GDrive] Could not parse manifest.json: %s", exc)

        # ── 2. Determine upload filename ──────────────────────────────────
        if title:
            clean_title = _slugify_for_filename(title)
        else:
            # Fallback: use folder name prettified
            clean_title = project_dir.name.replace("_", " ").title()

        desired_video_name = f"{clean_title}.mp4"

        # ── 3. Find the final video ───────────────────────────────────────
        video_path = self._find_final_video(project_dir)
        if video_path is None:
            return {"success": False, "error": f"No .mp4 video found in {project_dir}"}

        # ── 4. Get-or-create date folder ──────────────────────────────────
        folder_id = self.get_or_create_date_folder(date_str)

        # ── 5. Resolve unique name (handle collisions with (1), (2) …) ───
        upload_name = self._resolve_unique_name(folder_id, desired_video_name)
        if upload_name != desired_video_name:
            logger.info("[GDrive] Name collision detected — uploading as '%s'", upload_name)

        # ── 6. Upload ─────────────────────────────────────────────────────
        file_id = self._upload_file(video_path, folder_id, upload_name)

        # Fetch the web view link
        file_info = self._service.files().get(fileId=file_id, fields="webViewLink").execute()
        link = file_info.get("webViewLink", "")

        return {
            "success": True,
            "drive_file_id": file_id,
            "drive_link": link,
            "upload_name": upload_name,
            "date_folder": date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "source_video": str(video_path),
        }

    # ------------------------------------------------------------------ #
    #  Static helpers                                                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _find_final_video(item_dir: Path) -> Optional[Path]:
        """Locate the true final output .mp4 — mirrors the logic in api-backend/app.py."""
        all_mp4s = list(item_dir.glob("*.mp4"))
        if not all_mp4s:
            return None

        # Prefer explicit Final_*.mp4 files
        final_prefixed = [f for f in all_mp4s if f.name.lower().startswith(("final_",))]
        if final_prefixed:
            return max(final_prefixed, key=lambda f: f.stat().st_size)

        # Exclude known intermediate files
        excluded = ["slide_", "slides_silent", "base.mp4", "temp_", "chunk_"]
        valid = [f for f in all_mp4s if not any(k in f.name.lower() for k in excluded)]
        if valid:
            return max(valid, key=lambda f: f.stat().st_size)

        return max(all_mp4s, key=lambda f: f.stat().st_size)


# --------------------------------------------------------------------------- #
#  Convenience factory                                                          #
# --------------------------------------------------------------------------- #

def publisher_from_env() -> Optional[GoogleDrivePublisher]:
    """Instantiate a GoogleDrivePublisher from environment variables.

    Returns None (with a warning) when required env vars are missing.
    """
    root_folder_id = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "").strip()
    service_account_file = os.environ.get("GDRIVE_SERVICE_ACCOUNT_FILE", "").strip() or None

    if not root_folder_id:
        logger.warning(
            "[GDrive] GDRIVE_ROOT_FOLDER_ID is not set — Google Drive upload skipped."
        )
        return None

    return GoogleDrivePublisher(
        root_folder_id=root_folder_id,
        service_account_file=service_account_file,
    )
