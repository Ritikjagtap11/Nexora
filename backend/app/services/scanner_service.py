import os
import uuid
import tempfile
import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Dict, Any

from app.services.drive_service import drive_service
from app.services.document_processor import DocumentProcessor
from app.services.embeddings import embedding_service
from app.services.llm_service import llm_service
from app.database import get_firestore
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor, TimeoutError

# Import json_repair (will use the pip package directly as it is installed in venv)
import json_repair

executor = ThreadPoolExecutor(max_workers=4)


logger = logging.getLogger(__name__)

class ScannerService:
    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}

    def start_scan(self, user_id: str) -> str:
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "status": "running",
            "scanned": 0,
            "total": 0,
            "current_file": "Initializing...",
            "failed_files": []
        }
        # Run the sync scan in a background thread to not block the event loop
        asyncio.get_event_loop().run_in_executor(None, self._scan_folders_sync, job_id, user_id)
        return job_id

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        return self.jobs.get(job_id, {"status": "not_found"})

    def _scan_folders_sync(self, job_id: str, user_id: str):
        try:
            # Get user's root folder ID from Firestore
            db = get_firestore()
            user_doc = db.collection("users").document(user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            user_root_id = user_data.get("root_folder_id")
            
            # 1. List all folders
            if user_root_id:
                folders = drive_service.list_folders(user_root_id)
            else:
                folders = drive_service.list_folders()
            
            # 2. List all files in all folders
            all_files = []
            for folder in folders:
                files = drive_service.list_files(folder['id'])
                for f in files:
                    f['folder_name'] = folder['name']
                all_files.extend(files)

            self.jobs[job_id]['total'] = len(all_files)
            scanned = 0

            # Get Gemini Key
            api_key = llm_service._get_next_key()
            if not api_key:
                raise ValueError("No Gemini API key available")
            
            genai.configure(api_key=api_key)
            model_pro = genai.GenerativeModel("gemini-1.5-pro")
            model_flash = genai.GenerativeModel("gemini-2.5-flash")

            for drive_file in all_files:
                try:
                    file_id = drive_file['id']
                    file_name = drive_file['name']
                    folder_name = drive_file['folder_name']
                    self.jobs[job_id]['current_file'] = f"{folder_name}/{file_name}"
                    
                    # Submit to executor for timeout handling
                    future = executor.submit(
                        self._process_single_file, 
                        drive_file, file_name, folder_name, file_id, user_id, model_pro, model_flash
                    )
                    future.result(timeout=30)
                except TimeoutError:
                    logger.error(f"Timeout scanning file {drive_file.get('name')}")
                    self.jobs[job_id]["failed_files"].append({
                        "file_id": drive_file.get('id'),
                        "file_name": drive_file.get('name'),
                        "error": "Timeout after 30 seconds"
                    })
                except Exception as e:
                    logger.error(f"Error scanning file {drive_file.get('name')}: {e}")
                    self.jobs[job_id]["failed_files"].append({
                        "file_id": drive_file.get('id'),
                        "file_name": drive_file.get('name'),
                        "error": str(e)
                    })
                finally:
                    scanned += 1
                    self.jobs[job_id]['scanned'] = scanned

            self.jobs[job_id]['status'] = 'complete'
            self.jobs[job_id]['current_file'] = 'Done'

        except Exception as e:
            logger.error(f"Scan job failed: {e}")
            self.jobs[job_id]['status'] = 'failed'
            self.jobs[job_id]['error'] = str(e)

    def _process_single_file(self, drive_file, file_name, folder_name, file_id, user_id, model_pro, model_flash):
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_name.split('.')[-1]}") as tmp:
            tmp_path = tmp.name
        
        try:
            drive_service.download_file(file_id, tmp_path)
            
            # Process document
            chunks = DocumentProcessor.process_document(tmp_path, file_name)
            
            # Calculate page/line count
            page_count = max([c.get("page_number", 1) for c in chunks]) if chunks else 0
            full_text = "\n".join([c["text"] for c in chunks])
            line_count = len(full_text.split("\n"))
            
            # Prepare for Gemini
            text_to_analyze = full_text[:8000] # take first 8000 chars to avoid huge prompts
            
            prompt = f"""You are a document intelligence engine. Analyse this document 
and return ONLY a valid JSON object. No markdown fences, 
no preamble, no text outside the JSON.
{{
  "summary": "2-3 sentence description of what this file contains",
  "key_topics": ["topic1", "topic2", "topic3"],
  "document_type": "invoice|report|manual|spreadsheet|notes|presentation|contract|other",
  "important_entities": ["key names, dates, amounts, critical terms"],
  "language": "detected language name"
}}
Document content:
{text_to_analyze}"""

            metadata_json = None
            try:
                resp = model_pro.generate_content(prompt)
                metadata_json = resp.text
            except Exception as e:
                logger.warning(f"Gemini Pro failed, falling back to flash: {e}")
                resp = model_flash.generate_content(prompt)
                metadata_json = resp.text

            # Clean JSON
            if metadata_json:
                raw = metadata_json.strip()
                if raw.startswith("```json"):
                    raw = raw[7:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()
                
                try:
                    meta_obj = json_repair.repair_json(raw, return_objects=True)
                    if not isinstance(meta_obj, dict):
                        meta_obj = {}
                except Exception as e:
                    logger.error(f"json_repair failed: {e}")
                    meta_obj = {}
            else:
                meta_obj = {}

            full_path = f"Nexora/{folder_name}/{file_name}"
            file_type = drive_file.get('mimeType', 'unknown')

            scanned_data = {
                "file_name": file_name,
                "folder_name": folder_name,
                "full_path": full_path,
                "file_type": file_type,
                "page_count": page_count,
                "line_count": line_count,
                "summary": meta_obj.get("summary", ""),
                "key_topics": meta_obj.get("key_topics", []),
                "document_type": meta_obj.get("document_type", "other"),
                "important_entities": meta_obj.get("important_entities", []),
                "language": meta_obj.get("language", "English"),
                "content_preview": full_text[:300],
                "drive_id": file_id,
                "drive_web_link": drive_file.get('webViewLink', ''),
                "scanned_at": datetime.now().isoformat()
            }

            # Store in Firestore
            get_firestore().collection('scanned_files').document(file_id).set(scanned_data)

            # Add to FAISS Vector store
            faiss_metadata = {
                "id": file_id, # use drive_id as doc id
                "filename": file_name,
                "file_type": file_type,
                "upload_date": scanned_data["scanned_at"],
                "file_size": drive_file.get("size", 0),
                "user_id": user_id,
                "summary": scanned_data["summary"],
                "suggested_questions": [],
                "drive_id": file_id,
                "source": full_path
            }
            # Add drive_id to each chunk
            for c in chunks:
                c["drive_id"] = file_id
                c["source"] = full_path

            embedding_service.add_documents(chunks, faiss_metadata)
            
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

scanner_service = ScannerService()
