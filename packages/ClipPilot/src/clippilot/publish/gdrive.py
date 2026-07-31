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

    else:
        creds, _ = google_auth_default(scopes=SCOPES)
        logger.info("[GDrive] Authenticated with Application Default Credentials.")

    try:
        import socket
        socket.setdefaulttimeout(300)
        import httplib2
        import google_auth_httplib2
        http_client = httplib2.Http(timeout=300)
        http_client.follow_redirects = False
        authorized_http = google_auth_httplib2.AuthorizedHttp(creds, http=http_client)
        return build("drive", "v3", http=authorized_http, cache_discovery=False)
    except Exception:
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

    def _find_file_in_folder(self, folder_id: str, name: str) -> Optional[dict]:
        """Search if a file with exact name or name without emoji exists in folder_id."""
        query = (
            f"'{folder_id}' in parents "
            f"and mimeType != 'application/vnd.google-apps.folder' "
            f"and trashed = false"
        )
        results = (
            self._service.files()
            .list(q=query, fields="files(id, name, webViewLink)", pageSize=1000)
            .execute()
        )
        clean_target = re.sub(r'[^\w\s\.-]', '', name).strip().lower()
        for f in results.get("files", []):
            if f["name"] == name:
                return f
            clean_existing = re.sub(r'[^\w\s\.-]', '', f["name"]).strip().lower()
            if clean_target and clean_target == clean_existing:
                return f
        return None

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
        import socket
        socket.setdefaulttimeout(120)
        try:
            from googleapiclient.http import MediaFileUpload
        except ImportError as exc:
            raise ImportError("google-api-python-client is required.") from exc

        mime_type = "video/mp4" if file_path.suffix.lower() == ".mp4" else "application/octet-stream"

        file_metadata = {"name": upload_name, "parents": [folder_id]}
        media = MediaFileUpload(str(file_path), mimetype=mime_type, resumable=True, chunksize=2 * 1024 * 1024)


        request = self._service.files().create(
            body=file_metadata, media_body=media, fields="id, name, webViewLink"
        )

        import time
        file_size = file_path.stat().st_size
        logger.info("[GDrive] Uploading '%s' (%s MB) → Drive as '%s'",
                    file_path.name, round(file_size / 1_048_576, 1), upload_name)

        response = None
        while response is None:

            for attempt in range(5):
                try:
                    status, response = request.next_chunk()
                    if status:
                        pct = int(status.progress() * 100)
                        logger.info("[GDrive]   … %d%%", pct)
                    break
                except Exception as exc:
                    if attempt == 4:
                        raise exc
                    logger.warning("[GDrive] Chunk upload error (%s), retrying in %ds (attempt %d/5)...", exc, 2 * (attempt + 1), attempt + 1)
                    time.sleep(2 * (attempt + 1))

        file_id = response.get("id")
        link = response.get("webViewLink", "")
        logger.info("[GDrive] ✓ Upload complete — Drive file id=%s  link=%s", file_id, link)
        return file_id


    # ------------------------------------------------------------------ #
    #  Public entry point                                                   #
    # ------------------------------------------------------------------ #

    def delete_file(self, file_id: str) -> bool:
        """Permanently delete a file from Google Drive."""
        try:
            self._service.files().delete(fileId=file_id).execute()
            logger.info("[GDrive] Deleted file %s from Drive", file_id)
            return True
        except Exception as exc:
            logger.warning("[GDrive] Failed to delete file %s: %s", file_id, exc)
            return False

    def delete_file_by_name(self, folder_id: str, name: str) -> bool:
        """Find and delete any file with matching name in folder_id."""
        try:
            safe_name = name.replace("\\", "\\\\").replace("'", "\\'")
            query = f"'{folder_id}' in parents and name = '{safe_name}' and trashed = false"
            results = self._service.files().list(q=query, fields="files(id)").execute()
            for f in results.get("files", []):
                self.delete_file(f["id"])
            return True
        except Exception as exc:
            logger.warning("[GDrive] Failed to delete file by name '%s': %s", name, exc)
            return False

    # ------------------------------------------------------------------ #
    #  Public entry point                                                   #
    # ------------------------------------------------------------------ #

    def publish_project(self, project_dir: Path, force_reupload: bool = False, max_retries: bool = 3) -> dict:
        """Upload the final video of a ClipPilot project to Google Drive.

        Logic:
          1. Reads `manifest.json` to get the master_metadata.title → upload filename.
          2. Uses project `created_at` date for the date subfolder (falls back to today).
          3. Finds the final .mp4 video in the project folder.
          4. If force_reupload is True, removes existing file on Drive first.
          5. Uploads the file. If upload fails, deletes partial file and retries ONLY this video.

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
            clean_title = project_dir.name.replace("_", " ").title()

        desired_video_name = f"{clean_title}.mp4"

        # ── 3. Find the final video ───────────────────────────────────────
        video_path = self._find_final_video(project_dir)
        if video_path is None:
            return {"success": False, "error": f"No .mp4 video found in {project_dir}"}

        # ── 4. Get-or-create date folder ──────────────────────────────────
        folder_id = self.get_or_create_date_folder(date_str)

        # If force_reupload, delete any existing file with this name first
        if force_reupload:
            existing_file = self._find_file_in_folder(folder_id, desired_video_name)
            if existing_file:
                logger.info("[GDrive] force_reupload=True → deleting existing '%s' (id=%s)", desired_video_name, existing_file["id"])
                self.delete_file(existing_file["id"])
        else:
            # Check if file already exists on Drive
            existing_file = self._find_file_in_folder(folder_id, desired_video_name)
            if existing_file:
                logger.info("[GDrive] '%s' already uploaded to Drive (id=%s)", desired_video_name, existing_file["id"])
                return {
                    "success": True,
                    "already_uploaded": True,
                    "drive_file_id": existing_file["id"],
                    "drive_link": existing_file.get("webViewLink", ""),
                    "upload_name": existing_file["name"],
                    "date_folder": date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "source_video": str(video_path),
                }

        upload_name = self._resolve_unique_name(folder_id, desired_video_name)

        # ── 5. Upload with single-video retry and partial file cleanup ─────
        file_id = None
        last_error = None

        for attempt in range(1, max_retries + 1):
            try:
                logger.info("[GDrive] Attempt %d/%d for '%s'...", attempt, max_retries, upload_name)
                file_id = self._upload_file(video_path, folder_id, upload_name)
                
                # Fetch web view link
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

            except Exception as exc:
                last_error = exc
                logger.warning("[GDrive] Upload failed on attempt %d/%d for '%s': %s", attempt, max_retries, upload_name, exc)
                
                # Clean up partial/incomplete upload if created
                if file_id:
                    logger.info("[GDrive] Cleaning up failed file id=%s...", file_id)
                    self.delete_file(file_id)
                    file_id = None
                else:
                    self.delete_file_by_name(folder_id, upload_name)

                if attempt < max_retries:
                    import time
                    wait_sec = attempt * 3
                    logger.info("[GDrive] Retrying ONLY '%s' in %ds...", upload_name, wait_sec)
                    time.sleep(wait_sec)

        return {"success": False, "error": f"Failed to upload {upload_name} after {max_retries} attempts: {last_error}"}



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
